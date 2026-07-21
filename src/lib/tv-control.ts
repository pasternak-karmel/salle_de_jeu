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
const APP_ID = 'iapp.samsung';

function packString(s: Buffer | string): Buffer {
  const buf = typeof s === 'string' ? Buffer.from(s, 'utf8') : s;
  const len = Buffer.alloc(2);
  len.writeUInt16LE(buf.length, 0);
  return Buffer.concat([len, buf]);
}

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
  0x02: 'allowed',
  0x0a: 'waiting',
  0x64: 'allowed',
};

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

    if (payloadStart + payloadLen > data.length) break;
    offset = payloadStart + payloadLen;
  }

  return messages;
}

export function initAuthorizedIps(ips: string[]): void {
  ips.forEach(ip => authorizedIps.add(ip));
  console.log(`[TV] ${ips.length} IP(s) pré-autorisées:`, ips);
}

function getConnection(tvIp: string): Promise<TVConnection> {
  return new Promise((resolve, reject) => {
    const existing = connections.get(tvIp);
    if (existing && !existing.socket.destroyed) {
      return resolve(existing);
    }

    const socket = new net.Socket();
    const conn: TVConnection = { socket, ready: false, queue: [], authResponse: null };
    connections.set(tvIp, conn);

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

      const ourMessages = messages.filter(m => m.utf8 === APP_ID);
      const msg = ourMessages[ourMessages.length - 1];
      if (!msg) return;

      conn.authResponse = msg;
      console.log(`[TV ${tvIp}] Auth: status=${msg.status} (0x${msg.statusByte?.toString(16)})`);

      if (msg.status === 'waiting') {
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

/** Extinction d'une TV Samsung (protocole legacy TCP 55000). */
export async function samsungPowerOff(tvIp: string): Promise<void> {
  await sendKey(tvIp, 'KEY_POWEROFF');
}

// ─── Roku ECP (External Control Protocol — HTTP port 8060) ───────────────────
//
// Les TV Roku ignorent totalement le protocole Samsung. Elles se pilotent en
// HTTP : une simple requête POST suffit, sans appairage ni token.

const ROKU_PORT = 8060;

/** Extinction d'une TV Roku via ECP. La TV doit être allumée (ce qui est le cas
 *  en fin de session). Met la TV en veille. */
export async function rokuPowerOff(tvIp: string): Promise<void> {
  const res = await fetch(`http://${tvIp}:${ROKU_PORT}/keypress/PowerOff`, {
    method: 'POST',
    signal: AbortSignal.timeout(4_000),
  });
  if (res.status === 403) {
    // La Roku refuse toute commande réseau tant que le contrôle externe n'est pas
    // autorisé. Réglage TV : Paramètres → Système → Paramètres système avancés →
    // Contrôle par les applications mobiles → Accès réseau → « Permissif ».
    throw new Error(
      `Roku PowerOff — HTTP 403 : contrôle réseau désactivé sur la TV ${tvIp}. ` +
        `Régler « Accès réseau » sur « Permissif » dans les paramètres Roku.`,
    );
  }
  if (!res.ok) throw new Error(`Roku PowerOff — HTTP ${res.status}`);
}

/** Allumage d'une TV Roku via ECP. Nécessite que la TV reste joignable en veille,
 *  c.-à-d. l'option « Démarrage TV rapide » activée sur la Roku. */
export async function rokuPowerOn(tvIp: string): Promise<void> {
  const res = await fetch(`http://${tvIp}:${ROKU_PORT}/keypress/PowerOn`, {
    method: 'POST',
    signal: AbortSignal.timeout(4_000),
  });
  if (res.status === 403) {
    throw new Error(
      `Roku PowerOn — HTTP 403 : contrôle réseau désactivé sur la TV ${tvIp}. ` +
        `Régler « Accès réseau » sur « Permissif » dans les paramètres Roku.`,
    );
  }
  if (!res.ok) throw new Error(`Roku PowerOn — HTTP ${res.status}`);
}

export type TVType = 'SAMSUNG' | 'ROKU';

/**
 * Allume la TV d'un poste au démarrage d'une session.
 *
 * Samsung : Wake-on-LAN (le protocole TCP ne rallume pas une TV éteinte).
 * Roku    : ECP PowerOn (le WoWLAN étant peu fiable, surtout en WiFi).
 * Marque inconnue : on tente les deux (Samsung n'écoute pas sur le port 8060,
 * l'appel ECP échoue donc sans effet de bord). La détection ferme se fait à la
 * première extinction, qui mémorise `tvType`.
 *
 * Best effort : une TV injoignable ne doit jamais bloquer l'ouverture de session.
 */
export async function allumerTV(machine: {
  tvMac: string | null;
  tvIp: string | null;
  tvType: string | null;
}): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  if (machine.tvMac) tasks.push(wakeOnLan(machine.tvMac));
  if (machine.tvIp && machine.tvType !== 'SAMSUNG') tasks.push(rokuPowerOn(machine.tvIp));

  const results = await Promise.allSettled(tasks);
  for (const r of results) {
    if (r.status === 'rejected') console.error('[TV] Allumage:', r.reason);
  }
}

/** Détecte la marque d'une TV en interrogeant l'endpoint ECP de Roku.
 *  Repli sur 'SAMSUNG' si l'hôte ne répond pas en Roku (défaut historique). */
export async function detectTVType(tvIp: string): Promise<TVType> {
  try {
    const res = await fetch(`http://${tvIp}:${ROKU_PORT}/query/device-info`, {
      signal: AbortSignal.timeout(2_500),
    });
    if (res.ok) {
      const body = await res.text();
      if (/roku|<device-info/i.test(body)) return 'ROKU';
    }
  } catch {
    // Pas de service ECP → ce n'est pas un Roku (ou il est injoignable).
  }
  return 'SAMSUNG';
}

export async function pairTV(tvIp: string): Promise<TVAuthResponse | null> {
  const existing = connections.get(tvIp);
  if (existing) {
    existing.socket.destroy();
    connections.delete(tvIp);
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