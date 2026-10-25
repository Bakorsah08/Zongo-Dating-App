import { isNativeApp } from '../../lib/platform';
import type { PaymentWebChannel, TokenCheckoutResult, WebPaymentMethod } from './types';
import { startStripeTokenCheckout } from './adapters/stripeWeb';
import { startPaystackTokenCheckout } from './adapters/paystackWeb';
import { startRevenueCatNativePurchase } from './adapters/revenuecatNative';

function resolvePaymentChannel(): PaymentWebChannel {
  if (isNativeApp()) return 'revenuecat_native';
  const v = import.meta.env.VITE_PAYMENT_WEB_CHANNEL?.trim();
  if (v === 'revenuecat_native') return 'revenuecat_native';
  return 'stripe_web';
}

const ALL_WEB_METHODS: WebPaymentMethod[] = ['stripe_card', 'paystack_card', 'paystack_mobile_money'];

/**
 * Web checkout options, in display order, from VITE_PAYMENT_WEB_METHODS
 * (comma-separated). Defaults to Stripe only. Native apps always use store billing.
 */
export function getWebPaymentMethods(): WebPaymentMethod[] {
  if (isNativeApp()) return [];
  const raw = import.meta.env.VITE_PAYMENT_WEB_METHODS?.trim();
  if (!raw) return ['stripe_card'];
  const picked = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is WebPaymentMethod => (ALL_WEB_METHODS as string[]).includes(s));
  const unique = [...new Set(picked)];
  return unique.length > 0 ? unique : ['stripe_card'];
}

export type TokenPurchaseInput = {
  packageId: string;
  revenuecatProductId?: string | null;
  /** Web only; ignored in the native app. Defaults to the first configured method. */
  method?: WebPaymentMethod;
};

/**
 * Web: Stripe Checkout or Paystack (card / mobile money). Native app: RevenueCat + App Store / Play Billing.
 */
export async function startTokenPurchase(input: TokenPurchaseInput): Promise<TokenCheckoutResult> {
  const channel = resolvePaymentChannel();
  if (channel === 'revenuecat_native') {
    return startRevenueCatNativePurchase(input.packageId, input.revenuecatProductId);
  }

  const method = input.method ?? getWebPaymentMethods()[0] ?? 'stripe_card';
  switch (method) {
    case 'paystack_card':
      return startPaystackTokenCheckout(input.packageId, 'card');
    case 'paystack_mobile_money':
      return startPaystackTokenCheckout(input.packageId, 'mobile_money');
    case 'stripe_card':
    default:
      return startStripeTokenCheckout(input.packageId);
  }
}

/** @deprecated Use startTokenPurchase */
export async function startWebTokenPurchase(packageId: string): Promise<TokenCheckoutResult> {
  return startTokenPurchase({ packageId });
}
