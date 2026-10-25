import React, { useState } from 'react';
import { getTokenPackages } from '../data';
import type { TokenPackage } from '../types';
import { formatPaystackPrice, type WebPaymentMethod } from '../services/payments';
import BackButton from './BackButton';

interface TokenShopViewProps {
  currentTokens: number;
  packages?: TokenPackage[];
  onPurchase: (pkg: TokenPackage, method?: WebPaymentMethod) => Promise<void> | void;
  onBack: () => void;
  purchasePending?: boolean;
  purchaseNotice?: string | null;
  /** True when running inside Capacitor iOS/Android (App Store / Play billing). */
  isNativeCheckout?: boolean;
  /** Web checkout options; a picker is shown when there is more than one. */
  paymentMethods?: WebPaymentMethod[];
}

const METHOD_LABELS: Record<WebPaymentMethod, string> = {
  stripe_card: 'Card',
  paystack_card: 'Card (Paystack)',
  paystack_mobile_money: 'Mobile Money',
};

const METHOD_FOOTNOTES: Record<WebPaymentMethod, string> = {
  stripe_card: 'Card checkout is processed by Stripe.',
  paystack_card: 'Card checkout is processed by Paystack.',
  paystack_mobile_money:
    'Mobile money (MTN MoMo, Telecel Cash, AirtelTigo Money) is processed by Paystack. Approve the prompt on your phone to finish.',
};

function isPaystackMethod(method: WebPaymentMethod): boolean {
  return method === 'paystack_card' || method === 'paystack_mobile_money';
}

/** Price shown on a package button for the selected method; null = not sold that way. */
function priceForMethod(pkg: TokenPackage, method: WebPaymentMethod | undefined): string | null {
  if (!method || !isPaystackMethod(method)) return pkg.price;
  if (!pkg.paystackAmountMinor) return null;
  return formatPaystackPrice(pkg.paystackAmountMinor, pkg.paystackCurrency || 'GHS');
}

const TokenShopView: React.FC<TokenShopViewProps> = ({
  currentTokens,
  packages,
  onPurchase,
  onBack,
  purchasePending = false,
  purchaseNotice,
  isNativeCheckout = false,
  paymentMethods = [],
}) => {
  const list = (packages && packages.length > 0 ? packages : getTokenPackages()).filter(
    (p) => p && typeof p.id === 'string'
  );
  const methods = isNativeCheckout ? [] : paymentMethods;
  const [selectedMethod, setSelectedMethod] = useState<WebPaymentMethod | undefined>(methods[0]);
  const method = selectedMethod && methods.includes(selectedMethod) ? selectedMethod : methods[0];
  return (
    <div className="min-h-full bg-white p-6 pb-28 text-zinc-900">
      <div className="mb-8 flex items-center justify-between">
        <BackButton variant="light" onClick={onBack} />
        <h1 className="text-xl font-bold text-zinc-900">Token Shop</h1>
        <div className="w-10" aria-hidden />
      </div>

      <div className="mb-10 rounded-3xl border border-pink-100 bg-gradient-to-br from-pink-50 via-white to-zinc-50 p-8 text-center shadow-sm">
        <div className="mb-4 text-5xl">💎</div>
        <p className="mb-1 text-sm font-medium uppercase tracking-widest text-zinc-500">Your Balance</p>
        <h2 className="text-5xl font-black text-zinc-900">{currentTokens}</h2>
        <p className="mt-4 text-xs text-zinc-600">Use tokens for video calls, live streams, and more</p>
      </div>

      <div className="space-y-4">
        <h3 className="px-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Top Up Packages</h3>
        {methods.length > 1 ? (
          <div role="radiogroup" aria-label="Payment method" className="flex flex-wrap gap-2 px-1">
            {methods.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={m === method}
                onClick={() => setSelectedMethod(m)}
                disabled={purchasePending}
                className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold transition-colors ${
                  m === method
                    ? 'border-pink-600 bg-pink-600 text-white'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:border-pink-200 hover:bg-pink-50'
                }`}
              >
                {METHOD_LABELS[m]}
              </button>
            ))}
          </div>
        ) : null}
        {purchaseNotice ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            {purchaseNotice}
          </div>
        ) : null}
        {list.map((pkg) => {
          const price = priceForMethod(pkg, method);
          const unavailable = price === null;
          return (
            <button
              key={pkg.id}
              type="button"
              onClick={() => onPurchase(pkg, method)}
              disabled={purchasePending || unavailable}
              className="group flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:border-pink-200 hover:bg-pink-50/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-100 text-2xl transition-transform group-hover:scale-110">
                  💎
                </div>
                <div className="text-left">
                  <h4 className="text-lg font-bold text-zinc-900">{pkg.tokens} Tokens</h4>
                  <p className="text-xs text-zinc-500">
                    {unavailable && method ? `Not available with ${METHOD_LABELS[method]}` : 'Best value for dating'}
                  </p>
                </div>
              </div>
              {unavailable ? null : (
                <div className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-bold text-white shadow-sm group-hover:bg-pink-500">
                  {purchasePending ? 'Processing…' : price}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-12 text-center">
        <p className="text-[10px] leading-relaxed text-zinc-500">
          By purchasing, you agree to Zongo&apos;s Terms of Service.{' '}
          {isNativeCheckout
            ? 'Payments are processed by the App Store or Google Play via RevenueCat.'
            : `${method ? METHOD_FOOTNOTES[method] : 'Checkout is processed securely.'} In the mobile apps, purchases use your App Store or Google Play account.`}
        </p>
      </div>
    </div>
  );
};

export default TokenShopView;
