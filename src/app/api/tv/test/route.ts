import { sendKey } from '@/lib/tv-control';
import { NextResponse } from 'next/server';

export async function GET() {
  // await testVolumeUp('192.168.100.46');
  await sendKey('192.168.100.46', 'KEY_POWEROFF');
  // await sendKey('192.168.100.46', 'KEY_POWER');
  return NextResponse.json({ ok: true });
}

// import { NextResponse } from 'next/server';
// import { wakeOnLan } from '@/lib/tv-control';

// export async function GET() {
//   await wakeOnLan('0c:89:10:7f:ca:51');
//   return NextResponse.json({ ok: true });
// }
