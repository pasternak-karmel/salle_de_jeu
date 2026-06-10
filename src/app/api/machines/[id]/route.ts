import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await req.json();
  const machine = await prisma.machine.update({
    where: { id },
    data: { ...data, prixHeure: data.prixHeure ? Number(data.prixHeure) : undefined },
  });
  return NextResponse.json(machine);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.machine.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
