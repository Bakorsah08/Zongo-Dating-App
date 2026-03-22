
import React, { useRef, useState, useEffect } from 'react';
import { User, BadgeTier, PayoutDetails, UserAdSubmission } from '../types';
import { getBadges, getMonetizationSettings } from '../data';
import ProfileSettingsSheets, { type ProfileSettingsSheetId } from './ProfileSettingsSheets';

interface ProfileViewProps {
  user: User;
  tokens: number;
  onGoShop: () => void;
  onUpdateAlbum: (newAlbum: string[]) => void;
  onUpdateProfile: (updates: Partial<User>) => void;
  onPurchaseBadge?: (tier: BadgeTier) => boolean;
  onLogout?: () => void;
  /** Opens Explore with the filter sheet (Discovery preferences). */
  onNavigateToExploreFilters?: () => void;
  /** Called after notification or privacy prefs change so the app can refresh derived UI. */
  onPreferencesChanged?: () => void;
  onSubmitUserAd?: (payload: {
    tierId: string;
    durationDays: number;
    title: string;
    subtitle: string;
    badgeLabel: string;
    imageUrl: string;
    imageDataUrl: string;
    backgroundColor: string;
    linkUrl: string;
    displayDurationSec: number;
  }) => { success: boolean; error?: string };
  userAdSubmissions?: UserAdSubmission[];
}

const MAX_PHOTOS = 8;
const USER_AD_MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/** When the album is empty after a delete, keep a valid avatar URL. */
const EMPTY_ALBUM_AVATAR_PLACEHOLDER = 'https://picsum.photos/seed/zongo-empty-album/400/400';

