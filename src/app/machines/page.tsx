import { prisma } from "@/lib/prisma";
import MachinesClient from "./MachinesClient";

export const revalidate = 0;

export default async function MachinesPage() {
  const machines = await prisma.machine.findMany({
    orderBy: [{ statut: "asc" }, { nom: "asc" }],
    select: {
      id: true,
      nom: true,
      type: true,
      prixHeure: true,
      statut: true,
      tvMac: true,
      tvIp: true,
      sessions: {
        where: { statut: "EN_COURS" },
        include: { client: { select: { nom: true, prenom: true } } },
        take: 1,
      },
    },
  });

  return <MachinesClient machines={machines} />;
}
