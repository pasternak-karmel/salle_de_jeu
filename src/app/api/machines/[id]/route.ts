import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Seuls ces champs sont modifiables via l'API. `tvToken` en est volontairement
// exclu : il est écrit uniquement par l'appairage (/api/tv/[machineId]/pair).
const CHAMPS_MODIFIABLES = ["nom", "type", "prixHeure", "statut", "tvMac", "tvIp", "tvType"] as const;
const STATUTS_VALIDES = ["DISPONIBLE", "OCCUPEE", "MAINTENANCE"];
const TV_TYPES_VALIDES = ["SAMSUNG", "ROKU"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  // Champs optionnels dont la chaîne vide signifie « non renseigné » → null.
  const CHAMPS_NULLABLES = new Set(["tvMac", "tvIp", "tvType"]);

  const data: Record<string, unknown> = {};
  for (const champ of CHAMPS_MODIFIABLES) {
    if (body[champ] === undefined) continue;
    if (champ === "prixHeure") {
      data[champ] = Number(body[champ]);
    } else if (CHAMPS_NULLABLES.has(champ)) {
      data[champ] = body[champ] || null;
    } else {
      data[champ] = body[champ];
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ modifiable fourni" }, { status: 400 });
  }
  if (data.prixHeure !== undefined && (!Number.isFinite(data.prixHeure) || (data.prixHeure as number) <= 0)) {
    return NextResponse.json({ error: "prixHeure invalide" }, { status: 400 });
  }
  if (data.statut !== undefined && !STATUTS_VALIDES.includes(String(data.statut))) {
    return NextResponse.json({ error: "statut invalide" }, { status: 400 });
  }
  if (data.tvType != null && !TV_TYPES_VALIDES.includes(String(data.tvType))) {
    return NextResponse.json({ error: "tvType invalide (SAMSUNG | ROKU)" }, { status: 400 });
  }

  const machine = await prisma.machine.update({ where: { id }, data });
  return NextResponse.json(machine);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // La contrainte FK est en RESTRICT : sans ce garde-fou la suppression d'un poste
  // ayant un historique remonterait une erreur Prisma brute en 500.
  const sessions = await prisma.session.count({ where: { machineId: id } });
  if (sessions > 0) {
    return NextResponse.json(
      { error: "Poste supprimable uniquement sans historique de session. Passez-le en MAINTENANCE." },
      { status: 409 },
    );
  }

  await prisma.machine.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
