import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const machines = await prisma.machine.findMany({ orderBy: { nom: "asc" } });
  return NextResponse.json(machines);
}

export async function POST(req: NextRequest) {
  const { nom, type, prixHeure, tvMac, tvIp, tvType } = await req.json();
  if (!nom || !type || !prixHeure) return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });

  if (tvType != null && !["SAMSUNG", "ROKU"].includes(tvType)) {
    return NextResponse.json({ error: "tvType invalide (SAMSUNG | ROKU)" }, { status: 400 });
  }

  const machine = await prisma.machine.create({
    data: {
      nom,
      type,
      prixHeure: Number(prixHeure),
      tvMac: tvMac || null,
      tvIp: tvIp || null,
      tvType: tvType || null,
    },
  });
  return NextResponse.json(machine, { status: 201 });
}
