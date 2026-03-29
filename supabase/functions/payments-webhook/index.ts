import { creditWalletFromVerifiedPayment, getServiceSupabase } from '../_shared/walletCredit.ts';

type Json = Record<string, unknown>;

function json(status: number, body: Json) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });

  try {
    const rawBody = await req.text();
    const sigHeader = req.headers.get('x-zongo-signature') ?? req.headers.get('x-signature') ?? '';
    const providedSig = sigHeader.startsWith('sha256=') ? sigHeader.slice('sha256='.length) : sigHeader;
    if (!providedSig) return json(401, { ok: false, error: 'missing_signature' });
    const expectedSig = await hmacSha256Hex(getEnv('PAYMENT_WEBHOOK_SECRET'), rawBody);
    if (!timingSafeEqualHex(providedSig, expectedSig)) {
      return json(401, { ok: false, error: 'invalid_signature' });
    }

    const payload = JSON.parse(rawBody) as {
      user_id?: string;
      token_amount?: number;
      payment_ref?: string;
      provider_event_id?: string;
    };

    const userId = payload.user_id;
    const tokenAmount = Math.round(Number(payload.token_amount ?? 0));
    const paymentRef = String(payload.payment_ref ?? payload.provider_event_id ?? '');
    const providerEventId = String(payload.provider_event_id ?? payload.payment_ref ?? '');

    if (!userId || !paymentRef || !providerEventId || tokenAmount <= 0) {
      return json(400, { ok: false, error: 'invalid_payload' });
    }

    const supabase = getServiceSupabase(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));
    const result = await creditWalletFromVerifiedPayment({
      supabase,
      userId,
      tokenAmount,
      paymentRef,
      providerEventId,
      provider: 'custom_hmac',
      walletMeta: { rail: 'custom_hmac' },
    });

    if (!result.ok) {
      return json(result.status, { ok: false, error: result.error });
    }
    if (result.duplicate) {
      return json(200, { ok: true, duplicate: true, provider_event_id: providerEventId });
    }

    return json(200, { ok: true, provider_event_id: providerEventId, result: result.data });
  } catch (err) {
    console.error('payments-webhook fatal', err);
    return json(500, { ok: false, error: 'internal_error' });
  }
});
