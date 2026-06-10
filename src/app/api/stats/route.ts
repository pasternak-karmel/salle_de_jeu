import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfDay, startOfMonth, subDays } from "date-fns";

export async function GET() {
  const now = new Date();
  const today = startOfDay(now);
  const moisDebut = startOfMonth(now);
  const semDebut = startOfDay(subDays(now, 7));

  const [sessionsEnCours, revJour, revMois, clientsTotal] = await Promise.all([
    prisma.session.count({ where: { statut: "EN_COURS" } }),
    prisma.paiement.aggregate({ where: { statut: "PAYE", createdAt: { gte: today } }, _sum: { montant: true } }),
    prisma.paiement.aggregate({ where: { statut: "PAYE", createdAt: { gte: moisDebut } }, _sum: { montant: true } }),
    prisma.client.count(),
  ]);

  return NextResponse.json({
    sessionsEnCours,
    revJour: revJour._sum.montant ?? 0,
    revMois: revMois._sum.montant ?? 0,
    clientsTotal,
  });
}
