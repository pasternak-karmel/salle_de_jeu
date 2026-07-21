/**
 * Webhook FeexPay — annoncé dans le README mais jamais implémenté jusqu'ici.
 *
 * Sans lui, un paiement Mobile Money ne se dénouait que par le polling du
 * navigateur du gérant : fermer l'onglet laissait le paiement EN_ATTENTE
 * indéfiniment, même si le client avait bien payé.
 *
 * Le corps de la requête n'est PAS considéré comme fiable — n'importe qui
 * connaissant l'URL peut la poster. On n'en extrait que la référence, puis on
 * redemande le statut réel à FeexPay avec notre clé API, qui fait foi.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { feexpayGetStatus } from "@/lib/feexpay";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const reference = String(body.reference ?? body.transaction_id ?? body.id ?? "");
  if (!reference) {
    return NextResponse.json({ error: "Référence manquante" }, { status: 400 });
  }

  const paiement = await prisma.paiement.findFirst({
    where: { referenceFeexPay: reference },
    include: { session: { select: { montant: true } } },
  });
  if (!paiement) {
    // 200 volontaire : inutile que FeexPay réessaie une référence qu'on ne connaît pas.
    return NextResponse.json({ ok: true, ignore: "référence inconnue" });
  }
  if (paiement.statut === "PAYE") {
    return NextResponse.json({ ok: true, status: "PAYE" }); // rejeu du webhook
  }

  let statut: string;
  let montantRecu: number;
  try {
    const verif = await feexpayGetStatus(reference);
    statut = verif.status;
    montantRecu = verif.amount;
  } catch (err) {
    // 502 : FeexPay réessaiera la notification.
    const msg = err instanceof Error ? err.message : "Erreur vérification FeexPay";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (statut === "SUCCESSFUL") {
    const attendu = paiement.session?.montant ?? paiement.montant;
    if (montantRecu < attendu) {
      console.error(
        `[FeexPay] Montant insuffisant sur ${reference}: ${montantRecu} reçus / ${attendu} dus`,
      );
      return NextResponse.json({ ok: true, status: "MONTANT_INVALIDE" });
    }
    await prisma.paiement.update({ where: { id: paiement.id }, data: { statut: "PAYE" } });
    return NextResponse.json({ ok: true, status: "PAYE" });
  }

  if (["FAILED", "CANCELLED", "EXPIRED"].includes(statut)) {
    await prisma.paiement.update({ where: { id: paiement.id }, data: { statut: "ECHOUE" } });
    return NextResponse.json({ ok: true, status: "ECHOUE" });
  }

  return NextResponse.json({ ok: true, status: "EN_ATTENTE" });
}
