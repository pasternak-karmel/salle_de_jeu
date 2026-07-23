/**
 * import-data.ts — recharge prisma/data-export.json dans la base courante.
 *
 * À lancer APRÈS avoir pointé DATABASE_URL/DIRECT_URL sur la nouvelle base et
 * créé le schéma (`prisma db push`). Idempotent : réexécutable sans doublon.
 *
 *   node --env-file=.env ./node_modules/.bin/tsx prisma/import-data.ts
 *
 * Par défaut : importe les postes ET l'historique (sessions + paiements).
 * Option `--machines-only` : n'importe que la configuration des postes.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();
const machinesOnly = process.argv.includes("--machines-only");

async function main() {
  const file = join(process.cwd(), "prisma", "data-export.json");
  const { machines, sessions, paiements } = JSON.parse(readFileSync(file, "utf8"));

  // upsert par `id` : idempotent et indépendant du moteur (pas de skipDuplicates,
  // que SQLite ne supporte pas). Ordre : postes → sessions → paiements (clés FK).
  for (const row of machines) {
    await prisma.machine.upsert({ where: { id: row.id }, create: row, update: row });
  }
  console.log(`Postes importés : ${machines.length}`);

  if (machinesOnly) {
    console.log("Historique ignoré (--machines-only).");
    return;
  }

  for (const row of sessions) {
    await prisma.session.upsert({ where: { id: row.id }, create: row, update: row });
  }
  console.log(`Sessions importées : ${sessions.length}`);

  for (const row of paiements) {
    await prisma.paiement.upsert({ where: { id: row.id }, create: row, update: row });
  }
  console.log(`Paiements importés : ${paiements.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
