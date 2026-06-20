import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { wakeOnLan, turnOffTV, initAuthorizedIps } from "@/lib/tv-control";
import { emitMachineUpdate } from "@/lib/tv-events";
import { calculerMontant } from "@/lib/utils";

prisma.machine
  .findMany({ where: { tvIp: { not: null } }, select: { tvIp: true } })
  .then((machines) => {
    const ips = machines.map((m) => m.tvIp).filter(Boolean) as string[];
    if (ips.length) initAuthorizedIps(ips);
  })
  .catch(console.error);

export async function GET() {
  const sessions = await prisma.session.findMany({
    orderBy: { debut: "desc" },
    take: 100,
    include: {
      machine: { select: { id: true, nom: true, type: true, prixHeure: true, statut: true } },
      paiement: { select: { statut: true, methode: true } },
    },
  });
  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
  const { machineId, dureePrevu } = await req.json();

  if (!machineId) {
    return NextResponse.json({ error: "machineId requis" }, { status: 400 });
  }
  const duree = Number(dureePrevu);
  if (!duree || duree <= 0 || duree > 480) {
    return NextResponse.json({ error: "Durée invalide (1-480 minutes)" }, { status: 400 });
  }

  const machine = await prisma.machine.findUnique({ where: { id: machineId } });
  if (!machine || machine.statut !== "DISPONIBLE") {
    return NextResponse.json({ error: "Machine non disponible" }, { status: 409 });
  }

  const [session] = await prisma.$transaction([
    prisma.session.create({
      data: { machineId, dureePrevu: duree },
    }),
    prisma.machine.update({ where: { id: machineId }, data: { statut: "OCCUPEE" } }),
  ]);

  if (machine.tvMac) wakeOnLan(machine.tvMac).catch(() => {});

  emitMachineUpdate({
    machineId,
    statut: "OCCUPEE",
    machineName: machine.nom,
    machineType: machine.type,
    session: { id: session.id, debut: session.debut.toISOString(), dureePrevu: duree },
  });

  const delayMs = duree * 60 * 1000;
  setTimeout(async () => {
    try {
      const s = await prisma.session.findUnique({ where: { id: session.id } });
      if (!s || s.statut !== "EN_COURS") return;

      const fin = new Date();
      const dureeMinutes = Math.ceil((fin.getTime() - new Date(s.debut).getTime()) / 60000);
      const montant = calculerMontant(machine.prixHeure, dureeMinutes);

      await prisma.$transaction([
        prisma.session.update({ where: { id: session.id }, data: { fin, dureeMinutes, montant, statut: "TERMINEE" } }),
        prisma.machine.update({ where: { id: machineId }, data: { statut: "DISPONIBLE" } }),
      ]);

      if (machine.tvIp) turnOffTV(machine.tvIp).catch(() => {});

      emitMachineUpdate({
        machineId,
        statut: "DISPONIBLE",
        machineName: machine.nom,
        machineType: machine.type,
        session: null,
        pendingPayment: { sessionId: session.id, montant },
      });
    } catch (err) {
      console.error("Erreur auto-termination:", err);
    }
  }, delayMs);

  return NextResponse.json(session, { status: 201 });
}
