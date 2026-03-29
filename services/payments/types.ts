export type PaymentWebChannel = 'stripe_web' | 'revenuecat_native';

export type TokenCheckoutResult = {
  redirected: boolean;
  errorMessage?: string;
};
