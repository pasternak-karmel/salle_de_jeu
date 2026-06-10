import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { pairTV } from '@/lib/tv-control';

export async function POST(_: NextRequest, { params }: { params: Promise<{ machineId: string }> }) {
  const { machineId } = await params;

  const machine = await prisma.machine.findUnique({ where: { id: machineId } });
  if (!machine) return NextResponse.json({ error: 'Machine introuvable' }, { status: 404 });
  if (!machine.tvIp) return NextResponse.json({ error: 'Aucune IP TV configurée pour cette machine' }, { status: 400 });

  try {
    const auth = await pairTV(machine.tvIp);

    const token = `${auth?.hex ?? 'no-response'}`;

    await prisma.machine.update({
      where: { id: machineId },
      data: { tvToken: token },
    });

    return NextResponse.json({ ok: true, token, status: auth?.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
