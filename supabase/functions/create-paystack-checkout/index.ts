import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getServiceSupabase } from '../_shared/walletCredit.ts';

type BodyJson = Record<string, unknown>;

function json(status: number, body: BodyJson) {
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

type PaystackChannel = 'card' | 'mobile_money';

type TokenPackageRow = {
  id: string;
  tokens: number;
  paystack_amount_minor: number | null;
  paystack_currency: string;
  active: boolean;
};

type PackageCharge = { tokens: number; amountMinor: number; currency: string };

async function loadPackageFromDb(packageId: string): Promise<PackageCharge | null> {
  const sb = getServiceSupabase(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));
  const { data, error } = await sb
    .from('token_packages')
    .select('id,tokens,paystack_amount_minor,paystack_currency,active')
    .eq('id', packageId)
    .maybeSingle<TokenPackageRow>();
  if (error || !data || !data.active) return null;
  const tokens = Math.round(Number(data.tokens));
  const amountMinor = Math.round(Number(data.paystack_amount_minor));
  if (!Number.isFinite(tokens) || tokens <= 0) return null;
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) return null;
  return { tokens, amountMinor, currency: data.paystack_currency || 'GHS' };
}

async function getRequester(req: Request): Promise<{ id: string; email: string | null } | null> {
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
  if (!user) return null;
  return { id: user.id, email: user.email ?? null };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });

  try {
    const secret = Deno.env.get('PAYSTACK_SECRET_KEY')?.trim();
    const baseUrl = (Deno.env.get('CHECKOUT_APP_BASE_URL') ?? Deno.env.get('PAYMENT_APP_BASE_URL') ?? '').trim();

    if (!secret) {
      return json(503, { ok: false, error: 'paystack_not_configured', detail: 'missing PAYSTACK_SECRET_KEY' });
    }
    if (!baseUrl) {
      return json(503, { ok: false, error: 'paystack_not_configured', detail: 'missing CHECKOUT_APP_BASE_URL' });
    }

    const requester = await getRequester(req);
    if (!requester) return json(401, { ok: false, error: 'unauthorized' });
    // Paystack requires a customer email on every transaction.
    if (!requester.email) return json(400, { ok: false, error: 'email_required' });

    const body = (await req.json()) as { package_id?: string; channel?: string };
    const packageId = typeof body.package_id === 'string' ? body.package_id.trim() : '';
    const channel: PaystackChannel | null =
      body.channel === 'mobile_money' ? 'mobile_money' : body.channel === 'card' ? 'card' : null;

    const pkg = packageId ? await loadPackageFromDb(packageId) : null;
    if (!pkg) {
      return json(400, { ok: false, error: 'unknown_package', package_id: packageId });
    }

    const appUrl = baseUrl.replace(/\/$/, '');
    const reference = `zongo_${crypto.randomUUID().replace(/-/g, '')}`;

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: requester.email,
        amount: pkg.amountMinor,
        currency: pkg.currency,
        reference,
        callback_url: `${appUrl}/?checkout=success`,
        // Without a channel, Paystack shows every channel enabled on the account.
        ...(channel ? { channels: [channel] } : {}),
        metadata: {
          supabase_user_id: requester.id,
          token_amount: pkg.tokens,
          package_id: packageId,
          expected_amount_minor: pkg.amountMinor,
          expected_currency: pkg.currency,
          cancel_action: `${appUrl}/?checkout=cancel`,
        },
      }),
    });

    const payload = (await res.json().catch(() => null)) as
      | { status?: boolean; message?: string; data?: { authorization_url?: string; reference?: string } }
      | null;

    if (!res.ok || !payload?.status || !payload.data?.authorization_url) {
      console.error('create-paystack-checkout initialize failed', res.status, payload?.message);
      return json(502, { ok: false, error: 'paystack_initialize_failed', detail: payload?.message ?? `HTTP ${res.status}` });
    }

    return json(200, { ok: true, url: payload.data.authorization_url, reference });
  } catch (err) {
    console.error('create-paystack-checkout', err);
    const message = err instanceof Error ? err.message : 'internal_error';
    return json(500, { ok: false, error: 'internal_error', detail: message });
  }
});
