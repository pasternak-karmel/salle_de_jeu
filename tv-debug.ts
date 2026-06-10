import * as net from 'net';

const TV_IP = process.argv[2] || '192.168.100.46';

function packString(s: Buffer | string): Buffer {
  const buf = typeof s === 'string' ? Buffer.from(s, 'utf8') : s;
  const len = Buffer.alloc(2);
  len.writeUInt16LE(buf.length, 0);
  return Buffer.concat([len, buf]);
}

function buildAuthPacket(): Buffer {
  const fakeIp  = Buffer.from('192.168.1.1').toString('base64');
  const fakeMac = Buffer.from('00-00-00-00-00-00').toString('base64');
  const appName = Buffer.from('GamingManager').toString('base64');

  const payload = Buffer.concat([
    Buffer.from([0x64, 0x00]),
    packString(fakeIp),
    packString(fakeMac),
    packString(appName),
  ]);

  return Buffer.concat([
    Buffer.from([0x00]),
    packString('iphone.iapp.samsung'),
    packString(payload),
  ]);
}

console.log(`Connexion à ${TV_IP}:55000...`);
const socket = new net.Socket();

socket.connect(55000, TV_IP, () => {
  console.log('Connecté ! Envoi auth...\n');
  socket.write(buildAuthPacket());
});

let chunkIndex = 0;

socket.on('data', (chunk: Buffer) => {
  chunkIndex++;
  console.log(`\n========== CHUNK #${chunkIndex} (${chunk.length} bytes) ==========`);
  console.log('HEX:  ', chunk.toString('hex'));
  console.log('UTF8: ', JSON.stringify(chunk.toString('utf8')));
  console.log('BYTES:', [...chunk].map((b: number) => `0x${b.toString(16).padStart(2, '0')}`).join(' '));

  // Tenter de parser manuellement
  let offset = 0;
  let msgIdx = 0;
  while (offset < chunk.length) {
    if (offset + 3 > chunk.length) {
      console.log(`  [offset ${offset}] Pas assez de bytes pour lire l'en-tête`);
      break;
    }
    const typeByte = chunk[offset];
    const strLen = chunk.readUInt16LE(offset + 1);
    console.log(`\n  Message #${++msgIdx} @ offset ${offset}:`);
    console.log(`    typeByte: 0x${typeByte.toString(16)}`);
    console.log(`    strLen: ${strLen}`);

    if (offset + 3 + strLen > chunk.length) {
      console.log(`    ⚠️  strLen dépasse le buffer`);
      break;
    }

    const appStr = chunk.slice(offset + 3, offset + 3 + strLen).toString('utf8');
    console.log(`    appStr: "${appStr}"`);

    const payloadLenOffset = offset + 3 + strLen;
    if (payloadLenOffset + 2 > chunk.length) {
      console.log(`    ⚠️  Pas assez de bytes pour payloadLen`);
      break;
    }

    const payloadLen = chunk.readUInt16LE(payloadLenOffset);
    const payloadStart = payloadLenOffset + 2;
    console.log(`    payloadLen: ${payloadLen}`);

    if (payloadStart + payloadLen > chunk.length) {
      console.log(`    ⚠️  payloadLen dépasse le buffer`);
      break;
    }

    const payload = chunk.slice(payloadStart, payloadStart + payloadLen);
    console.log(`    payload hex: ${payload.toString('hex')}`);
    console.log(`    payload[0] (statusByte): 0x${payload[0]?.toString(16) ?? 'N/A'}`);

    offset = payloadStart + payloadLen;
  }
});

socket.on('error', (err: Error) => console.error('Erreur socket:', err.message));
socket.on('close', () => console.log('\nSocket fermé'));

// Fermer après 40s
setTimeout(() => {
  console.log('\nTimeout — fermeture');
  socket.destroy();
  process.exit(0);
}, 40_000);