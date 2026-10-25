import React, { useState, useEffect } from 'react';
import type { TokenPackage } from '../types';
import { adminStore } from './store';
import InlineErrorBanner from '../components/InlineErrorBanner';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import {
  fetchTokenPackagesForAdminFromDb,
  adminUpsertTokenPackageDb,
  adminDeleteTokenPackageDb,
} from '../services/supabaseTokenPackages';
import { formatPaystackPrice } from '../services/payments';

/** "75" or "75.50" → 7500 / 7550 minor units; blank or invalid → null. */
function paystackMajorToMinor(value: string): number | null {
  const n = parseFloat(value.trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function paystackMinorToMajor(minor: number | null | undefined): string {
  return minor ? (minor / 100).toFixed(2) : '';
}

const PAYSTACK_CURRENCIES = ['GHS', 'NGN', 'KES', 'ZAR', 'USD'];

const inputClass =
  'w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white';

const PaystackPriceFields: React.FC<{
  amount: string;
  currency: string;
  onAmountChange: (v: string) => void;
  onCurrencyChange: (v: string) => void;
}> = ({ amount, currency, onAmountChange, onCurrencyChange }) => (
  <div>
    <label className="block text-zinc-500 text-sm mb-1">Paystack price (card + mobile money)</label>
    <div className="flex gap-2">
      <select
        value={currency}
        onChange={(e) => onCurrencyChange(e.target.value)}
        aria-label="Paystack currency"
        className={`${inputClass} w-28`}
      >
        {PAYSTACK_CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        value={amount}
        onChange={(e) => onAmountChange(e.target.value)}
        placeholder="75.00"
        aria-label="Paystack amount"
        className={inputClass}
      />
    </div>
    <p className="text-xs text-zinc-500 mt-1">
      Leave blank to hide this package for Paystack. Mobile money needs GHS or KES.
    </p>
  </div>
);

const TokensPage: React.FC = () => {
  const [packages, setPackages] = useState<TokenPackage[]>([]);
  const [editing, setEditing] = useState<TokenPackage | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabaseEnabled = isSupabaseConfigured();

  const loadPackages = async () => {
    setError(null);
    if (!supabaseEnabled) {
      setPackages(adminStore.getTokenPackages());
      return;
    }
    try {
      const list = await fetchTokenPackagesForAdminFromDb();
      setPackages(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load token packages.');
      setPackages([]);
    }
  };

  useEffect(() => {
    void loadPackages();
  }, []);

  const handleSave = (updates: Partial<TokenPackage>) => {
    if (!editing) return;
    const next = { ...editing, ...updates };
    void (async () => {
      setError(null);
      if (!supabaseEnabled) {
        adminStore.updateTokenPackage(editing.id, updates);
        setEditing(null);
        setPackages(adminStore.getTokenPackages());
        return;
      }
      const res = await adminUpsertTokenPackageDb({
        id: next.id,
        tokens: next.tokens,
        display_price: next.price,
        stripe_price_id: next.stripePriceId ?? null,
        revenuecat_product_id: next.revenuecatProductId ?? null,
        paystack_amount_minor: next.paystackAmountMinor ?? null,
        paystack_currency: next.paystackCurrency ?? null,
      });
      if (res.ok === false) {
        setError(res.error);
        return;
      }
      setEditing(null);
      await loadPackages();
    })();
  };

  const handleAdd = (pkg: TokenPackage) => {
    void (async () => {
      setError(null);
      if (!supabaseEnabled) {
        adminStore.addTokenPackage(pkg);
        setShowAdd(false);
        setPackages(adminStore.getTokenPackages());
        return;
      }
      const res = await adminUpsertTokenPackageDb({
        id: pkg.id,
        tokens: pkg.tokens,
        display_price: pkg.price,
        stripe_price_id: pkg.stripePriceId ?? null,
        revenuecat_product_id: pkg.revenuecatProductId ?? null,
        paystack_amount_minor: pkg.paystackAmountMinor ?? null,
        paystack_currency: pkg.paystackCurrency ?? null,
      });
      if (res.ok === false) {
        setError(res.error);
        return;
      }
      setShowAdd(false);
      await loadPackages();
    })();
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this token package?')) {
      void (async () => {
        setError(null);
        if (!supabaseEnabled) {
          adminStore.deleteTokenPackage(id);
          setEditing(null);
          setPackages(adminStore.getTokenPackages());
          return;
        }
        const res = await adminDeleteTokenPackageDb(id);
        if (res.ok === false) {
          setError(res.error);
          return;
        }
        setEditing(null);
        await loadPackages();
      })();
    }
  };

  return (
    <div className="p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white">Token Packages</h1>
          <p className="text-zinc-500 mt-1">
            Manage token packages. Link Stripe Price ids and Paystack prices (web) and store product ids (iOS / Android via RevenueCat).
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-colors"
        >
          + Add Package
        </button>
      </div>

      {error ? (
        <InlineErrorBanner
          message={error}
          onRetry={() => void loadPackages()}
          onDismiss={() => setError(null)}
          className="mb-4"
        />
      ) : null}

      <div className="grid gap-4">
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <span className="text-4xl">💎</span>
              <div>
                <p className="font-bold text-lg">{pkg.tokens} Tokens</p>
                <p className="text-zinc-500 text-sm">{pkg.price}</p>
                {(pkg.stripePriceId || pkg.revenuecatProductId || pkg.paystackAmountMinor) && (
                  <p className="text-zinc-400 text-xs mt-1 font-mono">
                    {[
                      pkg.stripePriceId ? `Stripe: ${pkg.stripePriceId}` : null,
                      pkg.paystackAmountMinor
                        ? `Paystack: ${formatPaystackPrice(pkg.paystackAmountMinor, pkg.paystackCurrency || 'GHS')}`
                        : null,
                      pkg.revenuecatProductId ? `Store: ${pkg.revenuecatProductId}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(pkg)}
                className="px-4 py-2 bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 rounded-xl font-medium"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(pkg.id)}
                className="px-4 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-xl font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-xl font-bold">Edit Package</h2>
              <button onClick={() => setEditing(null)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white">✕</button>
            </div>
            <TokenEditForm pkg={editing} onSave={handleSave} onClose={() => setEditing(null)} />
          </div>
        </div>
      )}

      {showAdd && (
        <TokenAddModal onAdd={handleAdd} onClose={() => setShowAdd(false)} />
      )}
    </div>
  );
};

const TokenEditForm: React.FC<{
  pkg: TokenPackage;
  onSave: (updates: Partial<TokenPackage>) => void;
  onClose: () => void;
}> = ({ pkg, onSave, onClose }) => {
  const [form, setForm] = useState({
    tokens: pkg.tokens,
    price: pkg.price,
    stripePriceId: pkg.stripePriceId ?? '',
    revenuecatProductId: pkg.revenuecatProductId ?? '',
    paystackAmount: paystackMinorToMajor(pkg.paystackAmountMinor),
    paystackCurrency: pkg.paystackCurrency || 'GHS',
  });

  return (
    <>
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-zinc-500 text-sm mb-1">Tokens</label>
          <input
            type="number"
            value={form.tokens}
            onChange={(e) => setForm((f) => ({ ...f, tokens: parseInt(e.target.value) || 0 }))}
            className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-zinc-500 text-sm mb-1">Display price</label>
          <input
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            placeholder="$4.99"
            className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-zinc-500 text-sm mb-1">Stripe Price id (web)</label>
          <input
            value={form.stripePriceId}
            onChange={(e) => setForm((f) => ({ ...f, stripePriceId: e.target.value }))}
            placeholder="price_..."
            className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white font-mono text-sm"
          />
        </div>
        <div>
          <label className="block text-zinc-500 text-sm mb-1">Store product id (RevenueCat)</label>
          <input
            value={form.revenuecatProductId}
            onChange={(e) => setForm((f) => ({ ...f, revenuecatProductId: e.target.value }))}
            placeholder="zongo_tokens_100"
            className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white font-mono text-sm"
          />
          <p className="text-xs text-zinc-500 mt-1">
            Same SKU in App Store Connect and Google Play; must match RevenueCat product id.
          </p>
        </div>
        <PaystackPriceFields
          amount={form.paystackAmount}
          currency={form.paystackCurrency}
          onAmountChange={(v) => setForm((f) => ({ ...f, paystackAmount: v }))}
          onCurrencyChange={(v) => setForm((f) => ({ ...f, paystackCurrency: v }))}
        />
      </div>
      <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">Cancel</button>
        <button
          onClick={() =>
            onSave({
              tokens: form.tokens,
              price: form.price,
              stripePriceId: form.stripePriceId.trim() || null,
              revenuecatProductId: form.revenuecatProductId.trim() || null,
              paystackAmountMinor: paystackMajorToMinor(form.paystackAmount),
              paystackCurrency: form.paystackCurrency,
            })
          }
          className="px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl"
        >
          Save
        </button>
      </div>
    </>
  );
};

const TokenAddModal: React.FC<{ onAdd: (pkg: TokenPackage) => void; onClose: () => void }> = ({ onAdd, onClose }) => {
  const [tokens, setTokens] = useState(100);
  const [price, setPrice] = useState('$4.99');
  const [stripePriceId, setStripePriceId] = useState('');
  const [revenuecatProductId, setRevenuecatProductId] = useState('');
  const [paystackAmount, setPaystackAmount] = useState('');
  const [paystackCurrency, setPaystackCurrency] = useState('GHS');

  const handleSubmit = () => {
    const id = `p${Date.now()}`;
    onAdd({
      id,
      tokens,
      price,
      stripePriceId: stripePriceId.trim() || null,
      revenuecatProductId: revenuecatProductId.trim() || null,
      paystackAmountMinor: paystackMajorToMinor(paystackAmount),
      paystackCurrency,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="text-xl font-bold">Add Token Package</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Tokens</label>
            <input
              type="number"
              value={tokens}
              onChange={(e) => setTokens(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Display price</label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="$4.99"
              className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Stripe Price id (web)</label>
            <input
              value={stripePriceId}
              onChange={(e) => setStripePriceId(e.target.value)}
              placeholder="price_..."
              className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Store product id (RevenueCat)</label>
            <input
              value={revenuecatProductId}
              onChange={(e) => setRevenuecatProductId(e.target.value)}
              placeholder="zongo_tokens_100"
              className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white font-mono text-sm"
            />
          </div>
          <PaystackPriceFields
            amount={paystackAmount}
            currency={paystackCurrency}
            onAmountChange={setPaystackAmount}
            onCurrencyChange={setPaystackCurrency}
          />
        </div>
        <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">Cancel</button>
          <button onClick={handleSubmit} className="px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl">
            Add
          </button>
        </div>
      </div>
    </div>
  );
};

export default TokensPage;
