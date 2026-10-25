import React, { useState, useMemo, useEffect, useRef } from 'react';
import { getUsers, getBadges, getMonetizationSettings, getExploreCarousel } from '../data';
import { MOCK_AI_COMPANIONS } from '../constants';
import type { ExploreCarouselAd, User, UserGender } from '../types';
import {
  getDiscoveryPreferences,
  setDiscoveryPreferences,
  getPrivacyPreferences,
  USER_PREFERENCES_UPDATED_EVENT,
  type DiscoveryTextFilter,
} from '../userPreferencesStore';
import { getUserMoodDisplay } from '../userMoods';

interface DiscoverViewProps {
  userGender?: UserGender;
  /** Logged-in user id (hide self from grid). Defaults to legacy mock id `me`. */
  currentUserId?: string;
  /** Header: avatar, name, token balance, buy button. */
  currentUser?: Pick<User, 'name' | 'avatar'>;
  tokens?: number;
  onGoShop?: () => void;
  onOpenProfile?: () => void;
  onSelectUser: (user: User) => void;
  onSelectLive: (user: User) => void;
  onGoLive?: () => void;
  /** Increment (e.g. from Profile → Discovery preferences) to open the filter sheet. */
  exploreFilterOpenSignal?: number;
  blockedUserIds?: string[];
  /** When true, human tab uses `cloudHumanUsers` from the server; AI tab uses bundled companions. */
  useRemoteHumanProfiles?: boolean;
  cloudHumanUsers?: User[];
  cloudDiscoverLoading?: boolean;
  cloudDiscoverError?: string | null;
  onReloadCloudDiscover?: () => void;
  /** Server-backed carousel slides when non-empty and `useRemoteCarousel` is true. */
  cloudCarouselAds?: ExploreCarouselAd[];
  useRemoteCarousel?: boolean;
}

const AI_PERSONALITIES = ['Any', 'Romantic', 'Playful', 'Calm', 'Intellectual'];
const AI_STYLES = ['Any', 'Casual', 'Elegant', 'Streetwear', 'Sporty'];

const getBadgeRank = (user: User): number => {
  const tier = user.badgeTier || 'none';
  return getBadges().find(b => b.id === tier)?.rank ?? 0;
};

