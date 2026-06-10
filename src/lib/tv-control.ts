import { createSocket } from 'dgram';
import * as net from 'net';

// ─── Wake-on-LAN ────────────────────────────────────────────────────────────

function buildMagicPacket(mac: string): Buffer {
  const macHex = mac.replace(/[:\-]/g, '');
  if (macHex.length !== 12) throw new Error('Adresse MAC invalide');
  const macBytes = Buffer.from(macHex, 'hex');
  const packet = Buffer.alloc(102);
  packet.fill(0xff, 0, 6);
  for (let i = 0; i < 16; i++) macBytes.copy(packet, 6 + i * 6);
  return packet;
}

export async function wakeOnLan(mac: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = createSocket('udp4');
    const packet = buildMagicPacket(mac);
    socket.once('error', reject);
    socket.bind(() => {
      socket.setBroadcast(true);
      socket.send(packet, 0, packet.length, 9, '255.255.255.255', (err) => {
        socket.close();
        err ? reject(err) : resolve();
      });
    });
  });
}

// ─── Samsung Legacy TCP (port 55000) ────────────────────────────────────────

const APP_NAME = 'GamingManager';
// FIX: APP_ID doit matcher ce que la TV renvoie dans ses messages de réponse.
// La TV répond toujours avec 'iapp.samsung' comme app string — on utilise donc
// cette valeur pour identifier NOS messages dans parseMessages().
const APP_ID = 'iapp.samsung';

function packString(s: Buffer | string): Buffer {
  const buf = typeof s === 'string' ? Buffer.from(s, 'utf8') : s;
  const len = Buffer.alloc(2);
  len.writeUInt16LE(buf.length, 0);
  return Buffer.concat([len, buf]);
}

// FIX: Les champs IP et MAC ne peuvent pas être des buffers vides.
// Le protocole Samsung attend des valeurs base64 valides même si la TV
// ne les vérifie pas toutes. On utilise des valeurs fictives stables.
function buildAuthPacket(): Buffer {
  const fakeIp  = Buffer.from('192.168.1.1').toString('base64');
  const fakeMac = Buffer.from('00-00-00-00-00-00').toString('base64');
  const appName = Buffer.from(APP_NAME).toString('base64');

  const payload = Buffer.concat([
    Buffer.from([0x64, 0x00]),
    packString(fakeIp),
    packString(fakeMac),
    packString(appName),
  ]);

  // FIX: L'app string dans le paquet envoyé doit être 'iphone.iapp.samsung'
  // (format attendu par la TV pour déclencher le handshake).
  return Buffer.concat([
    Buffer.from([0x00]),
    packString('iphone.iapp.samsung'),
    packString(payload),
  ]);
}

