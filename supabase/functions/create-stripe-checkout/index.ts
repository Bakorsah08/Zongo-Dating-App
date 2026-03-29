import Stripe from 'npm:stripe@17.5.0';
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

type PriceMapEntry = { priceId: string; tokens: number };
type PriceMap = Record<string, PriceMapEntry>;

function loadPriceMap(): PriceMap {
  const raw = Deno.env.get('STRIPE_CHECKOUT_PRICE_MAP');
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: PriceMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (!v || typeof v !== 'object') continue;
      const o = v as Record<string, unknown>;
      const priceId = typeof o.priceId === 'string' ? o.priceId : typeof o.price_id === 'string' ? o.price_id : '';
      const tokens = typeof o.tokens === 'number' ? o.tokens : Number(o.tokens);
      if (priceId && Number.isFinite(tokens) && tokens > 0) out[k] = { priceId, tokens: Math.round(tokens) };
    }
    return out;
  } catch {
    return {};
  }
}

type TokenPackageRow = {
  id: string;
  tokens: number;
  stripe_price_id: string | null;
  active: boolean;
};

async function loadPackageFromDb(packageId: string): Promise<PriceMapEntry | null> {
  const url = (Deno.env.get('SUPABASE_URL') ?? '').trim();
  const serviceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim();
  if (!url || !serviceKey) return null;
  const sb = getServiceSupabase(url, serviceKey);
  const { data, error } = await sb
    .from('token_packages')
    .select('id,tokens,stripe_price_id,active')
    .eq('id', packageId)
    .maybeSingle<TokenPackageRow>();
  if (error || !data) return null;
  if (!data.active) return null;
  const priceId = (data.stripe_price_id ?? '').trim();
  const tokens = Math.round(Number(data.tokens));
  if (!priceId || !Number.isFinite(tokens) || tokens <= 0) return null;
  return { priceId, tokens };
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
    const secret = Deno.env.get('STRIPE_SECRET_KEY');
    const baseUrl = (Deno.env.get('CHECKOUT_APP_BASE_URL') ?? Deno.env.get('PAYMENT_APP_BASE_URL') ?? '').trim();
    const legacyPriceMap = loadPriceMap();

    if (!secret?.trim()) {
      return json(503, { ok: false, error: 'stripe_not_configured', detail: 'missing STRIPE_SECRET_KEY' });
    }
    if (!baseUrl) {
      return json(503, { ok: false, error: 'stripe_not_configured', detail: 'missing CHECKOUT_APP_BASE_URL' });
    }

    const userId = await getRequesterId(req);
    if (!userId) return json(401, { ok: false, error: 'unauthorized' });

    const body = (await req.json()) as { package_id?: string };
    const packageId = typeof body.package_id === 'string' ? body.package_id.trim() : '';
    const cfg =
      packageId
        ? (await loadPackageFromDb(packageId)) ?? legacyPriceMap[packageId]
        : undefined;
    if (!cfg) {
      return json(400, { ok: false, error: 'unknown_package', package_id: packageId });
    }

    const stripe = new Stripe(secret, {
      apiVersion: '2024-11-20.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const successUrl = `${baseUrl.replace(/\/$/, '')}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl.replace(/\/$/, '')}/?checkout=cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: cfg.priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      metadata: {
        supabase_user_id: userId,
        token_amount: String(cfg.tokens),
        package_id: packageId,
      },
    });

    if (!session.url) {
      return json(500, { ok: false, error: 'stripe_no_session_url' });
    }

    return json(200, { ok: true, url: session.url, session_id: session.id });
  } catch (err) {
    console.error('create-stripe-checkout', err);
    const message = err instanceof Error ? err.message : 'internal_error';
    return json(500, { ok: false, error: 'internal_error', detail: message });
  }
});
