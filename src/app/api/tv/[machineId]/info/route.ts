import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTVInfo } from '@/lib/tv-control';

export async function GET(_: NextRequest, { params }: { params: Promise<{ machineId: string }> }) {
  const { machineId } = await params;
  const machine = await prisma.machine.findUnique({ where: { id: machineId } });
  if (!machine?.tvIp) return NextResponse.json({ error: 'Pas d\'IP TV' }, { status: 400 });

  try {
    const info = await getTVInfo(machine.tvIp);
    return NextResponse.json(info);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}