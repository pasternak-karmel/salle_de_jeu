import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { feexpayCollect, feexpayGetStatus, normaliserTelephone, detecterReseau, type FeexpayNetwork } from "@/lib/feexpay";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { methode } = body;

  const session = await prisma.session.findUnique({ where: { id }, include: { machine: true } });
  if (!session || session.statut !== "TERMINEE") {
    return NextResponse.json({ error: "Session non trouvée ou pas encore terminée" }, { status: 400 });
  }
  if (!session.montant) {
    return NextResponse.json({ error: "Montant non calculé" }, { status: 400 });
  }

  // ── CASH ────────────────────────────────────────────────────────────────────
  if (methode === "CASH") {
    const paiement = await prisma.paiement.upsert({
      where: { sessionId: id },
      create: { sessionId: id, montant: session.montant, methode: "CASH", statut: "PAYE" },
      update: { methode: "CASH", statut: "PAYE" },
    });
    return NextResponse.json({ ok: true, paiement });
  }

  // ── INITIER MOMO ─────────────────────────────────────────────────────────────
  if (methode === "MOMO") {
    const { telephone } = body;
    if (!telephone) return NextResponse.json({ error: "Numéro requis" }, { status: 400 });

    const phoneNorm = normaliserTelephone(telephone);
    if (phoneNorm.length < 11) return NextResponse.json({ error: "Numéro invalide" }, { status: 400 });

    const network: FeexpayNetwork = body.network ?? detecterReseau(telephone) ?? "mtn";

    try {
      const result = await feexpayCollect({
        network,
        amount: session.montant,
        phoneNumber: phoneNorm,
        metadata: { session_id: id },
      });

      await prisma.paiement.upsert({
        where: { sessionId: id },
        create: {
          sessionId: id,
          montant: session.montant,
          methode: "MOMO",
          statut: "EN_ATTENTE",
          telephone: phoneNorm,
          referenceFeexPay: result.reference,
          network,
        },
        update: {
          methode: "MOMO",
          statut: "EN_ATTENTE",
          telephone: phoneNorm,
          referenceFeexPay: result.reference,
          network,
        },
      });

      return NextResponse.json({ ok: true, reference: result.reference, status: result.status });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur FeexPay";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  // ── POLLING STATUT ────────────────────────────────────────────────────────────
  if (methode === "POLL") {
    const { reference } = body;
    if (!reference) return NextResponse.json({ error: "Référence manquante" }, { status: 400 });

    try {
      const result = await feexpayGetStatus(reference);
      if (result.status === "SUCCESSFUL") {
        // Ne jamais marquer PAYE sans vérifier que le montant encaissé correspond
        // bien à celui dû : un paiement partiel ne doit pas solder la session.
        if (result.amount < session.montant) {
          return NextResponse.json(
            {
              error: `Montant encaissé insuffisant (${result.amount} FCFA reçus, ${session.montant} FCFA dus)`,
              status: "MONTANT_INVALIDE",
            },
            { status: 409 },
          );
        }
        await prisma.paiement.updateMany({
          where: { sessionId: id, referenceFeexPay: reference },
          data: { statut: "PAYE" },
        });
        return NextResponse.json({ ok: true, status: "SUCCESSFUL" });
      }
      if (["FAILED", "CANCELLED", "EXPIRED"].includes(result.status)) {
        await prisma.paiement.updateMany({
          where: { sessionId: id, referenceFeexPay: reference },
          data: { statut: "ECHOUE" },
        });
        return NextResponse.json({ ok: true, status: result.status });
      }
      return NextResponse.json({ ok: true, status: "PENDING" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur polling";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  return NextResponse.json({ error: "methode invalide (CASH | MOMO | POLL)" }, { status: 400 });
}
