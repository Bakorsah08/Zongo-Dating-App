import { getSupabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { TokenCheckoutResult } from '../types';

/**
 * Server creates a Stripe Checkout Session; browser follows the returned URL.
 */
export async function startStripeTokenCheckout(packageId: string): Promise<TokenCheckoutResult> {
  if (!isSupabaseConfigured()) {
    return { redirected: false, errorMessage: 'Supabase is not configured.' };
  }

  const { data, error } = await getSupabase().functions.invoke('create-stripe-checkout', {
    body: { package_id: packageId },
  });

  if (error) {
    return { redirected: false, errorMessage: error.message };
  }

  const d = data as { ok?: boolean; url?: string; error?: string; detail?: string } | null;
  if (!d?.ok || typeof d.url !== 'string' || !d.url) {
    const msg = [d?.error, d?.detail].filter(Boolean).join(' — ') || 'Could not start checkout.';
    return { redirected: false, errorMessage: msg };
  }

  window.location.assign(d.url);
  return { redirected: true };
}
