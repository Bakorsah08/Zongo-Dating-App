import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type WalletCreditParams = {
  supabase: SupabaseClient;
  userId: string;
  tokenAmount: number;
  paymentRef: string;
  providerEventId: string;
  /** Stored on payment_webhook_events.provider and in wallet ledger meta. */
  provider: string;
  walletMeta?: Record<string, unknown>;
};

export type WalletCreditResult =
  | { ok: true; duplicate?: boolean; data?: unknown }
  | { ok: false; error: string; status: number };

/**
 * Idempotent wallet credit after a verified payment event.
 * Used by Stripe, RevenueCat, custom HMAC webhooks, and future aggregators.
 */
export async function creditWalletFromVerifiedPayment(p: WalletCreditParams): Promise<WalletCreditResult> {
  const userId = p.userId;
  const tokenAmount = Math.round(Number(p.tokenAmount));
  const paymentRef = String(p.paymentRef ?? '').trim();
  const providerEventId = String(p.providerEventId ?? '').trim();

  if (!userId || !paymentRef || !providerEventId || tokenAmount <= 0) {
    return { ok: false, error: 'invalid_payload', status: 400 };
  }

  const row: Record<string, unknown> = {
    provider_event_id: providerEventId,
    payment_ref: paymentRef,
    user_id: userId,
    token_amount: tokenAmount,
    provider: p.provider,
  };

  const { error: insertEventErr } = await p.supabase.from('payment_webhook_events').insert(row);
  if (insertEventErr) {
    if (insertEventErr.code === '23505') {
      return { ok: true, duplicate: true };
    }
    console.error('payment_webhook_events insert error', insertEventErr);
    return { ok: false, error: 'idempotency_write_failed', status: 500 };
  }

  const { data, error } = await p.supabase.rpc('wallet_apply_delta', {
    p_user_id: userId,
    p_delta: tokenAmount,
    p_kind: 'purchase_credit',
    p_reference_id: paymentRef,
    p_meta: {
      source: 'payments-webhook',
      actor_label: 'payments-webhook',
      reason: 'payment_confirmed',
      provider: p.provider,
      provider_event_id: providerEventId,
      ...p.walletMeta,
    },
  });

  if (error) {
    console.error('wallet_apply_delta error', error);
    return { ok: false, error: 'wallet_apply_failed', status: 500 };
  }

  return { ok: true, data };
}

export function getServiceSupabase(url: string, serviceRoleKey: string): SupabaseClient {
  return createClient(url, serviceRoleKey);
}
