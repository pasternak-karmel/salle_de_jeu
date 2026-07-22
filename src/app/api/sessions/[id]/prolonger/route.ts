import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitMachineUpdate } from "@/lib/tv-events";

const AJOUT_MAX = 480; // minutes ajoutables en une fois
const DUREE_TOTALE_MAX = 960; // garde-fou : 16 h max au total

/**
 * Prolonge une session en cours : augmente `dureePrevu`.
 *
 * L'échéance d'auto-extinction se déduit de `debut + dureePrevu`
 * (cf. session-scheduler.ts), donc rien d'autre à replanifier. On ré-émet
 * l'événement SSE pour que le compte à rebours de la TV se recale en direct.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { minutes } = await req.json();

  const ajout = Number(minutes);
  if (!ajout || ajout <= 0 || ajout > AJOUT_MAX) {
    return NextResponse.json({ error: `Durée invalide (1-${AJOUT_MAX} minutes)` }, { status: 400 });
  }

  const session = await prisma.session.findUnique({ where: { id }, include: { machine: true } });
  if (!session || session.statut !== "EN_COURS") {
    return NextResponse.json({ error: "Session non trouvée ou déjà terminée" }, { status: 400 });
  }

  const nouvelleDuree = session.dureePrevu + ajout;
  if (nouvelleDuree > DUREE_TOTALE_MAX) {
    return NextResponse.json(
      { error: `Durée totale trop longue (max ${DUREE_TOTALE_MAX} minutes)` },
      { status: 400 },
    );
  }

  // Transition conditionnelle : n'applique que si la session est encore EN_COURS,
  // pour ne pas ressusciter une session clôturée entre-temps par la boucle.
  const { count } = await prisma.session.updateMany({
    where: { id, statut: "EN_COURS" },
    data: { dureePrevu: nouvelleDuree },
  });
  if (count === 0) {
    return NextResponse.json({ error: "Session déjà terminée" }, { status: 409 });
  }

  emitMachineUpdate({
    machineId: session.machineId,
    statut: "OCCUPEE",
    machineName: session.machine.nom,
    machineType: session.machine.type,
    session: { id: session.id, debut: session.debut.toISOString(), dureePrevu: nouvelleDuree },
  });

  return NextResponse.json({ ok: true, dureePrevu: nouvelleDuree });
}
