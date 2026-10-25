import { getSupabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { TokenCheckoutResult } from '../types';

const ERROR_MESSAGES: Record<string, string> = {
  unknown_package: 'This package is not available for Paystack yet. Choose another payment method.',
  email_required: 'Add an email address to your account to pay with Paystack.',
  paystack_not_configured: 'Paystack checkout is not set up yet.',
};

/**
 * Server initializes a Paystack transaction; browser follows the hosted checkout URL.
 * `channel` limits the page to card or mobile money (MTN, Telecel, AirtelTigo, M-Pesa).
 */
export async function startPaystackTokenCheckout(
  packageId: string,
  channel: 'card' | 'mobile_money'
): Promise<TokenCheckoutResult> {
  if (!isSupabaseConfigured()) {
    return { redirected: false, errorMessage: 'Supabase is not configured.' };
  }

  const { data, error } = await getSupabase().functions.invoke('create-paystack-checkout', {
    body: { package_id: packageId, channel },
  });

  if (error) {
    return { redirected: false, errorMessage: error.message };
  }

  const d = data as { ok?: boolean; url?: string; error?: string; detail?: string } | null;
  if (!d?.ok || typeof d.url !== 'string' || !d.url) {
    const msg =
      (d?.error && ERROR_MESSAGES[d.error]) ||
      [d?.error, d?.detail].filter(Boolean).join(' — ') ||
      'Could not start checkout.';
    return { redirected: false, errorMessage: msg };
  }

  window.location.assign(d.url);
  return { redirected: true };
}

/** Format a Paystack minor-unit amount for display, e.g. 7500 + GHS → "GHS 75.00". */
export function formatPaystackPrice(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}
