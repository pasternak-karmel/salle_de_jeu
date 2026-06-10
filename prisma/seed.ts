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

  const existingClients = await prisma.client.count();
  if (existingClients === 0) {
    await prisma.client.createMany({
      data: [
        { nom: "Agossou", prenom: "Koffi",    telephone: "+22961234567" },
        { nom: "Dossou",  prenom: "Mireille", telephone: "+22997654321", email: "mireille@email.com" },
      ],
    });
  }

  console.log("Seed terminé.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
