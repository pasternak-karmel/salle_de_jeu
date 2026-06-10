import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { wakeOnLan, turnOffTV, initAuthorizedIps } from "@/lib/tv-control";
import { emitMachineUpdate } from "@/lib/tv-events";
import { calculerMontant } from "@/lib/utils";

// Pré-autoriser toutes les machines déjà appairées au démarrage du module
prisma.machine.findMany({
  where: { tvIp: { not: null }, tvToken: { not: null } },
  select: { tvIp: true },
}).then(machines => {
  const ips = machines.map(m => m.tvIp).filter(Boolean) as string[];
  if (ips.length) initAuthorizedIps(ips);
}).catch(console.error);

export async function GET() {
  const sessions = await prisma.session.findMany({
    orderBy: { debut: "desc" },
    take: 100,
    include: {
      client: { select: { nom: true, prenom: true } },
      machine: { select: { nom: true, type: true, prixHeure: true } },
    },
  });
  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
  const { clientId, machineId, dureePrevu } = await req.json();
  if (!clientId || !machineId) return NextResponse.json({ error: "clientId et machineId requis" }, { status: 400 });

  const machine = await prisma.machine.findUnique({ where: { id: machineId } });
  if (!machine || machine.statut !== "DISPONIBLE") {
    return NextResponse.json({ error: "Machine non disponible" }, { status: 409 });
  }

  const [session] = await prisma.$transaction([
    prisma.session.create({
      data: { clientId, machineId, dureePrevu: dureePrevu ?? null },
      include: { client: { select: { nom: true, prenom: true } } },
    }),
    prisma.machine.update({ where: { id: machineId }, data: { statut: "OCCUPEE" } }),
  ]);

  // Allumer la TV via Wake-on-LAN (best effort)
  if (machine.tvMac) {
    wakeOnLan(machine.tvMac).catch(() => {});
  }

  // Notifier la page TV en temps réel
  emitMachineUpdate({
    machineId,
    statut: "OCCUPEE",
    machineName: machine.nom,
    machineType: machine.type,
    session: {
      id: session.id,
      debut: session.debut.toISOString(),
      dureePrevu: dureePrevu ?? null,
      client: session.client,
    },
  });

  // Auto-terminer la session après dureePrevu minutes
  if (dureePrevu && dureePrevu > 0) {
    const delayMs = dureePrevu * 1000; // en secondes pour les tests
    setTimeout(async () => {
      try {
        // Vérifier que la session est toujours EN_COURS
        const sessionActuelle = await prisma.session.findUnique({
          where: { id: session.id },
          include: { machine: true },
        });
        if (!sessionActuelle || sessionActuelle.statut !== "EN_COURS") return;

        const fin = new Date();
        const dureeMinutes = Math.ceil((fin.getTime() - new Date(sessionActuelle.debut).getTime()) / 60000);
        const montant = calculerMontant(sessionActuelle.machine.prixHeure, dureeMinutes);

        await prisma.$transaction([
          prisma.session.update({
            where: { id: session.id },
            data: { fin, dureeMinutes, montant, statut: "TERMINEE" },
          }),
          prisma.machine.update({
            where: { id: machineId },
            data: { statut: "DISPONIBLE" },
          }),
          prisma.paiement.create({
            data: {
              sessionId: session.id,
              clientId,
              montant,
              methode: "CASH",
              statut: "PAYE",
            },
          }),
        ]);

        // Notifier la TV — retour en veille
        emitMachineUpdate({
          machineId,
          statut: "DISPONIBLE",
          machineName: machine.nom,
          machineType: machine.type,
          session: null,
        });

        // Éteindre la TV physiquement
        if (machine.tvIp) {
          turnOffTV(machine.tvIp, machine.tvToken).catch((err) => {
            console.error('[TV] Erreur extinction:', err);
          });
        }
      } catch (err) {
        console.error("Erreur auto-termination session:", err);
      }
    }, delayMs);
  }

  return NextResponse.json(session, { status: 201 });
}