import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    const supabase = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));

    const { error: insertEventErr } = await supabase.from('payment_webhook_events').insert({
      provider_event_id: providerEventId,
      payment_ref: paymentRef,
      user_id: userId,
      token_amount: tokenAmount,
    });
    if (insertEventErr) {
      if (insertEventErr.code === '23505') {
        return json(200, { ok: true, duplicate: true, provider_event_id: providerEventId });
      }
      console.error('payment_webhook_events insert error', insertEventErr);
      return json(500, { ok: false, error: 'idempotency_write_failed' });
    }

    const { data, error } = await supabase.rpc('wallet_apply_delta', {
      p_user_id: userId,
      p_delta: tokenAmount,
      p_kind: 'purchase_credit',
      p_reference_id: paymentRef,
      p_meta: {
        source: 'payments-webhook',
        actor_label: 'payments-webhook',
        reason: 'payment_confirmed',
        provider_event_id: providerEventId,
      },
    });

    if (error) {
      console.error('wallet_apply_delta error', error);
      return json(500, { ok: false, error: 'wallet_apply_failed' });
    }

    return json(200, { ok: true, provider_event_id: providerEventId, result: data });
  } catch (err) {
    console.error('payments-webhook fatal', err);
    return json(500, { ok: false, error: 'internal_error' });
  }
});
