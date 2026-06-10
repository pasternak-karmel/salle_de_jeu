import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const machines = await prisma.machine.findMany({ orderBy: { nom: "asc" } });
  return NextResponse.json(machines);
}

export async function POST(req: NextRequest) {
  const { nom, type, prixHeure } = await req.json();
  if (!nom || !type || !prixHeure) return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });

  const machine = await prisma.machine.create({ data: { nom, type, prixHeure: Number(prixHeure) } });
  return NextResponse.json(machine, { status: 201 });
}
