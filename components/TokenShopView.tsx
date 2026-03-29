import React from 'react';
import { getTokenPackages } from '../data';
import type { TokenPackage } from '../types';
import BackButton from './BackButton';

interface TokenShopViewProps {
  currentTokens: number;
  packages?: TokenPackage[];
  onPurchase: (pkg: TokenPackage) => Promise<void> | void;
  onBack: () => void;
  purchasePending?: boolean;
  purchaseNotice?: string | null;
}

const TokenShopView: React.FC<TokenShopViewProps> = ({
  currentTokens,
  packages,
  onPurchase,
  onBack,
  purchasePending = false,
  purchaseNotice,
}) => {
  const list = (packages && packages.length > 0 ? packages : getTokenPackages()).filter(
    (p) => p && typeof p.id === 'string'
  );
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
        {purchaseNotice ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            {purchaseNotice}
          </div>
        ) : null}
        {list.map((pkg) => (
          <button
            key={pkg.id}
            type="button"
            onClick={() => onPurchase(pkg)}
            disabled={purchasePending}
            className="group flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:border-pink-200 hover:bg-pink-50/40 active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-100 text-2xl transition-transform group-hover:scale-110">
                💎
              </div>
              <div className="text-left">
                <h4 className="text-lg font-bold text-zinc-900">{pkg.tokens} Tokens</h4>
                <p className="text-xs text-zinc-500">Best value for dating</p>
              </div>
            </div>
            <div className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-bold text-white shadow-sm group-hover:bg-pink-500">
              {purchasePending ? 'Processing…' : pkg.price}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-12 text-center">
        <p className="text-[10px] leading-relaxed text-zinc-500">
          By purchasing, you agree to Zongo&apos;s Terms of Service. On the web, checkout is processed by Stripe;
          in the mobile apps, purchases use your App Store or Google Play account with RevenueCat.
        </p>
      </div>
    </div>
  );
};

export default TokenShopView;
