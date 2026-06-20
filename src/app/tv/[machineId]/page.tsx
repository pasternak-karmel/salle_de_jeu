import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import TVDisplay from "@/components/TV/TVDisplay";
import type { TVMachineEvent } from "@/lib/tv-events";

export const dynamic = "force-dynamic";

export default async function TVPage({ params }: { params: Promise<{ machineId: string }> }) {
  const { machineId } = await params;
  const machine = await prisma.machine.findUnique({
    where: { id: machineId },
    include: {
      sessions: {
        where: { statut: "EN_COURS" },
        take: 1,
      },
    },
  });

  if (!machine) notFound();

  const active = machine.sessions[0] ?? null;

  const initialEvent: TVMachineEvent = {
    machineId: machine.id,
    statut: machine.statut,
    machineName: machine.nom,
    machineType: machine.type,
    session: active
      ? { id: active.id, debut: active.debut.toISOString(), dureePrevu: active.dureePrevu ?? null }
      : null,
  };

  return <TVDisplay machineId={machine.id} initialEvent={initialEvent} />;
}
