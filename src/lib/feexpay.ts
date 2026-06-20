const BASE = 'https://api-v2.feexpay.me';

function feexpayHeaders() {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${process.env.FEEXPAY_API_KEY}`,
  };
}

export type FeexpayNetwork = 'mtn' | 'moov';

// ─── INITIER UNE COLLECTE ────────────────────────────────────────────────────

export type CollecteInput = {
  network: FeexpayNetwork;
  amount: number;
  phoneNumber: string; // avec indicatif ex: "2290197000000"
  metadata?: Record<string, string>;
};

export type CollecteResult = {
  reference: string;
  status: string;
};

export async function feexpayCollect(input: CollecteInput): Promise<CollecteResult> {
  const url = `${BASE}/api/transactions/public/requesttopay/${input.network}`;

  const body: Record<string, unknown> = {
    shop: process.env.FEEXPAY_SHOP_ID,
    amount: input.amount,
    phoneNumber: Number(input.phoneNumber),
  };

  if (input.metadata) body.callback_info = JSON.stringify(input.metadata);

  const res = await fetch(url, {
    method: 'POST',
    headers: feexpayHeaders(),
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json?.message ?? json?.error ?? `FeexPay error ${res.status}`);
  }

  return {
    reference: json.reference ?? json.id ?? '',
    status: json.status ?? 'PENDING',
  };
}

// ─── VÉRIFIER LE STATUT ───────────────────────────────────────────────────────

export type TransactionStatus = {
  reference: string;
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
  amount: number;
  metadata?: Record<string, string>;
};

export async function feexpayGetStatus(reference: string): Promise<TransactionStatus> {
  const res = await fetch(
    `${BASE}/api/transactions/public/single/status/${reference}`,
    { method: 'GET', headers: feexpayHeaders() },
  );

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json?.message ?? `FeexPay status error ${res.status}`);
  }

  const rawStatus = String(json.status ?? 'PENDING').toUpperCase();
  const validStatuses = ['PENDING', 'SUCCESSFUL', 'FAILED', 'CANCELLED', 'EXPIRED'];
  const status = validStatuses.includes(rawStatus)
    ? (rawStatus as TransactionStatus['status'])
    : 'PENDING';

  let metadata: Record<string, string> | undefined;
  if (json.callback_info) {
    try { metadata = JSON.parse(json.callback_info); } catch { /* ignore */ }
  }

  return {
    reference,
    status,
    amount: Number(json.amount ?? 0),
    metadata,
  };
}

// ─── NORMALISER NUMÉRO BÉNINOIS ───────────────────────────────────────────────

export function normaliserTelephone(tel: string): string {
  const digits = tel.replace(/\D/g, '');
  if (digits.startsWith('229')) return digits;
  if (digits.startsWith('00229')) return digits.slice(2);
  if (digits.length === 8) return `229${digits}`;
  if (digits.length === 9 && digits.startsWith('0')) return `229${digits.slice(1)}`;
  return digits;
}

// ─── DÉTECTER LE RÉSEAU À PARTIR DU NUMÉRO ───────────────────────────────────

export function detecterReseau(telephone: string): FeexpayNetwork | null {
  const digits = normaliserTelephone(telephone).replace(/^229/, '');
  // MTN Bénin : 96, 97, 56, 66, 61, 62, 63, 64, 65, 67, 68, 69
  if (/^(96|97|56|66|61|62|63|64|65|67|68|69)/.test(digits)) return 'mtn';
  // Moov Bénin : 94, 95, 51, 52, 53, 54, 55, 41, 42, 43, 44, 45, 46, 47, 48, 49
  if (/^(94|95|51|52|53|54|55|41|42|43|44|45|46|47|48|49)/.test(digits)) return 'moov';
  return null;
}