function buildKeyPacket(key: string): Buffer {
  const keyB64 = Buffer.from(key).toString('base64');
  const payload = Buffer.concat([Buffer.from([0x00, 0x00, 0x00]), packString(keyB64)]);
  return Buffer.concat([
    Buffer.from([0x00]),
    packString('iphone.iapp.samsung'),
    packString(payload),
  ]);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TVAuthResponse {
  raw: Buffer;
  hex: string;
  utf8: string;
  statusByte: number | null;
  status: 'allowed' | 'denied' | 'waiting' | 'no_response' | string;
}

interface TVConnection {
  socket: net.Socket;
  ready: boolean;
  queue: Array<{ resolve: () => void; reject: (e: Error) => void; key: string }>;
  authResponse: TVAuthResponse | null;
}

// ─── Pool de connexions persistantes ─────────────────────────────────────────

const connections = new Map<string, TVConnection>();
const authorizedIps = new Set<string>();

const STATUS_MAP: Record<number, TVAuthResponse['status']> = {
  0x00: 'allowed',
  0x01: 'denied',
  0x02: 'allowed', // certains modèles
  0x0a: 'waiting', // popup TV en cours
  0x64: 'allowed',
};

// FIX: parseMessages filtre maintenant sur APP_ID = 'iapp.samsung' qui est
// ce que la TV renvoie réellement — l'ancien filtre sur 'gaminmgr.001'
// ne matchait jamais, rendant la détection du statut d'auth aveugle.
function parseMessages(data: Buffer): TVAuthResponse[] {
  const messages: TVAuthResponse[] = [];
  let offset = 0;

  while (offset < data.length) {
    if (offset + 3 > data.length) break;

    const strLen = data.readUInt16LE(offset + 1);
    if (offset + 3 + strLen + 2 > data.length) break;

    const appStr = data.slice(offset + 3, offset + 3 + strLen).toString('utf8');
    const payloadLenOffset = offset + 3 + strLen;
    const payloadLen = data.readUInt16LE(payloadLenOffset);
    const payloadStart = payloadLenOffset + 2;

    // FIX: Si payloadLen dépasse le buffer restant, on ne break pas —
    // on lit quand même le statusByte (payload[0]) qui est toujours présent.
    // Le message "allowed" de Samsung a payloadLen=0x0064 (100) mais
    // le buffer réel ne contient que 2 bytes de payload : statusByte + 0x00.
    // C'est un bug du firmware Samsung : payloadLen annoncé != payload réel.
    const availablePayload = data.slice(
      payloadStart,
      Math.min(payloadStart + payloadLen, data.length)
    );
    const statusByte = availablePayload.length > 0 ? availablePayload[0] : null;
    const actualEnd = Math.min(payloadStart + payloadLen, data.length);

    messages.push({
      raw: data.slice(offset, actualEnd),
      hex: data.slice(offset, actualEnd).toString('hex'),
      utf8: appStr,
      statusByte,
      status: statusByte !== null
        ? (STATUS_MAP[statusByte] ?? `unknown(0x${statusByte.toString(16)})`)
        : 'no_response',
    });

    // Si payloadLen était tronqué, on a consommé tout le buffer
    if (payloadStart + payloadLen > data.length) break;
    offset = payloadStart + payloadLen;
  }

  return messages;
}

export function initAuthorizedIps(ips: string[]): void {
  ips.forEach(ip => authorizedIps.add(ip));
  console.log(`[TV] ${ips.length} IP(s) pré-autorisées:`, ips);
}

// FIX: Suppression du paramètre waitForAuth — on attend toujours l'auth.
// L'ancienne logique waitForAuth=false dans turnOffTV était dangereuse :
// la TV peut ignorer les commandes reçues avant la fin du handshake.
// À la place, on mémorise les IPs déjà autorisées pour ne plus attendre
// le popup si la TV nous connaît déjà (reconnexion instantanée).
function getConnection(tvIp: string): Promise<TVConnection> {
  return new Promise((resolve, reject) => {
    const existing = connections.get(tvIp);
    if (existing && !existing.socket.destroyed) {
      return resolve(existing);
    }

    const socket = new net.Socket();
    const conn: TVConnection = { socket, ready: false, queue: [], authResponse: null };
    connections.set(tvIp, conn);

    // Si l'IP est déjà autorisée (connexion précédente acceptée par la TV),
    // on n'attend pas le popup — la TV répond 'allowed' quasi instantanément.
    const isKnown = authorizedIps.has(tvIp);
    const authTimeout = isKnown ? 3_000 : 35_000;

    const timeout = setTimeout(() => {
      socket.destroy();
      connections.delete(tvIp);
      reject(new Error(isKnown
        ? 'Timeout connexion TV (TV éteinte ou injoignable)'
        : 'Timeout — accepte le popup sur la TV (35s écoulées)'
      ));
    }, authTimeout);

    let resolved = false;

    socket.connect(55000, tvIp, () => {
      console.log(`[TV ${tvIp}] Connecté — envoi auth (connu: ${isKnown})`);
      socket.write(buildAuthPacket());
    });

    const chunks: Buffer[] = [];

    const dataHandler = (chunk: Buffer) => {
      chunks.push(chunk);
      const data = Buffer.concat(chunks);
      const messages = parseMessages(data);

      // FIX: On filtre sur APP_ID = 'iapp.samsung' (réponse réelle de la TV)
      const ourMessages = messages.filter(m => m.utf8 === APP_ID);
      const msg = ourMessages[ourMessages.length - 1];
      if (!msg) return;

      conn.authResponse = msg;
      console.log(`[TV ${tvIp}] Auth: status=${msg.status} (0x${msg.statusByte?.toString(16)})`);

      if (msg.status === 'waiting') {
        // La TV attend l'approbation de l'utilisateur — on continue d'écouter
        return;
      }

      if (msg.status === 'denied') {
        socket.removeListener('data', dataHandler);
        clearTimeout(timeout);
        connections.delete(tvIp);
        if (!resolved) {
          resolved = true;
          reject(new Error('Accès refusé par la TV'));
        }
        return;
      }

      // allowed
      socket.removeListener('data', dataHandler);
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        conn.ready = true;
        authorizedIps.add(tvIp);
        resolve(conn);
      }
    };

    socket.on('data', dataHandler);

    socket.on('error', (err) => {
      clearTimeout(timeout);
      connections.delete(tvIp);
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    socket.on('close', () => {
      connections.delete(tvIp);
    });
  });
}

export async function sendKey(tvIp: string, key: string): Promise<void> {
  const conn = await getConnection(tvIp);
  return new Promise((resolve, reject) => {
    conn.socket.write(buildKeyPacket(key), (err) => {
      if (err) {
        connections.delete(tvIp);
        reject(err);
      } else {
        setTimeout(resolve, 300);
      }
    });
  });
}

// FIX: turnOffTV utilise maintenant getConnection() standard avec auth complète.
// Avant, waitForAuth=false envoyait la commande sans attendre la confirmation,
// ce qui causait des échecs silencieux si la TV n'avait pas encore autorisé.
export async function turnOffTV(tvIp: string): Promise<void> {
  await sendKey(tvIp, 'KEY_POWER');
}

export async function pairTV(tvIp: string): Promise<TVAuthResponse | null> {
  const existing = connections.get(tvIp);
  if (existing) {
    existing.socket.destroy();
    connections.delete(tvIp);
    // Aussi retirer des IPs autorisées pour forcer un nouveau popup
    authorizedIps.delete(tvIp);
  }

  const conn = await getConnection(tvIp);
  const auth = conn.authResponse;
  if (!auth) throw new Error('Aucune réponse de la TV');
  if (auth.status === 'denied') throw new Error('Accès refusé par la TV');
  return auth;
}

export async function getTVInfo(tvIp: string): Promise<{ raw: string; parsed: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();

    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('Timeout'));
    }, 10_000);

    socket.connect(55000, tvIp, () => {
      socket.write(buildAuthPacket());
    });

    const chunks: Buffer[] = [];
    let waitTimer: NodeJS.Timeout;

    socket.on('data', (chunk) => {
      chunks.push(chunk);
      clearTimeout(waitTimer);
      waitTimer = setTimeout(() => {
        clearTimeout(timeout);
        socket.destroy();

        const data = Buffer.concat(chunks);
        const utf8 = data.toString('utf8');

        const parsed: Record<string, string> = {
          hex: data.toString('hex'),
          utf8,
          length: String(data.length),
          bytes: [...data].map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '),
        };

        const strings = utf8.match(/[\x20-\x7E]{4,}/g) ?? [];
        strings.forEach((s, i) => { parsed[`string_${i}`] = s; });

        resolve({ raw: data.toString('hex'), parsed });
      }, 3_000);
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      clearTimeout(waitTimer);
      reject(err);
    });
  });
}

export async function testVolumeUp(tvIp: string): Promise<void> {
  await sendKey(tvIp, 'KEY_VOLUP');
}