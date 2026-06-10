import { prisma } from "@/lib/prisma";
import ClientsClient from "./ClientsClient";

export const revalidate = 0;

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { dateInscription: "desc" },
    include: {
      _count: { select: { sessions: true } },
      sessions: {
        where: { statut: "TERMINEE" },
        select: { montant: true },
      },
    },
  });

  const data = clients.map((c) => ({
    ...c,
    nbSessions: c._count.sessions,
    totalDepense: c.sessions.reduce((s, x) => s + (x.montant ?? 0), 0),
  }));

  return <ClientsClient clients={data} />;
}
