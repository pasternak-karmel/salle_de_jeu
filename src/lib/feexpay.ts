const FEEXPAY_API_URL = "https://api.feexpay.me/api";
const API_KEY = process.env.FEEXPAY_API_KEY!;
const SHOP_ID = process.env.FEEXPAY_SHOP_ID!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export interface FeexPayInitResult {
  success: boolean;
  token?: string;
  payment_url?: string;
  message?: string;
}

export async function initierPaiementFeexPay(params: {
  montant: number;
  telephone: string;
  description: string;
  referenceInterne: string;
}): Promise<FeexPayInitResult> {
  const response = await fetch(`${FEEXPAY_API_URL}/transactions/public/requesttopay/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.montant,
      phoneNumber: params.telephone,
      description: params.description,
      shopId: SHOP_ID,
      callback_url: `${APP_URL}/api/feexpay/webhook`,
      custom_id: params.referenceInterne,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return { success: false, message: err };
  }

  const data = await response.json();
  return {
    success: true,
    token: data.token,
    payment_url: data.payment_url ?? `https://feexpay.me/pay/${data.token}`,
  };
}

export async function verifierStatutPaiement(token: string): Promise<string> {
  const response = await fetch(`${FEEXPAY_API_URL}/transactions/${token}/`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!response.ok) return "INCONNU";
  const data = await response.json();
  return data.status ?? "INCONNU";
}
