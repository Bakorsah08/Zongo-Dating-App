import type { PaymentWebChannel, TokenCheckoutResult } from './types';
import { startStripeTokenCheckout } from './adapters/stripeWeb';
import { startRevenueCatNativePurchase } from './adapters/revenuecatNative';

function resolveWebChannel(): PaymentWebChannel {
  const v = import.meta.env.VITE_PAYMENT_WEB_CHANNEL?.trim();
  if (v === 'revenuecat_native') return 'revenuecat_native';
  return 'stripe_web';
}

/**
 * Extensibility: add `paystack_web`, etc., as new channels and adapters without changing call sites.
 */
export async function startWebTokenPurchase(packageId: string): Promise<TokenCheckoutResult> {
  const channel = resolveWebChannel();
  switch (channel) {
    case 'revenuecat_native':
      return startRevenueCatNativePurchase(packageId);
    case 'stripe_web':
    default:
      return startStripeTokenCheckout(packageId);
  }
}
