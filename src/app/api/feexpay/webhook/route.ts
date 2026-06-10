import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { custom_id: sessionId, status, token } = body;

  if (!sessionId) return NextResponse.json({ error: "custom_id manquant" }, { status: 400 });

  const feexpayStatut = String(status).toUpperCase();
  const statut = feexpayStatut === "SUCCESSFUL" || feexpayStatut === "SUCCESS" ? "PAYE" : "ECHOUE";

  await prisma.paiement.updateMany({
    where: { sessionId, tokenFeexPay: token },
    data: { statut, referenceFeexPay: String(body.reference ?? token) },
  });

  if (statut === "PAYE") {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (session?.statut === "EN_COURS") {
      const fin = new Date();
      const dureeMinutes = Math.ceil((fin.getTime() - new Date(session.debut).getTime()) / 60000);
      await prisma.$transaction([
        prisma.session.update({ where: { id: sessionId }, data: { fin, dureeMinutes, statut: "TERMINEE" } }),
        prisma.machine.update({ where: { id: session.machineId }, data: { statut: "DISPONIBLE" } }),
      ]);
    }
  }

  return NextResponse.json({ received: true });
}
