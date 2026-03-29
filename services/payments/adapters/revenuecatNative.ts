import type { TokenCheckoutResult } from '../types';

/**
 * Mobile (iOS / Android) token purchases go through RevenueCat + store billing.
 * Call `Purchases.purchasePackage()` from React Native and ensure `appUserID` is the Supabase user id
 * so `revenuecat-webhook` can credit the wallet. This web stub keeps a single registry entry point.
 */
export async function startRevenueCatNativePurchase(_packageId: string): Promise<TokenCheckoutResult> {
  return {
    redirected: false,
    errorMessage:
      'In-app purchases run in the iOS or Android app. On the web, token checkout uses Stripe.',
  };
}
