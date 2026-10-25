import { creditWalletFromVerifiedPayment, getServiceSupabase } from '../_shared/walletCredit.ts';

type Body = Record<string, unknown>;

function json(status: number, body: Body) {
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

async function hmacSha512Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
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

type PaystackTransaction = {
  status?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  channel?: string;
  metadata?: Record<string, unknown> | string | null;
};

function readMetadata(tx: PaystackTransaction): Record<string, unknown> {
  const m = tx.metadata;
  if (!m) return {};
  if (typeof m === 'string') {
    try {
      const parsed = JSON.parse(m);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return m;
}

/** Re-fetch the transaction from Paystack so we never credit from the webhook body alone. */
async function verifyTransaction(secret: string, reference: string): Promise<PaystackTransaction | null> {
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const payload = (await res.json().catch(() => null)) as { status?: boolean; data?: PaystackTransaction } | null;
  if (!res.ok || !payload?.status || !payload.data) return null;
  return payload.data;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });

  const secret = Deno.env.get('PAYSTACK_SECRET_KEY')?.trim();
  if (!secret) {
    console.error('paystack-webhook: PAYSTACK_SECRET_KEY not set');
    return json(503, { ok: false, error: 'paystack_not_configured' });
  }

  const sig = req.headers.get('x-paystack-signature')?.trim() ?? '';
  if (!sig) return json(401, { ok: false, error: 'missing_signature' });

  const rawBody = await req.text();
  const expectedSig = await hmacSha512Hex(secret, rawBody);
  if (!timingSafeEqualHex(sig.toLowerCase(), expectedSig)) {
    return json(401, { ok: false, error: 'invalid_signature' });
  }

  let event: { event?: string; data?: PaystackTransaction };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json(400, { ok: false, error: 'invalid_json' });
  }

  if (event.event !== 'charge.success') {
    return json(200, { ok: true, ignored: true, type: event.event ?? '' });
  }

  const reference = typeof event.data?.reference === 'string' ? event.data.reference : '';
  if (!reference) return json(400, { ok: false, error: 'missing_reference' });

  try {
    const tx = await verifyTransaction(secret, reference);
    if (!tx) {
      // 5xx so Paystack retries; the verify API can be briefly unavailable.
      return json(502, { ok: false, error: 'verify_failed' });
    }
    if (tx.status !== 'success') {
      return json(200, { ok: true, ignored: true, reason: 'not_successful', status: tx.status ?? '' });
    }

    const meta = readMetadata(tx);
    const userId = typeof meta.supabase_user_id === 'string' ? meta.supabase_user_id : '';
    const tokenAmount = Math.round(Number(meta.token_amount) || 0);
    const expectedAmount = Math.round(Number(meta.expected_amount_minor) || 0);
    const expectedCurrency = typeof meta.expected_currency === 'string' ? meta.expected_currency : '';

    if (!userId || tokenAmount <= 0) {
      console.warn('paystack-webhook: missing user or token amount', { reference });
      return json(400, { ok: false, error: 'invalid_transaction_metadata' });
    }
    if (expectedAmount > 0 && ((tx.amount ?? 0) < expectedAmount || (expectedCurrency && tx.currency !== expectedCurrency))) {
      console.warn('paystack-webhook: amount mismatch', { reference, amount: tx.amount, currency: tx.currency });
      return json(400, { ok: false, error: 'amount_mismatch' });
    }

    const supabase = getServiceSupabase(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));
    const result = await creditWalletFromVerifiedPayment({
      supabase,
      userId,
      tokenAmount,
      paymentRef: `paystack:${reference}`,
      // One credit per transaction reference, however many times Paystack resends the event.
      providerEventId: `paystack:${reference}`,
      provider: 'paystack',
      walletMeta: {
        rail: 'paystack',
        paystack_reference: reference,
        paystack_channel: tx.channel,
        amount_minor: tx.amount,
        currency: tx.currency,
        package_id: typeof meta.package_id === 'string' ? meta.package_id : undefined,
      },
    });

    if (!result.ok) {
      return json(result.status, { ok: false, error: result.error });
    }
    if (result.duplicate) {
      return json(200, { ok: true, duplicate: true, reference });
    }

    return json(200, { ok: true, reference, result: result.data });
  } catch (err) {
    console.error('paystack-webhook fatal', err);
    return json(500, { ok: false, error: 'internal_error' });
  }
});
