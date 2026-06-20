import { NextRequest } from 'next/server';
import { tvEmitter, TVMachineEvent } from '@/lib/tv-events';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_: NextRequest, { params }: { params: Promise<{ machineId: string }> }) {
  const { machineId } = await params;

  const machine = await prisma.machine.findUnique({
    where: { id: machineId },
    include: {
      sessions: {
        where: { statut: 'EN_COURS' },
        take: 1,
      },
    },
  });

  if (!machine) {
    return new Response('Machine introuvable', { status: 404 });
  }

  const encoder = new TextEncoder();
  const activeSession = machine.sessions[0] ?? null;

  let listener: ((e: TVMachineEvent) => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const initial: TVMachineEvent = {
        machineId,
        statut: machine.statut,
        machineName: machine.nom,
        machineType: machine.type,
        session: activeSession
          ? {
              id: activeSession.id,
              debut: activeSession.debut.toISOString(),
              dureePrevu: (activeSession as any).dureePrevu ?? null,
            }
          : null,
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initial)}\n\n`));

      listener = (event: TVMachineEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Stream fermé
        }
      };

      tvEmitter.on(`machine:${machineId}`, listener);

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          if (heartbeat) clearInterval(heartbeat);
        }
      }, 25000);
    },
    cancel() {
      if (listener) tvEmitter.off(`machine:${machineId}`, listener);
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
