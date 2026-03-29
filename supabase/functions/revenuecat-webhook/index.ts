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

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const ae = new TextEncoder().encode(a);
  const be = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < ae.length; i += 1) diff |= ae[i]! ^ be[i]!;
  return diff === 0;
}

type ProductTokenMap = Record<string, number>;

function loadProductTokenMap(): ProductTokenMap {
  const raw = Deno.env.get('REVENUECAT_PRODUCT_TOKEN_MAP');
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: ProductTokenMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      const n = typeof v === 'number' ? v : Number(v);
      if (Number.isFinite(n) && n > 0) out[k] = Math.round(n);
    }
    return out;
  } catch {
    return {};
  }
}

type TokenPackageRow = {
  id: string;
  tokens: number;
  revenuecat_product_id: string | null;
  active: boolean;
};

async function resolveTokensForRevenueCatProduct(productId: string): Promise<number | null> {
  const pid = (productId ?? '').trim();
  if (!pid) return null;

  // Prefer DB catalog (admin source of truth)
  const url = (Deno.env.get('SUPABASE_URL') ?? '').trim();
  const serviceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim();
  if (url && serviceKey) {
    const sb = getServiceSupabase(url, serviceKey);
    const { data, error } = await sb
      .from('token_packages')
      .select('id,tokens,revenuecat_product_id,active')
      .eq('revenuecat_product_id', pid)
      .maybeSingle<TokenPackageRow>();
    if (!error && data && data.active) {
      const n = Math.round(Number(data.tokens));
      if (Number.isFinite(n) && n > 0) return n;
    }
  }

  // Legacy fallback: env JSON map
  const legacy = loadProductTokenMap();
  const n = legacy[pid];
  if (Number.isFinite(n) && n > 0) return Math.round(n);
  return null;
}

/** Purchase-like events where a consumable SKU may grant tokens. */
const CREDIT_EVENT_TYPES = new Set([
  'NON_RENEWING_PURCHASE',
  'INITIAL_PURCHASE',
]);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });

  const expectedAuth = Deno.env.get('REVENUECAT_WEBHOOK_AUTHORIZATION')?.trim();
  if (!expectedAuth) {
    console.error('revenuecat-webhook: REVENUECAT_WEBHOOK_AUTHORIZATION not set');
    return json(503, { ok: false, error: 'revenuecat_webhook_not_configured' });
  }

  const authHeader = req.headers.get('authorization')?.trim() ?? '';
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : authHeader;
  const expected = expectedAuth.startsWith('Bearer ') ? expectedAuth.slice('Bearer '.length).trim() : expectedAuth;

  if (!timingSafeEqual(provided, expected)) {
    return json(401, { ok: false, error: 'unauthorized' });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, error: 'invalid_json' });
  }

  const ev = (payload.event ?? payload) as Record<string, unknown>;
  const eventType = typeof ev.type === 'string' ? ev.type : '';
  const eventId = typeof ev.id === 'string' ? ev.id : '';
  const productId = typeof ev.product_id === 'string' ? ev.product_id : '';
  let appUserId = typeof ev.app_user_id === 'string' ? ev.app_user_id : '';

  if (!eventId) {
    return json(400, { ok: false, error: 'missing_event_id' });
  }

  if (!CREDIT_EVENT_TYPES.has(eventType)) {
    return json(200, { ok: true, ignored: true, type: eventType });
  }

  const tokenAmount = await resolveTokensForRevenueCatProduct(productId);
  if (!tokenAmount || tokenAmount <= 0) {
    return json(200, { ok: true, ignored: true, reason: 'product_not_in_token_map', product_id: productId });
  }

  if (!appUserId && typeof ev.original_app_user_id === 'string') {
    appUserId = ev.original_app_user_id;
  }

  if (!appUserId) {
    return json(400, { ok: false, error: 'missing_app_user_id' });
  }

  try {
    const supabase = getServiceSupabase(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));
    const paymentRef = `revenuecat:${eventId}`;
    const result = await creditWalletFromVerifiedPayment({
      supabase,
      userId: appUserId,
      tokenAmount,
      paymentRef,
      providerEventId: `revenuecat:${eventId}`,
      provider: 'revenuecat',
      walletMeta: {
        rail: 'revenuecat',
        revenuecat_event_type: eventType,
        product_id: productId,
        store: typeof ev.store === 'string' ? ev.store : undefined,
      },
    });

    if (!result.ok) {
      return json(result.status, { ok: false, error: result.error });
    }
    if (result.duplicate) {
      return json(200, { ok: true, duplicate: true, provider_event_id: eventId });
    }

    return json(200, { ok: true, provider_event_id: eventId, result: result.data });
  } catch (err) {
    console.error('revenuecat-webhook fatal', err);
    return json(500, { ok: false, error: 'internal_error' });
  }
});
