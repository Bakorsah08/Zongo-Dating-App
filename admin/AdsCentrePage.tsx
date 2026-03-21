import React, { useState, useEffect, useRef } from 'react';
import type { ExploreSpotlight } from '../types';
import { adminStore, DEFAULT_EXPLORE_SPOTLIGHT } from './store';

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

const AdsCentrePage: React.FC = () => {
  const [draft, setDraft] = useState<ExploreSpotlight | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => setDraft(adminStore.getExploreSpotlight());

  useEffect(() => {
    load();
  }, []);

  const patch = (updates: Partial<ExploreSpotlight>) => {
    if (!draft) return;
    const next = { ...draft, ...updates };
    setDraft(next);
    adminStore.setExploreSpotlight(next);
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      window.alert('Image must be under 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') patch({ imageDataUrl: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const colorPickerValue =
    draft?.backgroundColor && /^#[0-9A-Fa-f]{6}$/.test(draft.backgroundColor)
      ? draft.backgroundColor
      : '#ec4899';

  if (!draft) return null;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white">Ad centre</h1>
        <p className="text-zinc-500 mt-1 max-w-2xl">
          Control the first card on the Explore grid. Use it for promos, events, and announcements. Only super admins can edit this.
        </p>
      </div>

      <div className="max-w-2xl space-y-8">
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => patch({ enabled: e.target.checked })}
              className="w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-rose-500 focus:ring-rose-500"
            />
            <div>
              <span className="text-white font-bold">Live on Explore</span>
              <p className="text-zinc-500 text-sm">When off, members see a neutral placeholder on that slot.</p>
            </div>
          </label>
        </section>

        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Card content</h2>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Badge label</label>
            <input
              type="text"
              value={draft.badgeLabel}
              onChange={(e) => patch({ badgeLabel: e.target.value })}
              placeholder="Promo"
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600"
            />
          </div>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Title</label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder={DEFAULT_EXPLORE_SPOTLIGHT.title}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600"
            />
          </div>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Subtitle</label>
            <input
              type="text"
              value={draft.subtitle}
              onChange={(e) => patch({ subtitle: e.target.value })}
              placeholder={DEFAULT_EXPLORE_SPOTLIGHT.subtitle}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600"
            />
          </div>
          <div className="pt-2 border-t border-zinc-800">
            <h3 className="text-sm font-bold text-zinc-300 mb-3">Background</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-zinc-500 text-sm mb-1">Background colour</label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="color"
                    aria-label="Pick background colour"
                    value={colorPickerValue}
                    onChange={(e) => patch({ backgroundColor: e.target.value })}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-zinc-600 bg-zinc-800"
                  />
                  <input
                    type="text"
                    value={draft.backgroundColor}
                    onChange={(e) => patch({ backgroundColor: e.target.value })}
                    placeholder="#ec4899 or rgb(236,72,153)"
                    className="min-w-[12rem] flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600"
                  />
                  <button
                    type="button"
                    onClick={() => patch({ backgroundColor: '' })}
                    className="px-3 py-2 text-xs font-bold text-zinc-400 hover:text-white rounded-xl border border-zinc-600 hover:border-zinc-500"
                  >
                    Clear colour
                  </button>
                </div>
                <p className="text-zinc-600 text-xs mt-1">
                  Used when no image is set. Default gradient is used if colour is empty.
                </p>
              </div>
              <div>
                <label className="block text-zinc-500 text-sm mb-1">Upload background image</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleBackgroundUpload}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold transition-colors"
                  >
                    Choose file…
                  </button>
                  {draft.imageDataUrl ? (
                    <button
                      type="button"
                      onClick={() => patch({ imageDataUrl: '' })}
                      className="px-3 py-2 text-xs font-bold text-zinc-400 hover:text-white rounded-xl border border-zinc-600"
                    >
                      Remove upload
                    </button>
                  ) : null}
                </div>
                {draft.imageDataUrl ? (
                  <div className="mt-3 flex items-start gap-3">
                    <img
                      src={draft.imageDataUrl}
                      alt="Upload preview"
                      className="h-24 w-20 object-cover rounded-lg border border-zinc-600"
                    />
                    <p className="text-zinc-500 text-xs pt-1">Uploaded image is shown before any image URL.</p>
                  </div>
                ) : (
                  <p className="text-zinc-600 text-xs mt-1">PNG, JPG, or WebP — max 2 MB. Stored in browser for this device.</p>
                )}
              </div>
              <div>
                <label className="block text-zinc-500 text-sm mb-1">Image URL (optional)</label>
                <input
                  type="url"
                  value={draft.imageUrl}
                  onChange={(e) => patch({ imageUrl: e.target.value })}
                  placeholder="https://…"
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600"
                />
                <p className="text-zinc-600 text-xs mt-1">
                  Remote image if you prefer a link. Upload above overrides this.
                </p>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Link URL (optional)</label>
            <input
              type="url"
              value={draft.linkUrl}
              onChange={(e) => patch({ linkUrl: e.target.value })}
              placeholder="https://…"
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600"
            />
            <p className="text-zinc-600 text-xs mt-1">Opens in a new tab when someone taps the card (only when live).</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdsCentrePage;
