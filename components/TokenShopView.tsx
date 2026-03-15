
import React from 'react';
import { getTokenPackages } from '../data';
interface TokenShopViewProps {
  currentTokens: number;
  onPurchase: (tokens: number, packagePriceUsd?: number) => void;
  onBack: () => void;
}

const parsePriceUsd = (price: string): number => parseFloat(price.replace(/[^0-9.]/g, '')) || 0;

const TokenShopView: React.FC<TokenShopViewProps> = ({ currentTokens, onPurchase, onBack }) => {
  return (
    <div className="p-6 bg-zinc-950 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="text-zinc-400">Back</button>
        <h1 className="text-xl font-bold">Token Shop</h1>
        <div className="w-8"></div>
      </div>

      <div className="bg-gradient-to-br from-zinc-900 to-black p-8 rounded-3xl border border-zinc-800 text-center mb-10 shadow-2xl">
        <div className="text-5xl mb-4">💎</div>
        <p className="text-zinc-400 text-sm mb-1 uppercase tracking-widest font-medium">Your Balance</p>
        <h2 className="text-5xl font-black text-white">{currentTokens}</h2>
        <p className="text-zinc-500 text-xs mt-4">Use tokens for Video Calls and Live Streams</p>
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-zinc-500 uppercase text-xs tracking-widest px-2">Top Up Packages</h3>
        {getTokenPackages().map((pkg) => (
          <button 
            key={pkg.id}
            onClick={() => onPurchase(pkg.tokens, parsePriceUsd(pkg.price))}
            className="w-full group bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 p-5 rounded-2xl flex items-center justify-between transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-pink-600/10 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">💎</div>
              <div className="text-left">
                <h4 className="font-bold text-lg">{pkg.tokens} Tokens</h4>
                <p className="text-zinc-500 text-xs">Best value for dating</p>
              </div>
            </div>
            <div className="bg-white text-black font-bold px-4 py-2 rounded-xl text-sm">
              {pkg.price}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-12 text-center">
        <p className="text-[10px] text-zinc-600">
          By purchasing, you agree to HeartSync Terms of Service.
          Payments are handled securely via your App Store account.
        </p>
      </div>
    </div>
  );
};

export default TokenShopView;
