import React, { useState, useEffect } from 'react';
import type { Gift } from '../types';
import { adminStore } from './store';

const GIFT_EMOJIS = [
  '🎁', '🌹', '💐', '🌸', '🌺', '🌻', '🌷', '💮', '🏵️', '💖',
  '💕', '💗', '💓', '💞', '💘', '❤️', '🧡', '💛', '💚', '💙',
  '💜', '🖤', '🤍', '🤎', '💝', '💟', '☕', '🍫', '🍕', '🍰',
  '🎂', '🍩', '🍪', '🧁', '🍬', '🍭', '🍡', '🍧', '🍦', '🍨',
  '💎', '👑', '🏆', '🥇', '🥈', '🥉', '🎖️', '⭐', '🌟', '✨',
  '💫', '🔥', '💥', '🎉', '🎊', '🎈', '🎀', '🦋', '🐝', '🐞',
  '🦄', '🐰', '🐱', '🐶', '🐻', '🐼', '🦊', '🐨', '🦁', '🐯',
  '🌙', '☀️', '🌈', '☁️', '❄️', '🌊', '🏝️', '🚀', '✈️', '🚗',
  '🎸', '🎹', '🎤', '🎧', '🎬', '📷', '📸', '💻', '📱', '⌚',
  '👜', '👠', '💄', '💍', '🪷', '🌴', '🍀', '🪻', '🌼', '🌵',
];

const GiftsPage: React.FC = () => {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [editing, setEditing] = useState<Gift | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const loadGifts = () => setGifts(adminStore.getGifts());

  useEffect(() => {
    loadGifts();
  }, []);

  const handleSave = (updates: Partial<Gift>) => {
    if (!editing) return;
    adminStore.updateGift(editing.id, updates);
    loadGifts();
    setEditing(null);
  };

  const handleAdd = (gift: Gift) => {
    adminStore.addGift(gift);
    loadGifts();
    setShowAdd(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this gift?')) {
      adminStore.deleteGift(id);
      loadGifts();
      setEditing(null);
    }
  };

  return (
    <div className="p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white">Gifts</h1>
          <p className="text-zinc-500 mt-1">Manage gifts for live streams</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-colors"
        >
          + Add Gift
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {gifts.map((gift) => (
          <div
            key={gift.id}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 flex flex-col items-center text-center"
          >
            <span className="text-5xl mb-3">{gift.icon}</span>
            <p className="font-bold text-lg">{gift.name}</p>
            <p className="text-zinc-500 text-sm">${gift.value} value</p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setEditing(gift)}
                className="px-3 py-1.5 bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 rounded-lg text-sm font-medium"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(gift.id)}
                className="px-3 py-1.5 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg text-sm font-medium"
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
              <h2 className="text-xl font-bold">Edit Gift</h2>
              <button onClick={() => setEditing(null)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white">✕</button>
            </div>
            <GiftEditForm gift={editing} onSave={handleSave} onClose={() => setEditing(null)} />
          </div>
        </div>
      )}

      {showAdd && (
        <GiftAddModal onAdd={handleAdd} onClose={() => setShowAdd(false)} />
      )}
    </div>
  );
};

const GiftEditForm: React.FC<{
  gift: Gift;
  onSave: (updates: Partial<Gift>) => void;
  onClose: () => void;
}> = ({ gift, onSave, onClose }) => {
  const [form, setForm] = useState({ name: gift.name, icon: gift.icon, value: gift.value });

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
          <select
            value={form.icon}
            onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
            className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
          >
            {!GIFT_EMOJIS.includes(form.icon) && (
              <option value={form.icon}>{form.icon}</option>
            )}
            {GIFT_EMOJIS.map((emoji) => (
              <option key={emoji} value={emoji}>{emoji}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-zinc-500 text-sm mb-1">Value (tokens)</label>
          <input
            type="number"
            value={form.value}
            onChange={(e) => setForm((f) => ({ ...f, value: parseInt(e.target.value) || 0 }))}
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

const GiftAddModal: React.FC<{ onAdd: (gift: Gift) => void; onClose: () => void }> = ({ onAdd, onClose }) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🎁');
  const [value, setValue] = useState(10);

  const handleSubmit = () => {
    if (!name.trim()) {
      alert('Name is required');
      return;
    }
    const id = `g${Date.now()}`;
    onAdd({ id, name: name.trim(), icon, value });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="text-xl font-bold">Add Gift</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rose"
              className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Icon (emoji)</label>
            <select
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
            >
              {GIFT_EMOJIS.map((emoji) => (
                <option key={emoji} value={emoji}>{emoji}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Value (tokens)</label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(parseInt(e.target.value) || 0)}
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

export default GiftsPage;
