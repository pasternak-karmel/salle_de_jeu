import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { allumerTV } from "@/lib/tv-control";
import { emitMachineUpdate } from "@/lib/tv-events";

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

  // Réservation atomique de la machine : cet updateMany conditionnel sert de verrou.
  // Sans lui, deux requêtes simultanées pouvaient ouvrir deux sessions sur le même poste.
  const { count } = await prisma.machine.updateMany({
    where: { id: machineId, statut: "DISPONIBLE" },
    data: { statut: "OCCUPEE" },
  });
  if (count === 0) {
    return NextResponse.json({ error: "Machine non disponible" }, { status: 409 });
  }

  const machine = await prisma.machine.findUniqueOrThrow({ where: { id: machineId } });

  let session;
  try {
    session = await prisma.session.create({ data: { machineId, dureePrevu: duree } });
  } catch (err) {
    // Machine réservée mais session non créée : on relâche le verrou.
    await prisma.machine.update({ where: { id: machineId }, data: { statut: "DISPONIBLE" } });
    throw err;
  }

  void allumerTV(machine); // best effort, ne bloque pas la réponse

  emitMachineUpdate({
    machineId,
    statut: "OCCUPEE",
    machineName: machine.nom,
    machineType: machine.type,
    session: { id: session.id, debut: session.debut.toISOString(), dureePrevu: duree },
  });

  // La clôture à échéance est assurée par la boucle de contrôle
  // (src/lib/session-scheduler.ts), et non par un setTimeout en mémoire.

  return NextResponse.json(session, { status: 201 });
}
