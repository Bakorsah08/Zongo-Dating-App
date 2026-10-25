import { purchaseRevenueCatProduct } from '../../revenuecat/client';
import type { TokenCheckoutResult } from '../types';

/**
 * Mobile (iOS / Android) token purchases via RevenueCat + store billing.
 * Wallet credit is applied server-side by revenuecat-webhook after purchase.
 */
export async function startRevenueCatNativePurchase(
  _packageId: string,
  revenuecatProductId?: string | null
): Promise<TokenCheckoutResult> {
  if (!revenuecatProductId?.trim()) {
    return {
      redirected: false,
      purchaseCompleted: false,
      errorMessage:
        'This token package has no App Store / Play product id. Add it in Admin → Token Packages.',
    };
  }

  const result = await purchaseRevenueCatProduct(revenuecatProductId);
  if (result.ok === false) {
    return {
      redirected: false,
      purchaseCompleted: false,
      errorMessage: result.message,
      userCancelled: result.cancelled,
    };
  }

  return { redirected: false, purchaseCompleted: true };
}
