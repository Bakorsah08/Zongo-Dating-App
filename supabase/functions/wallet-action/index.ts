import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Json = Record<string, unknown>;
type WalletAction = 'spend_tokens' | 'request_cashout';

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

async function getRequesterId(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice('Bearer '.length);
  if (!token) return null;
  const client = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
  } = await client.auth.getUser();
  return user?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });

  try {
    const requesterId = await getRequesterId(req);
    if (!requesterId) return json(401, { ok: false, error: 'unauthorized' });
    const authHeader = req.headers.get('Authorization') ?? '';

    const body = (await req.json()) as {
      action?: WalletAction;
      amount?: number;
    };
    const action = body.action;
    if (!action) return json(400, { ok: false, error: 'missing_action' });

    // Use caller JWT so SQL functions that depend on auth.uid() still evaluate correctly.
    const caller = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));

    if (action === 'spend_tokens') {
      const amount = Math.max(0, Math.round(Number(body.amount ?? 0)));
      if (amount <= 0) return json(400, { ok: false, error: 'invalid_amount' });
      const { data, error } = await admin.rpc('wallet_apply_delta', {
        p_user_id: requesterId,
        p_delta: -amount,
        p_kind: 'gift_debit',
        p_reference_id: `spend:${Date.now()}`,
        p_meta: { source: 'wallet-action' },
      });
      if (error) return json(500, { ok: false, error: error.message });
      return json(200, { ok: true, data });
    }

    if (action === 'request_cashout') {
      const amount = Math.max(0, Number(body.amount ?? 0));
      const { data, error } = await caller.rpc('request_cashout', { p_amount: amount });
      if (error) return json(500, { ok: false, error: error.message });
      return json(200, { ok: true, data });
    }

    return json(400, { ok: false, error: 'unsupported_action' });
  } catch (err) {
    console.error('wallet-action fatal', err);
    return json(500, { ok: false, error: 'internal_error' });
  }
});
