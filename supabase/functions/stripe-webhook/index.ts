import Stripe from 'npm:stripe@17.5.0';
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

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')?.trim();
  if (!webhookSecret) {
    console.error('stripe-webhook: STRIPE_WEBHOOK_SECRET not set');
    return json(503, { ok: false, error: 'stripe_webhook_not_configured' });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) return json(400, { ok: false, error: 'missing_stripe_signature' });

  const rawBody = await req.text();

  const apiKey = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
  if (!apiKey) {
    console.error('stripe-webhook: STRIPE_SECRET_KEY not set');
    return json(503, { ok: false, error: 'stripe_not_configured' });
  }

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(apiKey, {
      apiVersion: '2024-11-20.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    });
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('stripe signature', err);
    return json(400, { ok: false, error: 'invalid_signature' });
  }

  try {
    if (event.type !== 'checkout.session.completed') {
      return json(200, { ok: true, ignored: true, type: event.type });
    }

    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== 'payment') {
      return json(200, { ok: true, ignored: true, reason: 'not_payment_mode' });
    }

    const meta = session.metadata ?? {};
    const userId =
      (typeof meta.supabase_user_id === 'string' && meta.supabase_user_id) ||
      (typeof session.client_reference_id === 'string' && session.client_reference_id) ||
      '';
    const tokenAmount = Math.round(parseInt(String(meta.token_amount ?? '0'), 10) || 0);
    const paymentRef = typeof session.id === 'string' ? session.id : String(session.id);
    const providerEventId = typeof event.id === 'string' ? event.id : String(event.id);

    if (!userId || tokenAmount <= 0) {
      console.warn('stripe-webhook: missing user or token amount', { userId, tokenAmount });
      return json(400, { ok: false, error: 'invalid_session_metadata' });
    }

    const supabase = getServiceSupabase(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));
    const result = await creditWalletFromVerifiedPayment({
      supabase,
      userId,
      tokenAmount,
      paymentRef,
      providerEventId,
      provider: 'stripe_checkout',
      walletMeta: {
        rail: 'stripe',
        stripe_session_id: session.id,
        package_id: typeof meta.package_id === 'string' ? meta.package_id : undefined,
      },
    });

    if (!result.ok) {
      return json(result.status, { ok: false, error: result.error });
    }
    if (result.duplicate) {
      return json(200, { ok: true, duplicate: true, provider_event_id: providerEventId });
    }

    return json(200, { ok: true, provider_event_id: providerEventId, result: result.data });
  } catch (err) {
    console.error('stripe-webhook fatal', err);
    return json(500, { ok: false, error: 'internal_error' });
  }
});
