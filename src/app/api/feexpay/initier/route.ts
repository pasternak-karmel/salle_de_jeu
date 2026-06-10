import { NextRequest, NextResponse } from "next/server";
import { initierPaiementFeexPay } from "@/lib/feexpay";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { sessionId, telephone, montant } = await req.json();

  if (!sessionId || !telephone || !montant) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { client: { select: { nom: true, prenom: true } } },
  });
  if (!session) return NextResponse.json({ error: "Session introuvable" }, { status: 404 });

  const result = await initierPaiementFeexPay({
    montant,
    telephone,
    description: `GameZone - Session jeu ${session.client.prenom} ${session.client.nom}`,
    referenceInterne: sessionId,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.message }, { status: 502 });
  }

  await prisma.paiement.upsert({
    where: { sessionId },
    create: {
      sessionId,
      clientId: session.clientId,
      montant,
      methode: "FEEXPAY",
      statut: "EN_ATTENTE",
      tokenFeexPay: result.token,
    },
    update: {
      tokenFeexPay: result.token,
      statut: "EN_ATTENTE",
    },
  });

  return NextResponse.json({ payment_url: result.payment_url, token: result.token });
}