const ProfileView: React.FC<ProfileViewProps> = ({ 
  user, 
  tokens, 
  onGoShop, 
  onUpdateAlbum, 
  onUpdateProfile,
  onPurchaseBadge,
  onLogout,
  onNavigateToExploreFilters,
  onPreferencesChanged,
  onSubmitUserAd,
  userAdSubmissions = [],
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [isPhotoSelectorOpen, setIsPhotoSelectorOpen] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState(user.bio);
  const [editingBasic, setEditingBasic] = useState(false);
  const [basicDraft, setBasicDraft] = useState({ name: user.name, age: user.age, location: user.location });
  const [showBadgeShop, setShowBadgeShop] = useState(false);
  const [promoteExploreOpen, setPromoteExploreOpen] = useState(false);
  const [payoutDropdownOpen, setPayoutDropdownOpen] = useState(false);
  const [settingsSheet, setSettingsSheet] = useState<ProfileSettingsSheetId | null>(null);

  const SETTINGS_ROWS: { id: ProfileSettingsSheetId; label: string }[] = [
    { id: 'notifications', label: 'Notification Settings' },
    { id: 'discovery', label: 'Discovery Preferences' },
    { id: 'privacy', label: 'Privacy & Safety' },
    { id: 'help', label: 'Help & Support' },
  ];

  const handleUploadClick = () => {
    if (user.album.length >= MAX_PHOTOS) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (user.album.length >= MAX_PHOTOS) {
        alert(`Maximum of ${MAX_PHOTOS} photos allowed.`);
        return;
      }
      const fakeUrl = URL.createObjectURL(file);
      onUpdateAlbum([fakeUrl, ...user.album]);
    }
    if (e.target) e.target.value = '';
  };

  const handleAvatarFromAlbum = (imgUrl: string) => {
    onUpdateProfile({ avatar: imgUrl });
    setShowAvatarPicker(false);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onUpdateProfile({ avatar: url });
      if (!user.album.includes(url)) {
        onUpdateAlbum([url, ...user.album.filter(a => a !== user.avatar)]);
      }
      setShowAvatarPicker(false);
    }
    if (e.target) e.target.value = '';
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewingIndex !== null) {
      setViewingIndex((viewingIndex + 1) % user.album.length);
    }
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewingIndex !== null) {
      setViewingIndex((viewingIndex - 1 + user.album.length) % user.album.length);
    }
  };
  
  const handleSelectPhoto = (photoUrl: string) => {
    onUpdateProfile({ avatar: photoUrl });
    setShowAvatarPicker(false);
  };

  const removeAlbumPhotoAtIndex = (idx: number) => {
    if (idx < 0 || idx >= user.album.length) return;
    const removed = user.album[idx];
    if (removed.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(removed);
      } catch {
        /* ignore */
      }
    }
    const newAlbum = user.album.filter((_, i) => i !== idx);
    if (removed === user.avatar) {
      onUpdateProfile({
        avatar: newAlbum[0] ?? EMPTY_ALBUM_AVATAR_PLACEHOLDER,
      });
    }
    onUpdateAlbum(newAlbum);
    if (viewingIndex !== null) {
      if (viewingIndex === idx) {
        setViewingIndex(newAlbum.length ? Math.min(idx, newAlbum.length - 1) : null);
      } else if (viewingIndex > idx) {
        setViewingIndex(viewingIndex - 1);
      }
    }
  };

  const confirmRemoveAlbumPhoto = (idx: number) => {
    const isProfile = user.album[idx] === user.avatar;
    const msg = isProfile
      ? 'Remove this photo? It is your profile picture — your profile will use another photo or a placeholder if none are left.'
      : 'Remove this photo from your album?';
    if (!window.confirm(msg)) return;
    removeAlbumPhotoAtIndex(idx);
  };

  const saveBio = () => {
    onUpdateProfile({ bio: bioDraft });
    setEditingBio(false);
  };

  const cancelBio = () => {
    setBioDraft(user.bio);
    setEditingBio(false);
  };

  const saveBasic = () => {
    onUpdateProfile({
      name: basicDraft.name,
      age: Math.max(18, Math.min(100, basicDraft.age)),
      location: basicDraft.location
    });
    setBasicDraft({ ...basicDraft, age: Math.max(18, Math.min(100, basicDraft.age)) });
    setEditingBasic(false);
  };

  const cancelBasic = () => {
    setBasicDraft({ name: user.name, age: user.age, location: user.location });
    setEditingBasic(false);
  };

  const purchaseBadge = (tier: BadgeTier) => {
    if (tier === 'none') return;
    const badgeInfo = getBadges().find(b => b.id === tier);
    if (!badgeInfo || badgeInfo.tokenCost === 0) return;
    const success = onPurchaseBadge?.(tier);
    if (success) setShowBadgeShop(false);
  };

  const currentBadge = getBadges().find(b => b.id === (user.badgeTier || 'none'));
  const earnings = user.earnings || 0;
  const transferredOut = user.transferredOut || 0;
  const outstanding = Math.max(0, earnings - transferredOut);
  const purchasableBadges = getBadges().filter(b => b.id !== 'none');
  const monetization = getMonetizationSettings();
  const vipBadgesEnabled = monetization.vipBadgesEnabled;
  const adTiers = [...(monetization.userAdDurationTiers ?? [])].sort((a, b) => a.durationDays - b.durationDays);
  const isLimitReached = user.album.length >= MAX_PHOTOS;
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const [selectedAdTierId, setSelectedAdTierId] = useState(() => adTiers[0]?.id ?? '');
  const tierIdsKey = adTiers.map((t) => t.id).join('|');
  useEffect(() => {
    const tiers = [...(getMonetizationSettings().userAdDurationTiers ?? [])].sort(
      (a, b) => a.durationDays - b.durationDays
    );
    if (tiers.length && !tiers.some((t) => t.id === selectedAdTierId)) {
      setSelectedAdTierId(tiers[0].id);
    }
  }, [tierIdsKey, selectedAdTierId]);
  const selectedAdTier = adTiers.find((t) => t.id === selectedAdTierId);
  const [adTitle, setAdTitle] = useState('');
  const [adSubtitle, setAdSubtitle] = useState('');
  const [adBadge, setAdBadge] = useState('Promo');
  const [adLink, setAdLink] = useState('');
  const [adBgColor, setAdBgColor] = useState('#ec4899');
  const [adImageUrl, setAdImageUrl] = useState('');
  const [adImageDataUrl, setAdImageDataUrl] = useState('');
  const [adSlideSec, setAdSlideSec] = useState(8);
  const [adSubmitMsg, setAdSubmitMsg] = useState<string | null>(null);
  const userAdFileRef = useRef<HTMLInputElement>(null);

  const resetUserAdForm = () => {
    setAdTitle('');
    setAdSubtitle('');
    setAdBadge('Promo');
    setAdLink('');
    setAdBgColor('#ec4899');
    setAdImageUrl('');
    setAdImageDataUrl('');
    setAdSlideSec(8);
  };

  const handleUserAdImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > USER_AD_MAX_UPLOAD_BYTES) {
      alert('Image must be under 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setAdImageDataUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const submitUserAd = () => {
    if (!onSubmitUserAd) return;
    if (!selectedAdTier) {
      setAdSubmitMsg('Select a campaign length.');
      return;
    }
    setAdSubmitMsg(null);
    const r = onSubmitUserAd({
      tierId: selectedAdTierId,
      durationDays: selectedAdTier.durationDays,
      title: adTitle,
      subtitle: adSubtitle,
      badgeLabel: adBadge,
      imageUrl: adImageUrl,
      imageDataUrl: adImageDataUrl,
      backgroundColor: adBgColor,
      linkUrl: adLink,
      displayDurationSec: adSlideSec,
    });
    if (r.success) {
      setAdSubmitMsg('Submitted for review. You will be notified when it is approved or rejected.');
      resetUserAdForm();
    } else {
      setAdSubmitMsg(r.error ?? 'Could not submit.');
    }
  };

  const pendingExploreAds = userAdSubmissions.filter((s) => s.status === 'pending').length;

  return (
    <div className="min-h-full bg-[#f3f3f3] p-6 pb-28 text-zinc-900">
      <div className="mb-[0.8rem] flex flex-col items-center gap-4">
        <div className="relative">
          <img src={user.avatar} className="h-32 w-32 rounded-full border-4 border-zinc-200 object-cover shadow-lg" />
          <button 
            onClick={() => setShowAvatarPicker(true)}
            className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-pink-500 text-xl text-white shadow-md transition-all hover:bg-pink-600 active:scale-95"
          >
            ✎
          </button>
        </div>
        <div className="text-center">
          {!editingBasic ? (
            <>
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-2xl font-bold text-zinc-900">{user.name}, {user.age}</h2>
                <button 
                  onClick={() => setEditingBasic(true)}
                  className="rounded p-1 text-sm text-pink-600 transition-colors hover:bg-pink-50"
                >
                  ✎
                </button>
              </div>
              <p className="text-sm text-zinc-500">📍 {user.location}</p>
            </>
          ) : (
            <div className="w-full max-w-xs space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <input
                value={basicDraft.name}
                onChange={e => setBasicDraft({ ...basicDraft, name: e.target.value })}
                placeholder="Name"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-pink-500"
              />
              <input
                type="number"
                value={basicDraft.age}
                onChange={e => setBasicDraft({ ...basicDraft, age: parseInt(e.target.value) || 18 })}
                placeholder="Age"
                min={18}
                max={100}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-pink-500"
              />
              <input
                value={basicDraft.location}
                onChange={e => setBasicDraft({ ...basicDraft, location: e.target.value })}
                placeholder="Location"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-pink-500"
              />
              <div className="flex gap-2">
                <button onClick={saveBasic} className="flex-1 rounded-lg bg-pink-600 py-2 text-sm font-bold text-white">Save</button>
                <button onClick={cancelBasic} className="flex-1 rounded-lg border border-zinc-200 bg-white py-2 text-sm font-bold text-zinc-700">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <section className="mb-[0.8rem]">
        <div className="mb-3 flex items-center justify-between px-1">
          <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">About Me</h4>
          {!editingBio ? (
            <button
              onClick={() => setEditingBio(true)}
              className="text-xs font-bold text-pink-600 hover:underline"
            >
              Edit
            </button>
          ) : null}
        </div>
        {!editingBio ? (
          <p className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">{user.bio}</p>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <textarea
              value={bioDraft}
              onChange={(e) => setBioDraft(e.target.value)}
              placeholder="Tell others about yourself..."
              rows={4}
              className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-pink-500"
            />
            <div className="mt-3 flex gap-2">
              <button onClick={saveBio} className="flex-1 rounded-lg bg-pink-600 py-2 text-sm font-bold text-white">
                Save
              </button>
              <button onClick={cancelBio} className="flex-1 rounded-lg border border-zinc-200 bg-white py-2 text-sm font-bold text-zinc-700">
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {onSubmitUserAd && adTiers.length > 0 ? (
        <div className="relative z-20 mx-auto mb-[0.8rem] w-full max-w-md">
          <button
            type="button"
            onClick={() => setPromoteExploreOpen((open) => !open)}
            aria-expanded={promoteExploreOpen}
            aria-controls="profile-promote-explore-panel"
            id="profile-promote-explore-trigger"
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-sm transition-colors hover:bg-zinc-50"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-200/80 text-lg"
                aria-hidden
              >
                📣
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-black uppercase tracking-wider text-violet-900">
                  Promote on Explore
                </span>
                <span className="block text-xs text-zinc-600">
                  {promoteExploreOpen
                    ? 'Tap to hide the form'
                    : 'Tap to create an Explore carousel ad'}
                </span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {pendingExploreAds > 0 ? (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white">
                  {pendingExploreAds} pending
                </span>
              ) : null}
              {userAdSubmissions.length > 0 && pendingExploreAds === 0 ? (
                <span className="rounded-full bg-violet-200 px-2 py-0.5 text-[10px] font-bold text-violet-900">
                  {userAdSubmissions.length} saved
                </span>
              ) : null}
              <span
                className={`text-zinc-500 transition-transform duration-200 ${promoteExploreOpen ? 'rotate-180' : ''}`}
                aria-hidden
              >
                ▼
              </span>
            </span>
          </button>

          {promoteExploreOpen ? (
            <div
              id="profile-promote-explore-panel"
              role="region"
              aria-labelledby="profile-promote-explore-trigger"
              className="mt-2 rounded-3xl bg-white p-5 shadow-sm"
            >
              <p className="text-xs text-zinc-600 mb-4">
                Create a carousel-style ad for the first tile on Explore. You pay tokens now; if your ad is rejected,
                tokens are returned. If approved, an admin sets it live — your chosen duration runs from when it goes
                live.
              </p>
              <div className="space-y-3 rounded-2xl bg-zinc-50/80 p-4">
                <div>
                  <label htmlFor="profile-ad-tier" className="block text-[10px] font-bold uppercase text-zinc-500 mb-2">
                    Campaign length
                  </label>
                  <select
                    id="profile-ad-tier"
                    value={selectedAdTierId}
                    onChange={(e) => setSelectedAdTierId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-violet-500"
                  >
                    {adTiers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.durationDays} day{t.durationDays === 1 ? '' : 's'} · {t.tokenCost} tokens
                      </option>
                    ))}
                  </select>
                  {selectedAdTier ? (
                    <p className="text-[11px] text-zinc-500 mt-2">
                      This submission will cost {selectedAdTier.tokenCost} tokens.
                    </p>
                  ) : null}
                </div>
                <input
                  value={adTitle}
                  onChange={(e) => setAdTitle(e.target.value)}
                  placeholder="Title"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                />
                <input
                  value={adSubtitle}
                  onChange={(e) => setAdSubtitle(e.target.value)}
                  placeholder="Subtitle"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                />
                <input
                  value={adBadge}
                  onChange={(e) => setAdBadge(e.target.value)}
                  placeholder="Badge label (e.g. Promo)"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs text-zinc-500">Background</label>
                  <input
                    type="color"
                    aria-label="Ad background colour"
                    value={/^#[0-9A-Fa-f]{6}$/.test(adBgColor) ? adBgColor : '#ec4899'}
                    onChange={(e) => setAdBgColor(e.target.value)}
                    className="h-9 w-14 cursor-pointer rounded border border-zinc-200"
                  />
                  <input
                    value={adBgColor}
                    onChange={(e) => setAdBgColor(e.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                  />
                </div>
                <input
                  type="url"
                  value={adImageUrl}
                  onChange={(e) => setAdImageUrl(e.target.value)}
                  placeholder="Image URL (optional if you upload)"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                />
                <input ref={userAdFileRef} type="file" accept="image/*" className="hidden" onChange={handleUserAdImage} />
                <button
                  type="button"
                  onClick={() => userAdFileRef.current?.click()}
                  className="rounded-xl border border-violet-300 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-900"
                >
                  Upload image (max 2 MB)
                </button>
                {adImageDataUrl ? (
                  <div className="flex items-center gap-2">
                    <img src={adImageDataUrl} alt="" className="h-16 w-14 rounded-lg object-cover border" />
                    <button type="button" className="text-xs text-red-600 font-bold" onClick={() => setAdImageDataUrl('')}>
                      Remove upload
                    </button>
                  </div>
                ) : null}
                <input
                  type="url"
                  value={adLink}
                  onChange={(e) => setAdLink(e.target.value)}
                  placeholder="Link when someone taps the ad (optional)"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                />
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-500">Seconds on screen per rotation</label>
                  <input
                    type="number"
                    min={3}
                    max={120}
                    value={adSlideSec}
                    onChange={(e) => setAdSlideSec(Math.min(120, Math.max(3, parseInt(e.target.value, 10) || 8)))}
                    className="mt-1 w-24 rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                  />
                </div>
                {adSubmitMsg ? <p className="text-xs font-medium text-violet-800">{adSubmitMsg}</p> : null}
                <button
                  type="button"
                  onClick={submitUserAd}
                  disabled={!adTitle.trim()}
                  className="w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white disabled:opacity-40"
                >
                  Submit for review ({selectedAdTier?.tokenCost ?? '—'} tokens)
                </button>
              </div>
              {userAdSubmissions.length > 0 ? (
                <div className="mt-4">
                  <p className="text-[10px] font-bold uppercase text-zinc-500 mb-2">Your submissions</p>
                  <ul className="space-y-2">
                    {userAdSubmissions
                      .slice()
                      .sort((a, b) => b.createdAt - a.createdAt)
                      .map((s) => (
                        <li
                          key={s.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white/80 px-3 py-2 text-xs"
                        >
                          <span className="font-bold text-zinc-800 truncate max-w-[60%]">{s.title || 'Untitled'}</span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 font-bold uppercase text-[10px] ${
                              s.status === 'pending'
                                ? 'bg-amber-100 text-amber-900'
                                : s.status === 'approved'
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {s.status}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* VIP Badge Section */}
      {vipBadgesEnabled && (
        <div className="mb-[0.8rem] rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="text-3xl">{currentBadge?.icon || '⭐'}</span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-800/90">VIP Badge</p>
                <p className="font-bold text-zinc-900">{currentBadge?.name || 'No Badge'}</p>
                <p className="text-[10px] text-zinc-600">Earn or purchase to rank higher on Explore</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowBadgeShop(true)}
              className="shrink-0 rounded-full bg-amber-100 px-4 py-2 text-xs font-bold text-amber-900 transition-colors hover:bg-amber-200"
            >
              Get Badge
            </button>
          </div>
        </div>
      )}

      <div className="mb-[0.8rem] flex items-center justify-between rounded-3xl bg-white p-6 shadow-sm">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-500">Balance</p>
          <h3 className="flex items-center gap-2 text-3xl font-black text-zinc-900">
            <span>💎</span> {tokens}
          </h3>
        </div>
        <button
          type="button"
          onClick={onGoShop}
          className="rounded-full bg-pink-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition-all active:scale-95 hover:bg-pink-500"
        >
          Buy More
        </button>
      </div>

      {/* Payout - Earnings & Withdraw (collapsible) */}
      <div className="relative z-20 mx-auto mb-[0.8rem] w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setPayoutDropdownOpen((open) => !open)}
          aria-expanded={payoutDropdownOpen}
          aria-controls="profile-payout-panel"
          id="profile-payout-trigger"
          className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-zinc-50/80"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200/80 text-lg"
              aria-hidden
            >
              🏦
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-black uppercase tracking-wider text-zinc-900">Payout</span>
              <span className="block text-xs text-zinc-600">
                {payoutDropdownOpen
                  ? 'Tap to hide'
                  : user.payoutDetails
                    ? `Outstanding $${outstanding.toLocaleString()} · Earnings $${earnings.toLocaleString()}`
                    : 'Add bank or mobile money to withdraw earnings'}
              </span>
            </span>
          </span>
          <span
            className={`shrink-0 text-zinc-500 transition-transform duration-200 ${payoutDropdownOpen ? 'rotate-180' : ''}`}
            aria-hidden
          >
            ▼
          </span>
        </button>

        {payoutDropdownOpen ? (
          <div
            id="profile-payout-panel"
            role="region"
            aria-labelledby="profile-payout-trigger"
            className="px-4 pb-4 pt-1"
          >
            <h4 className="sr-only">Payout details</h4>
            <div className="mb-4 grid grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] uppercase text-zinc-500">Earnings</p>
                <p className="font-bold text-zinc-900">${earnings.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-zinc-500">Transferred</p>
                <p className="font-bold text-zinc-600">${transferredOut.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-zinc-500">Outstanding</p>
                <p className="font-bold text-zinc-900">${outstanding.toLocaleString()}</p>
              </div>
            </div>
            {!user.payoutDetails ? (
              <button
                type="button"
                onClick={() => setShowPayoutForm(true)}
                className="w-full rounded-xl border border-emerald-300 bg-emerald-600 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-500"
              >
                Add Bank or Mobile Money
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-zinc-600">
                  {user.payoutDetails.type === 'bank'
                    ? `${user.payoutDetails.bankName} •••• ${user.payoutDetails.accountNumber?.slice(-4)}`
                    : `${user.payoutDetails.provider} ${user.payoutDetails.mobileNumber}`}
                </p>
                <div className="flex flex-col gap-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Amount"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const amt = parseFloat(withdrawAmount);
                      if (amt > 0 && amt <= outstanding) {
                        onUpdateProfile({ transferredOut: transferredOut + amt });
                        setWithdrawAmount('');
                      }
                    }}
                    className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-500"
                  >
                    Withdraw
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPayoutForm(true)}
                  className="text-xs text-pink-600 hover:underline"
                >
                  Change payout details
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {showPayoutForm ? (
        <PayoutFormModal
          details={user.payoutDetails}
          onSave={(d) => {
            onUpdateProfile({ payoutDetails: d });
            setShowPayoutForm(false);
          }}
          onClose={() => setShowPayoutForm(false)}
        />
      ) : null}

      <div className="space-y-[0.8rem]">
        <section>
          <div className="mb-4 flex items-center justify-between px-1">
            <div className="flex flex-col">
              <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">My Album</h4>
              <span className="text-[10px] font-medium text-zinc-500">({user.album.length}/{MAX_PHOTOS} photos)</span>
            </div>
            {!isLimitReached && (
              <button 
                onClick={handleUploadClick}
                className="text-xs font-bold text-pink-600 hover:underline"
              >
                + Add Photo
              </button>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {user.album.map((img, idx) => (
              <div
                key={idx}
                className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 sm:rounded-xl"
              >
                <button
                  type="button"
                  onClick={() => setViewingIndex(idx)}
                  className="relative h-full w-full cursor-pointer transition-transform active:scale-95"
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                  {img === user.avatar && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
                      <span className="rounded bg-pink-600 px-1 py-0.5 text-[10px] font-bold text-white sm:px-2 sm:text-xs">
                        Profile
                      </span>
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    confirmRemoveAlbumPhoto(idx);
                  }}
                  className="absolute right-0.5 top-0.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-xs font-bold text-white shadow-sm ring-1 ring-white/30 transition-colors hover:bg-red-600 sm:h-7 sm:w-7 sm:right-1 sm:top-1"
                  aria-label="Remove photo"
                >
                  ×
                </button>
              </div>
            ))}
            {!isLimitReached && (
              <div 
                onClick={handleUploadClick}
                className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 text-zinc-500 transition-colors hover:border-pink-300 hover:text-pink-600 sm:rounded-xl"
              >
                <span className="text-lg sm:text-2xl">+</span>
                <span className="text-[9px] font-bold sm:text-[10px]">Upload</span>
              </div>
            )}
          </div>
        </section>

        <section>
          <h4 className="mb-3 px-1 text-xs font-bold uppercase tracking-widest text-zinc-500">Settings</h4>
          <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
            {SETTINGS_ROWS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSettingsSheet(id)}
                className="group flex w-full items-center justify-between px-4 py-4 text-left text-sm font-medium [-webkit-tap-highlight-color:transparent]"
              >
                <span className="text-zinc-800">{label}</span>
                <span className="text-zinc-400 transition-transform group-hover:translate-x-1">→</span>
              </button>
            ))}
          </div>
        </section>

        <button onClick={onLogout} className="w-full py-4 text-sm font-bold text-red-600">
          Log Out
        </button>
      </div>
      
      {/* Album Photo Selector Modal */}
      {isPhotoSelectorOpen && (
        <div 
          className="fixed inset-0 z-[100] flex animate-in items-end justify-center bg-black/40 backdrop-blur-sm fade-in duration-200"
          onClick={() => setIsPhotoSelectorOpen(false)}
        >
          <div 
              className="relative w-full max-w-md animate-in rounded-t-[32px] border-t border-zinc-200 bg-white p-6 pb-12 slide-in-from-bottom duration-300"
              onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-zinc-300"></div>
            <h3 className="mb-6 text-center text-sm font-black uppercase tracking-widest text-zinc-500">Select New Profile Photo</h3>
            {user.album.length > 0 ? (
              <div className="grid max-h-[40vh] grid-cols-4 gap-2 overflow-y-auto sm:gap-3">
                {user.album.map((img, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => handleSelectPhoto(img)}
                    className="aspect-square cursor-pointer overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 transition-transform hover:border-pink-400 active:scale-95"
                  >
                    <img src={img} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-zinc-500">
                You have no photos in your album. Add some photos first!
              </p>
            )}
            <button 
              onClick={() => setIsPhotoSelectorOpen(false)}
              className="mt-6 w-full rounded-xl border border-zinc-200 bg-zinc-50 py-3 font-bold text-zinc-800 transition-transform active:scale-[0.99]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Avatar Picker Modal */}
      {showAvatarPicker && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/40 p-6 backdrop-blur-sm" onClick={() => setShowAvatarPicker(false)}>
          <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold text-zinc-900">Change Profile Photo</h3>
            <div className="space-y-3">
              <button
                onClick={() => { avatarFileInputRef.current?.click(); }}
                className="w-full rounded-xl bg-pink-600 py-3 text-sm font-bold text-white hover:bg-pink-500"
              >
                📷 Upload from device
              </button>
              <input type="file" ref={avatarFileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
              {user.album.length > 0 && (
                <>
                  <p className="text-xs font-bold uppercase text-zinc-500">Or choose from album</p>
                  <div className="grid max-h-40 grid-cols-4 gap-1.5 overflow-y-auto sm:gap-2">
                    {user.album.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleAvatarFromAlbum(img)}
                        className={`aspect-square overflow-hidden rounded-xl border-2 ${img === user.avatar ? 'border-pink-500' : 'border-zinc-200'}`}
                      >
                        <img src={img} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button type="button" onClick={() => setShowAvatarPicker(false)} className="mt-4 w-full py-2 text-sm text-zinc-500 hover:text-zinc-800">Cancel</button>
          </div>
        </div>
      )}

      {/* Badge Shop Modal */}
      {showBadgeShop && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-y-auto bg-black/40 p-6 backdrop-blur-sm" onClick={() => setShowBadgeShop(false)}>
          <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-bold text-zinc-900">VIP Badges</h3>
            <p className="mb-4 text-xs text-zinc-600">Purchase with tokens or earn by receiving gifts on live streams</p>
            <div className="space-y-3">
              {purchasableBadges.map(badge => {
                const canEarn = badge.minEarningsToEarn > 0 && earnings >= badge.minEarningsToEarn;
                const canPurchase = tokens >= badge.tokenCost;
                const isCurrent = user.badgeTier === badge.id;
                return (
                  <div 
                    key={badge.id}
                    className={`flex items-center justify-between rounded-2xl border p-4 ${isCurrent ? 'border-amber-300 bg-amber-50' : 'border-zinc-200 bg-zinc-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{badge.icon}</span>
                      <div>
                        <p className="font-bold text-zinc-900">{badge.name}</p>
                        <p className="text-[10px] text-zinc-600">
                          {badge.tokenCost} 💎 or earn at {badge.minEarningsToEarn} gifts
                        </p>
                      </div>
                    </div>
                    {isCurrent ? (
                      <span className="text-xs font-bold text-amber-800">Current</span>
                    ) : canEarn ? (
                      <button 
                        type="button"
                        onClick={() => { onUpdateProfile({ badgeTier: badge.id }); setShowBadgeShop(false); }}
                        className="text-xs font-bold text-emerald-600 hover:underline"
                      >
                        Claim Free
                      </button>
                    ) : canPurchase ? (
                      <button 
                        type="button"
                        onClick={() => purchaseBadge(badge.id)}
                        className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-zinc-900 hover:bg-amber-400"
                      >
                        Buy
                      </button>
                    ) : (
                      <button 
                        type="button"
                        onClick={onGoShop}
                        className="text-xs font-bold text-amber-700 hover:underline"
                      >
                        Get {badge.tokenCost - tokens} more 💎
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={() => setShowBadgeShop(false)} className="mt-4 w-full py-2 text-sm text-zinc-500 hover:text-zinc-800">Close</button>
          </div>
        </div>
      )}

      {/* Full Screen Image Viewer */}
      {viewingIndex !== null && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center animate-in fade-in duration-200"
          onClick={() => setViewingIndex(null)}
        >
          <button 
            className="absolute top-6 right-6 w-12 h-12 bg-zinc-800/50 rounded-full flex items-center justify-center text-white text-2xl z-10"
            onClick={() => setViewingIndex(null)}
          >
            ✕
          </button>
          
          <div className="absolute top-6 left-6 z-10 flex max-w-[70%] flex-col gap-2 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center">
            {user.album[viewingIndex] !== user.avatar && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAvatarFromAlbum(user.album[viewingIndex]);
                  setViewingIndex(null);
                }}
                className="rounded-full bg-pink-500 px-3 py-1.5 text-left text-xs font-bold text-white"
              >
                Set as profile pic
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                confirmRemoveAlbumPhoto(viewingIndex);
              }}
              className="rounded-full bg-red-600/90 px-3 py-1.5 text-left text-xs font-bold text-white ring-1 ring-white/20 hover:bg-red-600"
            >
              Remove from album
            </button>
          </div>
          
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <button 
              className="absolute left-4 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white text-2xl backdrop-blur-md"
              onClick={prevImage}
            >
              ‹
            </button>
            
            <img 
              src={user.album[viewingIndex]} 
              className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            
            <button 
              className="absolute right-4 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white text-2xl backdrop-blur-md"
              onClick={nextImage}
            >
              ›
            </button>
          </div>
          
          <div className="absolute bottom-8 text-white/50 text-xs font-bold tracking-widest">
            {viewingIndex + 1} / {user.album.length}
          </div>
        </div>
      )}

      {settingsSheet ? (
        <ProfileSettingsSheets
          sheet={settingsSheet}
          onClose={() => setSettingsSheet(null)}
          onNavigateToExploreFilters={() => onNavigateToExploreFilters?.()}
          onPreferencesChanged={() => onPreferencesChanged?.()}
        />
      ) : null}
    </div>
  );
};

const PayoutFormModal: React.FC<{ details?: PayoutDetails | null; onSave: (d: PayoutDetails) => void; onClose: () => void }> = ({ details, onSave, onClose }) => {
  const [type, setType] = useState<'bank' | 'mobile_money'>(details?.type || 'bank');
  const [bankName, setBankName] = useState(details?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(details?.accountNumber || '');
  const [accountName, setAccountName] = useState(details?.accountName || '');
  const [provider, setProvider] = useState(details?.provider || '');
  const [mobileNumber, setMobileNumber] = useState(details?.mobileNumber || '');

  const handleSave = () => {
    if (type === 'bank') {
      if (!bankName || !accountNumber || !accountName) { alert('Fill all bank fields'); return; }
      onSave({ type: 'bank', bankName, accountNumber, accountName });
    } else {
      if (!provider || !mobileNumber) { alert('Fill provider and mobile number'); return; }
      onSave({ type: 'mobile_money', provider, mobileNumber });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-bold text-zinc-900">Add Payout Details</h3>
        <div className="mb-4 flex gap-4 text-sm text-zinc-800">
          <label className="flex cursor-pointer items-center gap-2"><input type="radio" checked={type === 'bank'} onChange={() => setType('bank')} /> Bank</label>
          <label className="flex cursor-pointer items-center gap-2"><input type="radio" checked={type === 'mobile_money'} onChange={() => setType('mobile_money')} /> Mobile Money</label>
        </div>
        {type === 'bank' ? (
          <div className="space-y-3">
            <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Bank name" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-900" />
            <input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="Account number" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-900" />
            <input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Account name" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-900" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {['MTN', 'Vodafone', 'AirtelTigo'].map(p => (
                <button key={p} type="button" onClick={() => setProvider(p)} className={`rounded px-3 py-1 text-sm ${provider === p ? 'bg-pink-600 text-white' : 'border border-zinc-200 bg-zinc-100 text-zinc-700'}`}>{p}</button>
              ))}
            </div>
            <input value={mobileNumber} onChange={e => setMobileNumber(e.target.value)} placeholder="Mobile number" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-900" />
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-zinc-200 py-2 text-sm text-zinc-600">Cancel</button>
          <button type="button" onClick={handleSave} className="flex-1 rounded-xl bg-pink-600 py-2 text-sm font-bold text-white hover:bg-pink-500">Save</button>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
