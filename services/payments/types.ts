export type PaymentWebChannel = 'stripe_web' | 'revenuecat_native';

/** Checkout options offered in the web Token Shop. */
export type WebPaymentMethod = 'stripe_card' | 'paystack_card' | 'paystack_mobile_money';

export type TokenCheckoutResult = {
  redirected: boolean;
  /** Native IAP finished in-app; wallet may still update via webhook. */
  purchaseCompleted?: boolean;
  userCancelled?: boolean;
  errorMessage?: string;
};
