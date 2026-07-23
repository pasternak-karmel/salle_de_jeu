/**
 * export-data.ts — sauvegarde toutes les données de la base courante vers un
 * fichier JSON local (prisma/data-export.json, non versionné).
 *
 * Sert à migrer d'une base à une autre (ex. SQLite local → Postgres Neon) sans
 * rien perdre. Lecture seule : sans effet sur la base.
 *
 *   node --env-file=.env ./node_modules/.bin/tsx prisma/export-data.ts
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

async function main() {
  const [machines, sessions, paiements] = await Promise.all([
    prisma.machine.findMany(),
    prisma.session.findMany(),
    prisma.paiement.findMany(),
  ]);

  const data = { exportedAt: new Date().toISOString(), machines, sessions, paiements };
  const out = join(process.cwd(), "prisma", "data-export.json");
  writeFileSync(out, JSON.stringify(data, null, 2));

  console.log(`Export → ${out}`);
  console.log(`  ${machines.length} poste(s), ${sessions.length} session(s), ${paiements.length} paiement(s)`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
