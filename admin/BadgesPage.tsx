import React, { useState, useEffect } from 'react';
import type { BadgeInfo } from '../types';
import { adminStore } from './store';

const BadgesPage: React.FC = () => {
  const [badges, setBadges] = useState<BadgeInfo[]>([]);
  const [editing, setEditing] = useState<BadgeInfo | null>(null);

  const loadBadges = () => setBadges(adminStore.getBadges());

  useEffect(() => {
    loadBadges();
  }, []);

  const handleSave = (updates: Partial<BadgeInfo>) => {
    if (!editing) return;
    adminStore.updateBadge(editing.id, updates);
    loadBadges();
    setEditing(null);
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white">Badges</h1>
        <p className="text-zinc-500 mt-1">Manage VIP badge tiers and pricing</p>
      </div>

      <div className="grid gap-4">
        {badges.filter((b) => b.id !== 'none').map((badge) => (
          <div
            key={badge.id}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <span className="text-4xl">{badge.icon || '🏅'}</span>
              <div>
                <p className="font-bold text-lg">{badge.name}</p>
                <p className="text-zinc-500 text-sm">
                  {badge.tokenCost} tokens • Min earnings: ${badge.minEarningsToEarn.toLocaleString()} • Rank: {badge.rank}
                </p>
              </div>
            </div>
            <button
              onClick={() => setEditing(badge)}
              className="px-4 py-2 bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 rounded-xl font-medium"
            >
              Edit
            </button>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-xl font-bold">Edit Badge: {editing.name}</h2>
              <button onClick={() => setEditing(null)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white">✕</button>
            </div>
            <BadgeEditForm badge={editing} onSave={handleSave} onClose={() => setEditing(null)} />
          </div>
        </div>
      )}
    </div>
  );
};

const BadgeEditForm: React.FC<{
  badge: BadgeInfo;
  onSave: (updates: Partial<BadgeInfo>) => void;
  onClose: () => void;
}> = ({ badge, onSave, onClose }) => {
  const [form, setForm] = useState({
    name: badge.name,
    icon: badge.icon,
    tokenCost: badge.tokenCost,
    minEarningsToEarn: badge.minEarningsToEarn,
    rank: badge.rank,
  });

  return (
    <>
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-zinc-500 text-sm mb-1">Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-zinc-500 text-sm mb-1">Icon (emoji)</label>
          <input
            value={form.icon}
            onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
            className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-zinc-500 text-sm mb-1">Token Cost</label>
          <input
            type="number"
            value={form.tokenCost}
            onChange={(e) => setForm((f) => ({ ...f, tokenCost: parseInt(e.target.value) || 0 }))}
            className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-zinc-500 text-sm mb-1">Min Earnings to Earn (free)</label>
          <input
            type="number"
            value={form.minEarningsToEarn}
            onChange={(e) => setForm((f) => ({ ...f, minEarningsToEarn: parseInt(e.target.value) || 0 }))}
            className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-zinc-500 text-sm mb-1">Rank (higher = better explore position)</label>
          <input
            type="number"
            value={form.rank}
            onChange={(e) => setForm((f) => ({ ...f, rank: parseInt(e.target.value) || 0 }))}
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

export default BadgesPage;
