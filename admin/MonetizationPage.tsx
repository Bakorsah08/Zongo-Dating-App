import React, { useState, useEffect } from 'react';
import type { MonetizationSettings } from '../types';
import { adminStore } from './store';

const MonetizationPage: React.FC = () => {
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
        <h1 className="text-3xl font-black text-white">Monetization Settings</h1>
        <p className="text-zinc-500 mt-1">Token costs, feature flags, and revenue controls</p>
      </div>

      <div className="space-y-8 max-w-2xl">
        {/* Token costs */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Token Costs</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-zinc-500 text-sm mb-1">Starter tokens (new users)</label>
              <input
                type="number"
                min={0}
                value={settings.starterTokens}
                onChange={(e) => handleSave({ starterTokens: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              />
            </div>
            <div>
              <label className="block text-zinc-500 text-sm mb-1">Live stream entry (tokens)</label>
              <input
                type="number"
                min={0}
                value={settings.liveStreamEntryTokens}
                onChange={(e) => handleSave({ liveStreamEntryTokens: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              />
            </div>
            <div>
              <label className="block text-zinc-500 text-sm mb-1">Video call (tokens)</label>
              <input
                type="number"
                min={0}
                value={settings.videoCallTokens}
                onChange={(e) => handleSave({ videoCallTokens: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              />
            </div>
            <div>
              <label className="block text-zinc-500 text-sm mb-1">Super Like (tokens)</label>
              <input
                type="number"
                min={0}
                value={settings.superLikeTokens}
                onChange={(e) => handleSave({ superLikeTokens: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              />
            </div>
          </div>
        </section>

        {/* Feature flags */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Feature Flags</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.liveStreamingEnabled}
                onChange={(e) => handleSave({ liveStreamingEnabled: e.target.checked })}
                className="rounded bg-zinc-800 border-zinc-700 text-rose-500"
              />
              <span>Live streaming enabled</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.giftingEnabled}
                onChange={(e) => handleSave({ giftingEnabled: e.target.checked })}
                className="rounded bg-zinc-800 border-zinc-700 text-rose-500"
              />
              <span>Gifting in live streams enabled</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.videoCallEnabled}
                onChange={(e) => handleSave({ videoCallEnabled: e.target.checked })}
                className="rounded bg-zinc-800 border-zinc-700 text-rose-500"
              />
              <span>Video call enabled</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.vipBadgesEnabled}
                onChange={(e) => handleSave({ vipBadgesEnabled: e.target.checked })}
                className="rounded bg-zinc-800 border-zinc-700 text-rose-500"
              />
              <span>VIP badges enabled (Explore ranking)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.creatorCashoutEnabled}
                onChange={(e) => handleSave({ creatorCashoutEnabled: e.target.checked })}
                className="rounded bg-zinc-800 border-zinc-700 text-rose-500"
              />
              <span>Creator cash-out enabled (MVP: keep off)</span>
            </label>
          </div>
        </section>

        {/* Revenue */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Revenue</h2>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Creator revenue share (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={settings.creatorRevenueSharePercent}
              onChange={(e) => handleSave({ creatorRevenueSharePercent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white max-w-xs"
            />
            <p className="text-xs text-zinc-500 mt-1">Platform keeps the remainder. Used when cash-out is enabled.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default MonetizationPage;
