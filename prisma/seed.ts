import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.machine.count();
  if (existing === 0) {
    await prisma.machine.createMany({
      data: [
        { nom: "PS5 - Station 1", type: "PS5",  prixHeure: 1500, statut: "DISPONIBLE" },
        { nom: "PS5 - Station 2", type: "PS5",  prixHeure: 1500, statut: "DISPONIBLE" },
        { nom: "PC Gaming 1",     type: "PC",   prixHeure: 1000, statut: "DISPONIBLE" },
        { nom: "PC Gaming 2",     type: "PC",   prixHeure: 1000, statut: "DISPONIBLE" },
        { nom: "VR Station",      type: "VR",   prixHeure: 2500, statut: "DISPONIBLE" },
        { nom: "Xbox Series X",   type: "XBOX", prixHeure: 1200, statut: "DISPONIBLE" },
      ],
    });
  }

  console.log("Seed terminé.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
