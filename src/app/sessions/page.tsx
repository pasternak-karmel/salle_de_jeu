import { prisma } from "@/lib/prisma";
import SessionsClient from "./SessionsClient";

export const revalidate = 0;

export default async function SessionsPage() {
  const [sessions, clients, machines] = await Promise.all([
    prisma.session.findMany({
      orderBy: { debut: "desc" },
      take: 50,
      include: {
        client: { select: { id: true, nom: true, prenom: true } },
        machine: { select: { id: true, nom: true, type: true, prixHeure: true, statut: true } },
        paiement: { select: { statut: true, methode: true } },
      },
    }),
    prisma.client.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true, prenom: true } }),
    prisma.machine.findMany({
      where: {},
      orderBy: { nom: "asc" },
      select: { id: true, nom: true, type: true, prixHeure: true, statut: true },
    }),
  ]);

  return <SessionsClient sessions={sessions} clients={clients} machines={machines} />;
}