/** First Explore grid cell — rotating carousel (database first, then admin centre). */
const ExploreCarouselTile: React.FC<{
  cloudCarouselAds?: ExploreCarouselAd[];
  useRemoteCarousel?: boolean;
  /** Wide banner when list layout; default portrait tile for grid. */
  layout?: 'grid' | 'list';
}> = ({ cloudCarouselAds = [], useRemoteCarousel = false, layout = 'grid' }) => {
  const localAds = getExploreCarousel().ads;
  const ads =
    useRemoteCarousel && cloudCarouselAds.length > 0 ? cloudCarouselAds : localAds;
  const now = Date.now();
  const liveAds = ads.filter(
    (a) => a.enabled && (!a.campaignEndsAt || a.campaignEndsAt > now)
  );
  const [idx, setIdx] = useState(0);

  const liveSig = liveAds.map((a) => `${a.id}:${a.displayDurationSec}`).join('|');
  useEffect(() => {
    setIdx(0);
  }, [liveSig]);

  useEffect(() => {
    if (liveAds.length <= 1) return;
    const sec = Math.min(120, Math.max(3, liveAds[idx]?.displayDurationSec ?? 8));
    const timer = window.setTimeout(() => {
      setIdx((i) => (i + 1) % liveAds.length);
    }, sec * 1000);
    return () => window.clearTimeout(timer);
  }, [idx, liveAds.length, liveAds[idx]?.id, liveAds[idx]?.displayDurationSec]);

  const current = liveAds.length ? liveAds[idx] : null;
  const link = current?.linkUrl.trim() ?? '';

  const openLink = () => {
    if (!current || !link) return;
    const url =
      link.startsWith('http://') || link.startsWith('https://') ? link : `https://${link}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const frameClass =
    layout === 'list'
      ? 'relative aspect-[2/1] max-h-44 w-full sm:max-h-52'
      : 'relative aspect-[3/4]';
  const frameBorder = layout === 'list' ? 'border border-zinc-200' : 'border border-white';

  if (!current) {
    return (
      <div
        className={`group ${frameClass} overflow-hidden rounded-[0.65rem] ${frameBorder} transition-transform active:scale-[0.99] cursor-default`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-pink-500 via-violet-600 to-blue-600" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
        <div className="absolute left-2 top-2 rounded bg-white/90 px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter text-zinc-900 shadow-sm">
          Featured
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-[0.91875rem] font-bold text-white drop-shadow-md">Zongo</h3>
          <p className="text-[10px] text-zinc-200 drop-shadow-md line-clamp-2">Ads & announcements</p>
        </div>
      </div>
    );
  }

  const imgSrc =
    current.imageDataUrl?.trim() || current.imageUrl.trim()
      ? (current.imageDataUrl?.trim() || current.imageUrl.trim())
      : '';
  const bgColor = current.backgroundColor?.trim() || '';

  return (
    <div
      role="button"
      tabIndex={link ? 0 : undefined}
      onClick={openLink}
      onKeyDown={(e) => {
        if (!link) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLink();
        }
      }}
      className={`group ${frameClass} overflow-hidden rounded-[0.65rem] ${frameBorder} transition-transform active:scale-[0.99] ${
        link ? 'cursor-pointer' : 'cursor-default'
      }`}
    >
      <div key={current.id} className="absolute inset-0 animate-in fade-in duration-500">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : bgColor ? (
          <div className="absolute inset-0" style={{ backgroundColor: bgColor }} />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-pink-500 via-violet-600 to-blue-600" />
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />
      <div className="absolute left-2 top-2 rounded bg-white/90 px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter text-zinc-900 shadow-sm">
        {current.badgeLabel.trim() || 'Promo'}
      </div>
      <div className="absolute bottom-3 left-3 right-3">
        <h3 className="text-[0.91875rem] font-bold text-white drop-shadow-md">
          {current.title.trim() || 'Zongo'}
        </h3>
        <p className="text-[10px] text-zinc-200 drop-shadow-md line-clamp-2">
          {current.subtitle.trim() || 'Promos & news'}
        </p>
      </div>
      {liveAds.length > 1 ? (
        <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
          {liveAds.map((a, i) => (
            <span
              key={a.id}
              className={`h-1.5 w-1.5 rounded-full ${i === idx ? 'bg-white' : 'bg-white/35'}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

function distanceLine(
  user: User,
  approximateOnly: boolean
): string {
  if (user.isAI) return 'AI Companion';
  if (user.isLive) return 'Tap to watch live';
  if (!approximateOnly) return `${user.distance} miles away`;
  if (user.distance <= 5) return 'Very close';
  if (user.distance <= 25) return 'Nearby';
  return 'Farther away';
}

/** Resolve tier icon/label even if admin badge list was customized. */
function vipTierDisplay(user: User): { icon: string; name: string } | null {
  if (!user.badgeTier || user.badgeTier === 'none') return null;
  const info = getBadges().find((b) => b.id === user.badgeTier);
  return {
    icon: info?.icon?.trim() ? info.icon : '👑',
    name: info?.name?.trim() ? info.name : 'VIP',
  };
}

/** Large VIP mark — top-right on grid tiles. */
function ExploreTileVipCorner({ user }: { user: User }) {
  const vip = vipTierDisplay(user);
  if (!vip) return null;
  return (
    <div
      className="absolute right-2 top-2 z-20 flex flex-col items-end gap-0.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)]"
      title={vip.name}
    >
      <span className="text-[1.65rem] leading-none" aria-hidden>
        {vip.icon}
      </span>
      <span className="rounded-full bg-amber-500 px-1.5 py-px text-[7px] font-black uppercase tracking-wider text-white ring-1 ring-white/40">
        VIP
      </span>
    </div>
  );
}

/** Mood + VIP chips on Explore portrait tiles (dark overlay). */
function ExploreTileVipMoodChips({ user }: { user: User }) {
  const mood = getUserMoodDisplay(user.mood);
  const vip = vipTierDisplay(user);
  return (
    <div className="mb-1.5 flex flex-wrap gap-1">
      <span className="inline-flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm backdrop-blur-sm">
        <span aria-hidden>{mood.icon}</span>
        {mood.label}
      </span>
      {vip ? (
        <span
          className="inline-flex items-center gap-0.5 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow-md ring-1 ring-amber-200/80"
          title={vip.name}
        >
          <span aria-hidden className="text-[11px] leading-none">
            {vip.icon}
          </span>
          VIP
        </span>
      ) : null}
    </div>
  );
}

const DiscoverView: React.FC<DiscoverViewProps> = ({
  userGender,
  currentUserId = 'me',
  currentUser,
  tokens = 0,
  onGoShop,
  onOpenProfile,
  onSelectUser,
  onSelectLive,
  onGoLive,
  exploreFilterOpenSignal = 0,
  blockedUserIds = [],
  useRemoteHumanProfiles = false,
  cloudHumanUsers = [],
  cloudDiscoverLoading = false,
  cloudDiscoverError = null,
  onReloadCloudDiscover,
  cloudCarouselAds = [],
  useRemoteCarousel = false,
}) => {
  const liveStreamingEnabled = getMonetizationSettings().liveStreamingEnabled;
  const initial = getDiscoveryPreferences();
  const [showFilters, setShowFilters] = useState(false);
  const [activeTextFilter, setActiveTextFilter] = useState<DiscoveryTextFilter>(initial.activeTextFilter);

  const [profileType, setProfileType] = useState<'human' | 'ai'>(initial.profileType);

  const [filterOnline, setFilterOnline] = useState<'all' | 'online'>(initial.filterOnline);
  const [maxDistance, setMaxDistance] = useState(initial.maxDistance);
  const [minAge, setMinAge] = useState(initial.minAge);
  const [maxAge, setMaxAge] = useState(initial.maxAge);

  const [aiMinAge, setAiMinAge] = useState(initial.aiMinAge);
  const [aiMaxAge, setAiMaxAge] = useState(initial.aiMaxAge);
  const [aiPersonality, setAiPersonality] = useState(initial.aiPersonality);
  const [aiStyle, setAiStyle] = useState(initial.aiStyle);

  const [approximateDistance, setApproximateDistance] = useState(
    () => getPrivacyPreferences().showApproximateDistanceOnly
  );

  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>(() => {
    try {
      return localStorage.getItem('zongo_explore_layout') === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('zongo_explore_layout', layoutMode);
    } catch {
      /* ignore */
    }
  }, [layoutMode]);

  const lastFilterSignal = useRef(exploreFilterOpenSignal);
  useEffect(() => {
    if (exploreFilterOpenSignal !== lastFilterSignal.current) {
      lastFilterSignal.current = exploreFilterOpenSignal;
      setShowFilters(true);
    }
  }, [exploreFilterOpenSignal]);

  useEffect(() => {
    setDiscoveryPreferences({
      activeTextFilter,
      profileType,
      filterOnline,
      maxDistance,
      minAge,
      maxAge,
      aiMinAge,
      aiMaxAge,
      aiPersonality,
      aiStyle,
    });
  }, [
    activeTextFilter,
    profileType,
    filterOnline,
    maxDistance,
    minAge,
    maxAge,
    aiMinAge,
    aiMaxAge,
    aiPersonality,
    aiStyle,
  ]);

  const syncApproximateFromStore = () => {
    setApproximateDistance(getPrivacyPreferences().showApproximateDistanceOnly);
  };

  useEffect(() => {
    const onPrefs = () => syncApproximateFromStore();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'zongo_user_preferences_v1') onPrefs();
    };
    window.addEventListener(USER_PREFERENCES_UPDATED_EVENT, onPrefs);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(USER_PREFERENCES_UPDATED_EVENT, onPrefs);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const blockedSet = useMemo(() => new Set(blockedUserIds), [blockedUserIds]);

  const baseUserPool = useMemo(() => {
    if (useRemoteHumanProfiles) {
      return profileType === 'human' ? cloudHumanUsers : [...MOCK_AI_COMPANIONS];
    }
    return getUsers();
  }, [useRemoteHumanProfiles, cloudHumanUsers, profileType]);

  const filteredUsers = useMemo(() => {
    const allUsers = baseUserPool;
    let filtered = allUsers
      .filter((user) => user.id !== currentUserId)
      .filter((user) => !blockedSet.has(user.id))
      .filter(user => {
        const matchesOnline = filterOnline === 'all' || user.isOnline;
        const matchesDistance = user.distance <= maxDistance;
        const matchesAge = user.age >= minAge && user.age <= maxAge;
        return matchesOnline && matchesDistance && matchesAge;
      });

    const beforeGenderFilter = [...filtered];

    // Gender-based filtering: 90% opposite gender, 10% same (or users without gender)
    if (userGender) {
      const preferredGender = userGender === 'male' ? 'female' : 'male';
      const preferred = filtered.filter(u => u.gender === preferredGender);
      const other = filtered.filter(u => u.gender === userGender || u.gender === undefined);
      const otherCount = preferred.length > 0 ? Math.ceil(preferred.length / 9) : other.length; // ~10% of total, or all "other" if no preferred
      filtered = [...preferred, ...other.slice(0, otherCount)];

      // Fallback: if gender filter yields no results (e.g. users lack gender in storage), show all
      if (filtered.length === 0 && beforeGenderFilter.length > 0) {
        filtered = beforeGenderFilter;
      }
    }

    if (activeTextFilter === 'all') {
      return [...filtered];
    }

    if (activeTextFilter === 'live') {
      return filtered
        .filter(u => u.isLive)
        .sort((a, b) => (b.viewerCount ?? 0) - (a.viewerCount ?? 0));
    }

    if (activeTextFilter === 'nearby') {
      return [...filtered].sort((a, b) => a.distance - b.distance);
    }

    if (activeTextFilter === 'newcomer') {
      const indexById = new Map<string, number>(baseUserPool.map((u, i) => [u.id, i]));
      // Newest assumed to be the most recently inserted (towards end of array)
      return [...filtered].sort((a, b) => (indexById.get(b.id) ?? 0) - (indexById.get(a.id) ?? 0));
    }

    // Recommend: VIP rank first, then by distance
    return [...filtered].sort((a, b) => {
      const rankA = getBadgeRank(a);
      const rankB = getBadgeRank(b);
      if (rankB !== rankA) return rankB - rankA;
      return a.distance - b.distance;
    });
  }, [
    userGender,
    currentUserId,
    filterOnline,
    maxDistance,
    minAge,
    maxAge,
    activeTextFilter,
    blockedSet,
    baseUserPool,
  ]);

  const areHumanFiltersActive = filterOnline === 'online' || maxDistance < 50 || minAge > 18 || maxAge < 50;
  const areAIFiltersActive = aiMinAge > 18 || aiMaxAge < 35 || aiPersonality !== 'Any' || aiStyle !== 'Any';
  const areAnyFiltersActive = (profileType === 'human' && areHumanFiltersActive) || (profileType === 'ai' && areAIFiltersActive);
  return (
    <div className="flex flex-col min-h-full bg-white">
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenProfile}
            disabled={!onOpenProfile}
            className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-pink-200 ${
              onOpenProfile ? 'cursor-pointer active:scale-95' : 'cursor-default'
            }`}
            aria-label={currentUser?.name ? `${currentUser.name}, open profile` : 'Your profile'}
          >
            <img
              src={currentUser?.avatar}
              alt=""
              className="h-full w-full object-cover"
            />
          </button>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-zinc-800">
            <span aria-hidden>💎</span>
            {tokens.toLocaleString()}
          </span>
          {onGoShop ? (
            <button
              type="button"
              onClick={onGoShop}
              aria-label="Buy more tokens"
              className="flex h-[1.4rem] w-[1.4rem] shrink-0 items-center justify-center rounded-full bg-pink-600 text-sm font-bold leading-none text-white shadow-sm transition-all active:scale-95 hover:bg-pink-500"
            >
              +
            </button>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setLayoutMode('grid')}
            aria-pressed={layoutMode === 'grid'}
            aria-label="Tile grid view"
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
              layoutMode === 'grid'
                ? 'bg-pink-100 text-pink-600'
                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700'
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setLayoutMode('list')}
            aria-pressed={layoutMode === 'list'}
            aria-label="List view"
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
              layoutMode === 'list'
                ? 'bg-pink-100 text-pink-600'
                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700'
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            aria-label="Open filters"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
              showFilters || areAnyFiltersActive ? 'bg-white text-pink-600 ring-1 ring-pink-200' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 overflow-x-auto px-4 pb-3">
        <button
          type="button"
          onClick={() => setActiveTextFilter('all')}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-xs transition-all ${
            activeTextFilter === 'all'
              ? 'bg-gradient-to-r from-pink-200 to-blue-200 font-extrabold text-zinc-900'
              : 'bg-zinc-100 font-medium text-zinc-500'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setActiveTextFilter('recommend')}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-xs transition-all ${
            activeTextFilter === 'recommend'
              ? 'bg-gradient-to-r from-pink-200 to-blue-200 font-extrabold text-zinc-900'
              : 'bg-zinc-100 font-medium text-zinc-500'
          }`}
        >
          Recommended
        </button>
        <button
          type="button"
          onClick={() => setActiveTextFilter('newcomer')}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-xs transition-all ${
            activeTextFilter === 'newcomer'
              ? 'bg-gradient-to-r from-pink-200 to-blue-200 font-extrabold text-zinc-900'
              : 'bg-zinc-100 font-medium text-zinc-500'
          }`}
        >
          Newcomer
        </button>
        <button
          type="button"
          onClick={() => setActiveTextFilter('nearby')}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-xs transition-all ${
            activeTextFilter === 'nearby'
              ? 'bg-gradient-to-r from-pink-200 to-blue-200 font-extrabold text-zinc-900'
              : 'bg-zinc-100 font-medium text-zinc-500'
          }`}
        >
          Nearby
        </button>
        <button
          type="button"
          onClick={() => setActiveTextFilter('live')}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-xs transition-all ${
            activeTextFilter === 'live'
              ? 'bg-gradient-to-r from-pink-200 to-blue-200 font-extrabold text-zinc-900'
              : 'bg-zinc-100 font-medium text-zinc-500'
          }`}
        >
          Live
        </button>
      </div>

      {/* Filter Panel - light theme */}
      {showFilters && (
        <div className="px-4">
        <div className="bg-white border border-zinc-200 rounded-3xl p-5 space-y-6 shadow-xl animate-in slide-in-from-top duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-800">Filters</h3>
            <button onClick={() => setShowFilters(false)} className="text-zinc-600 hover:text-zinc-900 text-xs font-medium">Close</button>
          </div>
          
          {/* Profile Type Toggle */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Profile Type</label>
            <div className="flex bg-zinc-200 p-1 rounded-xl border border-zinc-200">
              <button 
                onClick={() => setProfileType('human')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${profileType === 'human' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600'}`}
              >
                Humans
              </button>
              <button 
                onClick={() => setProfileType('ai')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${profileType === 'ai' ? 'bg-pink-500 text-white shadow-sm' : 'text-zinc-600'}`}
              >
                AI Companions
              </button>
            </div>
          </div>
          
          {/* Divider */}
          <hr className="border-zinc-200"/>

          {profileType === 'human' ? (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Status</label>
                <div className="flex bg-zinc-200 p-1 rounded-xl border border-zinc-200">
                  <button onClick={() => setFilterOnline('all')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filterOnline === 'all' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600'}`}>Everyone</button>
                  <button onClick={() => setFilterOnline('online')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filterOnline === 'online' ? 'bg-pink-500 text-white shadow-sm' : 'text-zinc-600'}`}>Online Now</button>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-end"><label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Max Distance</label><span className="text-xs font-bold text-pink-500">{maxDistance} miles</span></div>
                <input type="range" min="1" max="100" value={maxDistance} onChange={(e) => setMaxDistance(parseInt(e.target.value))} className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-pink-500"/>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-end"><label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Age Range</label><span className="text-xs font-bold text-pink-500">{minAge} - {maxAge}</span></div>
                <div className="flex gap-4">
                  <div className="flex-1 space-y-1"><span className="text-[8px] text-zinc-600 uppercase font-bold">Min</span><input type="number" value={minAge} onChange={(e) => setMinAge(Math.max(18, parseInt(e.target.value) || 18))} className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-sm text-zinc-900 outline-none focus:border-pink-500"/></div>
                  <div className="flex-1 space-y-1"><span className="text-[8px] text-zinc-600 uppercase font-bold">Max</span><input type="number" value={maxAge} onChange={(e) => setMaxAge(Math.min(100, parseInt(e.target.value) || 100))} className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-sm text-zinc-900 outline-none focus:border-pink-500"/></div>
                </div>
              </div>
            </div>
          ) : (
             <div className="space-y-6 animate-in fade-in duration-300">
              <div className="space-y-3">
                <div className="flex justify-between items-end"><label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Age</label><span className="text-xs font-bold text-pink-500">{aiMinAge} - {aiMaxAge}</span></div>
                <div className="flex gap-4">
                  <div className="flex-1 space-y-1"><span className="text-[8px] text-zinc-600 uppercase font-bold">Min</span><input type="number" value={aiMinAge} onChange={(e) => setAiMinAge(Math.max(18, parseInt(e.target.value) || 18))} className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-sm text-zinc-900 outline-none focus:border-pink-500"/></div>
                  <div className="flex-1 space-y-1"><span className="text-[8px] text-zinc-600 uppercase font-bold">Max</span><input type="number" value={aiMaxAge} onChange={(e) => setAiMaxAge(Math.min(100, parseInt(e.target.value) || 100))} className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-sm text-zinc-900 outline-none focus:border-pink-500"/></div>
                </div>
              </div>
               <div className="space-y-3">
                <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Personality</label>
                <select value={aiPersonality} onChange={e => setAiPersonality(e.target.value)} className="w-full bg-white border border-zinc-300 rounded-lg py-2.5 px-3 text-sm text-zinc-900 outline-none focus:border-pink-500">
                  {AI_PERSONALITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Style</label>
                <select value={aiStyle} onChange={e => setAiStyle(e.target.value)} className="w-full bg-white border border-zinc-300 rounded-lg py-2.5 px-3 text-sm text-zinc-900 outline-none focus:border-pink-500">
                  {AI_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
        </div>
      )}

      {layoutMode === 'grid' ? (
        <div className="grid w-full grid-cols-2 gap-[0.225rem] px-[0.15rem] pb-24 sm:gap-[0.3rem] sm:px-[0.3rem]">
          <ExploreCarouselTile cloudCarouselAds={cloudCarouselAds} useRemoteCarousel={useRemoteCarousel} />
          {cloudDiscoverError ? (
            <div className="col-span-2 flex flex-col items-center justify-center gap-2 rounded-[0.65rem] border border-dashed border-red-200 bg-red-50/80 px-3 py-6 text-center">
              <p className="text-sm font-semibold text-red-800">{cloudDiscoverError}</p>
              {onReloadCloudDiscover ? (
                <button
                  type="button"
                  onClick={onReloadCloudDiscover}
                  className="rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white"
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}
          {cloudDiscoverLoading && !cloudDiscoverError ? (
            <div className="col-span-2 flex aspect-[3/4] max-h-40 items-center justify-center rounded-[0.65rem] border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-500">
              Loading people…
            </div>
          ) : null}
          {!cloudDiscoverLoading && filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <div
                key={user.id}
                onClick={() => (user.isLive && liveStreamingEnabled ? onSelectLive(user) : onSelectUser(user))}
                className="group relative aspect-[3/4] cursor-pointer overflow-hidden rounded-[0.65rem] border border-white transition-transform active:scale-[0.99]"
              >
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                {user.isAI && (
                  <div className="absolute left-2 top-2 z-20 flex items-center gap-1 rounded border border-white/20 bg-pink-600/80 px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter text-white shadow-lg backdrop-blur-md">
                    <span className="text-[10px]">🤖</span> AI
                  </div>
                )}
                {user.isLive && (
                  <div className="absolute left-2 top-2 z-20 flex items-center gap-2">
                    <div className="flex animate-pulse items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-tighter text-white shadow-lg">
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      LIVE
                    </div>
                    {user.viewerCount ? (
                      <div className="flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-1 text-[10px] font-bold text-white shadow-lg backdrop-blur-sm">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        <span>{user.viewerCount.toLocaleString()}</span>
                      </div>
                    ) : null}
                  </div>
                )}

                <ExploreTileVipCorner user={user} />

                <div className="absolute bottom-3 left-3 right-3 z-10">
                  <ExploreTileVipMoodChips user={user} />
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-[0.91875rem] font-bold text-white drop-shadow-md">
                      {user.name}, {user.age}
                    </h3>
                    {user.isOnline && !user.isLive && !user.isAI ? (
                      <span className="h-3 w-3 rounded-full bg-green-500" />
                    ) : null}
                  </div>
                  <p className="truncate text-[10px] text-zinc-300 drop-shadow-md">
                    {distanceLine(user, approximateDistance)}
                  </p>
                </div>
              </div>
            ))
          ) : !cloudDiscoverLoading ? (
            <div className="col-span-2 flex aspect-[3/4] flex-col items-center justify-center rounded-[0.65rem] border border-dashed border-zinc-200 bg-zinc-50 px-3 text-center">
              <span className="text-3xl grayscale opacity-50">🔍</span>
              <h3 className="mt-2 text-sm font-bold text-zinc-600">No results</h3>
              <p className="mt-1 text-[10px] text-zinc-500">Try adjusting filters</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-3 pb-24 sm:px-4">
          <ExploreCarouselTile
            cloudCarouselAds={cloudCarouselAds}
            useRemoteCarousel={useRemoteCarousel}
            layout="list"
          />
          {cloudDiscoverError ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-red-200 bg-red-50/80 px-3 py-6 text-center">
              <p className="text-sm font-semibold text-red-800">{cloudDiscoverError}</p>
              {onReloadCloudDiscover ? (
                <button
                  type="button"
                  onClick={onReloadCloudDiscover}
                  className="rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white"
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}
          {cloudDiscoverLoading && !cloudDiscoverError ? (
            <div className="flex min-h-[7rem] items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-500">
              Loading people…
            </div>
          ) : null}
          {!cloudDiscoverLoading && filteredUsers.length > 0
            ? filteredUsers.map((user) => {
                const mood = getUserMoodDisplay(user.mood);
                const vip = vipTierDisplay(user);
                return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => (user.isLive && liveStreamingEnabled ? onSelectLive(user) : onSelectUser(user))}
                  className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white p-2 text-left shadow-sm transition-transform active:scale-[0.99]"
                >
                  <img
                    src={user.avatar}
                    alt=""
                    className="h-[4.25rem] w-[4.25rem] shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-zinc-900">
                        {user.name}, {user.age}
                      </span>
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-800">
                        <span aria-hidden>{mood.icon}</span>
                        {mood.label}
                      </span>
                      {vip ? (
                        <span
                          className="inline-flex items-center gap-0.5 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-black uppercase text-amber-950"
                          title={vip.name}
                        >
                          <span aria-hidden className="text-sm leading-none">
                            {vip.icon}
                          </span>
                          VIP
                        </span>
                      ) : null}
                      {user.isAI ? (
                        <span className="rounded bg-pink-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-tight text-pink-700">
                          AI
                        </span>
                      ) : null}
                      {user.isLive ? (
                        <span className="flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-tight text-white">
                          <span className="h-1 w-1 rounded-full bg-white" />
                          Live
                        </span>
                      ) : null}
                      {user.isOnline && !user.isLive && !user.isAI ? (
                        <span className="h-2 w-2 rounded-full bg-green-500" title="Online" />
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {distanceLine(user, approximateDistance)}
                      {user.isLive && user.viewerCount ? ` · ${user.viewerCount.toLocaleString()} watching` : ''}
                    </p>
                  </div>
                </button>
              );
              })
            : !cloudDiscoverLoading ? (
                <div className="flex min-h-[10rem] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 text-center">
                  <span className="text-3xl grayscale opacity-50">🔍</span>
                  <h3 className="mt-2 text-sm font-bold text-zinc-600">No results</h3>
                  <p className="mt-1 text-[10px] text-zinc-500">Try adjusting filters</p>
                </div>
              ) : null}
        </div>
      )}

    </div>
  );
};

export default DiscoverView;