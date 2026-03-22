import React, { useState, useEffect } from 'react';
import type { MonetizationSettings, UserAdDurationTier } from '../types';
import { adminStore } from './store';
import { useAuthContext } from '../auth/AuthContext';

const MAX_USER_AD_TIERS = 10;

function newTierId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `uadt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const MonetizationPage: React.FC = () => {
  const { session } = useAuthContext();
  const isSuperAdmin = session?.user.role === 'super_admin';
  const [settings, setSettings] = useState<MonetizationSettings | null>(null);

  const load = () => setSettings(adminStore.getMonetizationSettings());

  useEffect(() => {
    load();
  }, []);

  const handleSave = (updates: Partial<MonetizationSettings>) => {
    if (!settings) return;
    adminStore.setMonetizationSettings({ ...settings, ...updates });
    load();
  };

  if (!settings) return null;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white">Monetization Settings</h1>
        <p className="text-zinc-500 mt-1">Token costs, feature flags, and revenue controls</p>
      </div>

      <div className="space-y-8 max-w-2xl">
        {/* Token costs */}
        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">Token Costs</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-zinc-500 text-sm mb-1">Starter tokens (new users)</label>
              <input
                type="number"
                min={0}
                value={settings.starterTokens}
                onChange={(e) => handleSave({ starterTokens: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-zinc-500 text-sm mb-1">Live stream entry (tokens)</label>
              <input
                type="number"
                min={0}
                value={settings.liveStreamEntryTokens}
                onChange={(e) => handleSave({ liveStreamEntryTokens: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-zinc-500 text-sm mb-1">Video call — connection (tokens)</label>
              <input
                type="number"
                min={0}
                value={settings.videoCallTokens}
                onChange={(e) => handleSave({ videoCallTokens: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-zinc-500 text-sm mb-1">Video call — per ~10s while connected</label>
              <input
                type="number"
                min={0}
                value={settings.videoCallPerIntervalTokens}
                onChange={(e) => handleSave({ videoCallPerIntervalTokens: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-zinc-500 text-sm mb-1">Super Like (tokens)</label>
              <input
                type="number"
                min={0}
                value={settings.superLikeTokens}
                onChange={(e) => handleSave({ superLikeTokens: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
              />
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800">
            <h3 className="text-sm font-bold text-zinc-300 mb-2">User Explore ads (campaign length &amp; cost)</h3>
            <p className="text-xs text-zinc-500 mb-4">
              Define up to {MAX_USER_AD_TIERS} pricing options. Users choose one from a dropdown when they submit an ad.
              They pay tokens on submit; rejected ads are refunded.{' '}
              <span className="text-zinc-600 dark:text-zinc-400">
                Only the super admin can add, remove, or edit campaign length (days). Anyone with this page can set token
                costs.
              </span>
            </p>
            {!isSuperAdmin ? (
              <p className="text-xs text-amber-400/90 mb-3">
                You are signed in as {session?.user.role?.replace('_', ' ') ?? 'admin'}. Add/remove options and change
                duration require a super admin account.
              </p>
            ) : null}
            <div className="space-y-3">
              {[...settings.userAdDurationTiers]
                .sort((a, b) => a.durationDays - b.durationDays)
                .map((tier) => (
                  <div
                    key={tier.id}
                    className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-200 dark:bg-zinc-800/40 p-3"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase tracking-wide text-zinc-500">Length (days)</span>
                      {isSuperAdmin ? (
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={tier.durationDays}
                          onChange={(e) => {
                            const durationDays = Math.max(1, Math.min(365, parseInt(e.target.value, 10) || 1));
                            const next = settings.userAdDurationTiers.map((t) =>
                              t.id === tier.id ? { ...t, durationDays } : t
                            );
                            handleSave({ userAdDurationTiers: next });
                          }}
                          className="w-24 px-3 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white text-sm"
                        />
                      ) : (
                        <span className="text-sm text-zinc-200 py-2">{tier.durationDays} days</span>
                      )}
                    </div>
                    <label className="flex flex-col gap-1 text-sm text-zinc-500">
                      <span className="text-[10px] uppercase tracking-wide">Tokens</span>
                      <input
                        type="number"
                        min={0}
                        value={tier.tokenCost}
                        onChange={(e) => {
                          const tokenCost = Math.max(0, parseInt(e.target.value, 10) || 0);
                          const next = settings.userAdDurationTiers.map((t) =>
                            t.id === tier.id ? { ...t, tokenCost } : t
                          );
                          handleSave({ userAdDurationTiers: next });
                        }}
                        className="w-28 px-3 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
                      />
                    </label>
                    {isSuperAdmin ? (
                      <button
                        type="button"
                        onClick={() => {
                          const next = settings.userAdDurationTiers.filter((t) => t.id !== tier.id);
                          handleSave({ userAdDurationTiers: next });
                        }}
                        className="ml-auto text-xs font-bold text-red-400 hover:text-red-300 px-2 py-2"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
            </div>
            {isSuperAdmin ? (
              <button
                type="button"
                disabled={settings.userAdDurationTiers.length >= MAX_USER_AD_TIERS}
                onClick={() => {
                  if (settings.userAdDurationTiers.length >= MAX_USER_AD_TIERS) return;
                  const next: UserAdDurationTier[] = [
                    ...settings.userAdDurationTiers,
                    { id: newTierId(), durationDays: 7, tokenCost: 50 },
                  ];
                  handleSave({ userAdDurationTiers: next });
                }}
                className="mt-4 rounded-xl border border-zinc-400 dark:border-zinc-600 bg-zinc-200 dark:bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:pointer-events-none"
              >
                Add pricing option ({settings.userAdDurationTiers.length}/{MAX_USER_AD_TIERS})
              </button>
            ) : null}
          </div>
        </section>

        {/* Feature flags */}
        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">Feature Flags</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.liveStreamingEnabled}
                onChange={(e) => handleSave({ liveStreamingEnabled: e.target.checked })}
                className="rounded bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-rose-500"
              />
              <span>Live streaming enabled</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.giftingEnabled}
                onChange={(e) => handleSave({ giftingEnabled: e.target.checked })}
                className="rounded bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-rose-500"
              />
              <span>Gifting in live streams enabled</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.videoCallEnabled}
                onChange={(e) => handleSave({ videoCallEnabled: e.target.checked })}
                className="rounded bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-rose-500"
              />
              <span>Video call enabled</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.vipBadgesEnabled}
                onChange={(e) => handleSave({ vipBadgesEnabled: e.target.checked })}
                className="rounded bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-rose-500"
              />
              <span>VIP badges enabled (Explore ranking)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.creatorCashoutEnabled}
                onChange={(e) => handleSave({ creatorCashoutEnabled: e.target.checked })}
                className="rounded bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-rose-500"
              />
              <span>Creator cash-out enabled (MVP: keep off)</span>
            </label>
          </div>
        </section>

        {/* Revenue */}
        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">Revenue</h2>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Creator revenue share (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={settings.creatorRevenueSharePercent}
              onChange={(e) => handleSave({ creatorRevenueSharePercent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
              className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white max-w-xs"
            />
            <p className="text-xs text-zinc-500 mt-1">Platform keeps the remainder. Used when cash-out is enabled.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default MonetizationPage;
