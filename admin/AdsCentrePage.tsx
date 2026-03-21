import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ExploreCarouselAd } from '../types';
import { adminStore, DEFAULT_NEW_EXPLORE_AD, normalizeExploreCarouselAd } from './store';

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

function adThumbSrc(ad: ExploreCarouselAd): string | null {
  if (ad.imageDataUrl.trim()) return ad.imageDataUrl.trim();
  if (ad.imageUrl.trim()) return ad.imageUrl.trim();
  return null;
}

const AdsCentrePage: React.FC = () => {
  const [ads, setAds] = useState<ExploreCarouselAd[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const syncFromStore = useCallback(() => {
    const list = adminStore.getExploreCarousel().ads;
    setAds(list);
    setSelectedId((prev) => {
      if (prev && list.some((a) => a.id === prev)) return prev;
      return list[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    syncFromStore();
  }, [syncFromStore]);

  const commitAds = (next: ExploreCarouselAd[]) => {
    adminStore.setExploreCarouselAds(next);
    setAds(next);
    setSelectedId((prev) => {
      if (prev && next.some((a) => a.id === prev)) return prev;
      return next[0]?.id ?? null;
    });
  };

  const selected = selectedId ? ads.find((a) => a.id === selectedId) : undefined;

  const patchSelected = (updates: Partial<ExploreCarouselAd>) => {
    if (!selectedId) return;
    const next = ads.map((a) =>
      a.id === selectedId ? normalizeExploreCarouselAd({ ...a, ...updates, id: a.id }) : a
    );
    commitAds(next);
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
      if (typeof reader.result === 'string') patchSelected({ imageDataUrl: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const addAd = () => {
    const n = DEFAULT_NEW_EXPLORE_AD();
    commitAds([...ads, n]);
    setSelectedId(n.id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    if (!window.confirm('Delete this ad? This cannot be undone.')) return;
    const next = ads.filter((a) => a.id !== selectedId);
    commitAds(next);
  };

  const colorPickerValue =
    selected?.backgroundColor && /^#[0-9A-Fa-f]{6}$/.test(selected.backgroundColor)
      ? selected.backgroundColor
      : '#ec4899';

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white">Ad centre</h1>
        <p className="text-zinc-500 mt-1 max-w-2xl">
          Add as many ads as you need for the first Explore tile. Tick <strong className="text-zinc-400">Live on Explore</strong> on each ad you want in the carousel. Set how long each slide shows before advancing.
        </p>
      </div>

      <div className="flex flex-col gap-10 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 max-w-xl space-y-6">
          {selected ? (
            <>
              <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.enabled}
                    onChange={(e) => patchSelected({ enabled: e.target.checked })}
                    className="w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-rose-500 focus:ring-rose-500"
                  />
                  <div>
                    <span className="text-white font-bold">Live on Explore</span>
                    <p className="text-zinc-500 text-sm">
                      Only ads with this checked appear in the rotating carousel in the app.
                    </p>
                  </div>
                </label>
              </section>

              <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-white">Edit ad</h2>
                  <button
                    type="button"
                    onClick={deleteSelected}
                    className="px-4 py-2 rounded-xl border border-red-500/50 text-red-400 text-sm font-bold hover:bg-red-500/10"
                  >
                    Delete ad
                  </button>
                </div>
                <div>
                  <label className="block text-zinc-500 text-sm mb-1">Display time (seconds)</label>
                  <input
                    type="number"
                    min={3}
                    max={120}
                    value={selected.displayDurationSec}
                    onChange={(e) =>
                      patchSelected({
                        displayDurationSec: Math.min(120, Math.max(3, parseInt(e.target.value, 10) || 8)),
                      })
                    }
                    className="w-full max-w-[12rem] px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
                  />
                  <p className="text-zinc-600 text-xs mt-1">How long this slide stays visible before the next (3–120).</p>
                </div>
                <div>
                  <label className="block text-zinc-500 text-sm mb-1">Badge label</label>
                  <input
                    type="text"
                    value={selected.badgeLabel}
                    onChange={(e) => patchSelected({ badgeLabel: e.target.value })}
                    placeholder="Promo"
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600"
                  />
                </div>
                <div>
                  <label className="block text-zinc-500 text-sm mb-1">Title</label>
                  <input
                    type="text"
                    value={selected.title}
                    onChange={(e) => patchSelected({ title: e.target.value })}
                    placeholder="Featured on Zongo"
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600"
                  />
                </div>
                <div>
                  <label className="block text-zinc-500 text-sm mb-1">Subtitle</label>
                  <input
                    type="text"
                    value={selected.subtitle}
                    onChange={(e) => patchSelected({ subtitle: e.target.value })}
                    placeholder="Tap to see this week's highlight"
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
                          onChange={(e) => patchSelected({ backgroundColor: e.target.value })}
                          className="h-10 w-14 cursor-pointer rounded-lg border border-zinc-600 bg-zinc-800"
                        />
                        <input
                          type="text"
                          value={selected.backgroundColor}
                          onChange={(e) => patchSelected({ backgroundColor: e.target.value })}
                          placeholder="#ec4899 or rgb(236,72,153)"
                          className="min-w-[12rem] flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600"
                        />
                        <button
                          type="button"
                          onClick={() => patchSelected({ backgroundColor: '' })}
                          className="px-3 py-2 text-xs font-bold text-zinc-400 hover:text-white rounded-xl border border-zinc-600 hover:border-zinc-500"
                        >
                          Clear colour
                        </button>
                      </div>
                      <p className="text-zinc-600 text-xs mt-1">Used when no image is set.</p>
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
                        {selected.imageDataUrl ? (
                          <button
                            type="button"
                            onClick={() => patchSelected({ imageDataUrl: '' })}
                            className="px-3 py-2 text-xs font-bold text-zinc-400 hover:text-white rounded-xl border border-zinc-600"
                          >
                            Remove upload
                          </button>
                        ) : null}
                      </div>
                      {selected.imageDataUrl ? (
                        <div className="mt-3 flex items-start gap-3">
                          <img
                            src={selected.imageDataUrl}
                            alt=""
                            className="h-24 w-20 object-cover rounded-lg border border-zinc-600"
                          />
                          <p className="text-zinc-500 text-xs pt-1">Upload overrides image URL.</p>
                        </div>
                      ) : (
                        <p className="text-zinc-600 text-xs mt-1">Max 2 MB. Stored in this browser.</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-zinc-500 text-sm mb-1">Image URL (optional)</label>
                      <input
                        type="url"
                        value={selected.imageUrl}
                        onChange={(e) => patchSelected({ imageUrl: e.target.value })}
                        placeholder="https://…"
                        className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-zinc-500 text-sm mb-1">Link URL (optional)</label>
                  <input
                    type="url"
                    value={selected.linkUrl}
                    onChange={(e) => patchSelected({ linkUrl: e.target.value })}
                    placeholder="https://…"
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600"
                  />
                  <p className="text-zinc-600 text-xs mt-1">Opens in a new tab when someone taps the tile.</p>
                </div>
              </section>
            </>
          ) : (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-500">
              Select an ad slot on the right, or add a new ad.
            </div>
          )}
        </div>

        <div className="w-full shrink-0 xl:w-[340px]">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-3">Ads</h2>
          <div className="max-h-[min(70vh,640px)] overflow-y-auto pr-1">
            <div className="grid grid-cols-3 gap-2">
              {ads.map((ad) => {
                const thumb = adThumbSrc(ad);
                const isSel = ad.id === selectedId;
                return (
                  <button
                    key={ad.id}
                    type="button"
                    onClick={() => setSelectedId(ad.id)}
                    className={`relative aspect-[3/4] rounded-xl border-2 overflow-hidden text-left transition-all ${
                      isSel ? 'border-rose-500 ring-2 ring-rose-500/30' : 'border-zinc-700 hover:border-zinc-500'
                    }`}
                  >
                    {thumb ? (
                      <img src={thumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div
                        className="h-full w-full"
                        style={
                          ad.backgroundColor.trim()
                            ? { backgroundColor: ad.backgroundColor.trim() }
                            : undefined
                        }
                      >
                        {!ad.backgroundColor.trim() ? (
                          <div className="h-full w-full bg-gradient-to-br from-pink-600 to-violet-700" />
                        ) : null}
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-1">
                      <p className="text-[9px] font-bold text-white truncate">{ad.title || 'Untitled'}</p>
                    </div>
                    {ad.enabled ? (
                      <span
                        className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-400 shadow"
                        title="Live"
                      />
                    ) : null}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={addAd}
                className="aspect-[3/4] rounded-xl border-2 border-dashed border-zinc-600 flex flex-col items-center justify-center gap-1 text-zinc-500 hover:border-rose-500/50 hover:text-rose-400 transition-colors"
              >
                <span className="text-2xl font-light">+</span>
                <span className="text-[10px] font-bold uppercase">Add</span>
              </button>
            </div>
          </div>
          <p className="text-zinc-600 text-xs mt-3">
            {ads.filter((a) => a.enabled).length} live in carousel · {ads.length} ad{ads.length === 1 ? '' : 's'} total
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdsCentrePage;
