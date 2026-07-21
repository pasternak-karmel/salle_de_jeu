import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cloturerSession } from "@/lib/session-lifecycle";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      machine: { select: { nom: true, type: true, prixHeure: true, tvIp: true } },
    },
  });
  if (!session || session.statut !== "EN_COURS") {
    return NextResponse.json({ error: "Session non trouvée ou déjà terminée" }, { status: 400 });
  }

  // Arrêt manuel : facturé au temps réellement écoulé.
  const resultat = await cloturerSession(session, new Date());
  if (!resultat) {
    return NextResponse.json({ error: "Session déjà terminée" }, { status: 409 });
  }

  return NextResponse.json({ ok: true, ...resultat });
}
