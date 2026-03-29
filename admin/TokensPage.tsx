import React, { useState, useEffect } from 'react';
import type { TokenPackage } from '../types';
import { adminStore } from './store';
import InlineErrorBanner from '../components/InlineErrorBanner';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import {
  fetchActiveTokenPackagesFromDb,
  adminUpsertTokenPackageDb,
  adminDeleteTokenPackageDb,
} from '../services/supabaseTokenPackages';

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
      const list = await fetchActiveTokenPackagesFromDb();
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
      });
      if (!res.ok) {
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
      });
      if (!res.ok) {
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
        if (!res.ok) {
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
          <p className="text-zinc-500 mt-1">Manage token purchase options</p>
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
  const [form, setForm] = useState({ tokens: pkg.tokens, price: pkg.price });

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
          <label className="block text-zinc-500 text-sm mb-1">Price</label>
          <input
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            placeholder="$4.99"
            className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
          />
        </div>
      </div>
      <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">Cancel</button>
        <button onClick={() => onSave(form)} className="px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl">
          Save
        </button>
      </div>
    </>
  );
};

const TokenAddModal: React.FC<{ onAdd: (pkg: TokenPackage) => void; onClose: () => void }> = ({ onAdd, onClose }) => {
  const [tokens, setTokens] = useState(100);
  const [price, setPrice] = useState('$4.99');

  const handleSubmit = () => {
    const id = `p${Date.now()}`;
    onAdd({ id, tokens, price });
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
            <label className="block text-zinc-500 text-sm mb-1">Price</label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="$4.99"
              className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
            />
          </div>
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
