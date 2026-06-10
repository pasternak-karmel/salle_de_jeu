import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const clients = await prisma.client.findMany({ orderBy: { nom: "asc" } });
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const { nom, prenom, telephone, email } = await req.json();
  if (!nom || !prenom) return NextResponse.json({ error: "Nom et prénom requis" }, { status: 400 });

  const client = await prisma.client.create({
    data: { nom, prenom, telephone: telephone || null, email: email || null },
  });
  return NextResponse.json(client, { status: 201 });
}
