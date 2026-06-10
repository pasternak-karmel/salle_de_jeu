import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculerMontant } from "@/lib/utils";
import { turnOffTV } from "@/lib/tv-control";
import { emitMachineUpdate } from "@/lib/tv-events";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { methode } = await req.json();

  const session = await prisma.session.findUnique({
    where: { id },
    include: { machine: true },
  });
  if (!session || session.statut !== "EN_COURS") {
    return NextResponse.json({ error: "Session non trouvée ou déjà terminée" }, { status: 400 });
  }

  const fin = new Date();
  const dureeMinutes = Math.ceil((fin.getTime() - new Date(session.debut).getTime()) / 60000);
  const montant = calculerMontant(session.machine.prixHeure, dureeMinutes);

  await prisma.$transaction([
    prisma.session.update({
      where: { id },
      data: { fin, dureeMinutes, montant, statut: "TERMINEE" },
    }),
    prisma.machine.update({
      where: { id: session.machineId },
      data: { statut: "DISPONIBLE" },
    }),
    prisma.paiement.create({
      data: {
        sessionId: id,
        clientId: session.clientId,
        montant,
        methode: methode ?? "CASH",
        statut: methode === "FEEXPAY" ? "EN_ATTENTE" : "PAYE",
      },
    }),
  ]);

  // Notifier la page TV (elle passe en écran de veille)
  emitMachineUpdate({
    machineId: session.machineId,
    statut: "DISPONIBLE",
    machineName: session.machine.nom,
    machineType: session.machine.type,
    session: null,
  });

  // Éteindre la TV physiquement (best effort)
  if (session.machine.tvIp) {
    turnOffTV(session.machine.tvIp, (session.machine as any).tvToken ?? null).catch(() => {});
  }

  return NextResponse.json({ ok: true, montant, dureeMinutes });
}
