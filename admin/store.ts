import type {
  User,
  BadgeInfo,
  TokenPackage,
  Gift,
  MonetizationSettings,
  PayoutDetails,
  ExploreCarouselAd,
  ExploreCarouselConfig,
} from '../types';
import { MOCK_USERS, BADGE_TIERS, TOKEN_PACKAGES, GIFTS, DEFAULT_MONETIZATION_SETTINGS } from '../constants';

const STORAGE_KEY = 'zongo_admin_data';

function newAdId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `ad-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeExploreCarouselAd(a: Partial<ExploreCarouselAd> & { id: string }): ExploreCarouselAd {
  return {
    id: a.id,
    enabled: Boolean(a.enabled),
    badgeLabel: String(a.badgeLabel ?? 'Promo'),
    title: String(a.title ?? ''),
    subtitle: String(a.subtitle ?? ''),
    imageUrl: String(a.imageUrl ?? ''),
    imageDataUrl: String(a.imageDataUrl ?? ''),
    backgroundColor: String(a.backgroundColor ?? ''),
    linkUrl: String(a.linkUrl ?? ''),
    displayDurationSec: Math.min(120, Math.max(3, Math.round(Number(a.displayDurationSec)) || 8)),
  };
}

type LegacySpotlight = {
  enabled?: boolean;
  badgeLabel?: string;
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  imageDataUrl?: string;
  backgroundColor?: string;
  linkUrl?: string;
};

function migrateLegacySpotlight(legacy: LegacySpotlight): ExploreCarouselConfig {
  return {
    ads: [
      normalizeExploreCarouselAd({
        id: 'migrated-1',
        enabled: Boolean(legacy.enabled),
        badgeLabel: legacy.badgeLabel,
        title: legacy.title,
        subtitle: legacy.subtitle,
        imageUrl: legacy.imageUrl,
        imageDataUrl: legacy.imageDataUrl,
        backgroundColor: legacy.backgroundColor,
        linkUrl: legacy.linkUrl,
        displayDurationSec: 8,
      }),
    ],
  };
}

function normalizeExploreCarousel(raw: unknown): ExploreCarouselConfig {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as ExploreCarouselConfig).ads)) {
    return { ads: [] };
  }
  const ads = ((raw as ExploreCarouselConfig).ads as Partial<ExploreCarouselAd>[])
    .filter((x) => x && typeof x === 'object' && typeof (x as ExploreCarouselAd).id === 'string')
    .map((x) => normalizeExploreCarouselAd(x as ExploreCarouselAd));
  return { ads };
}

export const DEFAULT_NEW_EXPLORE_AD = (): ExploreCarouselAd =>
  normalizeExploreCarouselAd({
    id: newAdId(),
    enabled: false,
    badgeLabel: 'Promo',
    title: 'Featured on Zongo',
    subtitle: "Tap to see this week's highlight",
    imageUrl: '',
    imageDataUrl: '',
    backgroundColor: '',
    linkUrl: '',
    displayDurationSec: 8,
  });

export interface AdminData {
  users: User[];
  badges: BadgeInfo[];
  tokenPackages: TokenPackage[];
  gifts: Gift[];
  monetizationSettings: MonetizationSettings;
  /** Platform revenue from token sales (USD). Updated when users purchase token packages. */
  platformRevenueFromTokenSales: number;
  /** Amount platform owner has withdrawn to bank/mobile money */
  platformTransferredOut: number;
  /** Platform owner's bank or mobile money details for withdrawals */
  platformPayoutDetails: PayoutDetails | null;
  /** Explore first-tile carousel (ads / announcements). */
  exploreCarousel: ExploreCarouselConfig;
}

function loadFromStorage(): AdminData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as AdminData & { exploreSpotlight?: LegacySpotlight };
    if (!data.monetizationSettings) {
      data.monetizationSettings = { ...DEFAULT_MONETIZATION_SETTINGS };
    } else {
      data.monetizationSettings = { ...DEFAULT_MONETIZATION_SETTINGS, ...data.monetizationSettings };
    }
    if (typeof data.platformRevenueFromTokenSales !== 'number') {
      data.platformRevenueFromTokenSales = 0;
    }
    if (typeof data.platformTransferredOut !== 'number') {
      data.platformTransferredOut = 0;
    }
    if (!data.platformPayoutDetails) {
      data.platformPayoutDetails = null;
    }
    const rawSpot = (data as { exploreSpotlight?: LegacySpotlight }).exploreSpotlight;
    if (rawSpot && typeof rawSpot === 'object' && !(data as { exploreCarousel?: unknown }).exploreCarousel) {
      data.exploreCarousel = migrateLegacySpotlight(rawSpot);
      delete (data as { exploreSpotlight?: LegacySpotlight }).exploreSpotlight;
    } else {
      data.exploreCarousel = normalizeExploreCarousel((data as { exploreCarousel?: unknown }).exploreCarousel);
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
    return data as AdminData;
  } catch {
    return null;
  }
}

function saveToStorage(data: AdminData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save admin data:', e);
  }
}

const defaultData: AdminData = {
  users: [...MOCK_USERS],
  badges: [...BADGE_TIERS],
  tokenPackages: [...TOKEN_PACKAGES],
  gifts: [...GIFTS],
  monetizationSettings: { ...DEFAULT_MONETIZATION_SETTINGS },
  platformRevenueFromTokenSales: 0,
  platformTransferredOut: 0,
  platformPayoutDetails: null,
  exploreCarousel: { ads: [] },
};

let cached: AdminData = loadFromStorage() ?? { ...defaultData };

// Deep clone for immutability
function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

export const adminStore = {
  getData(): AdminData {
    return clone(cached);
  },

  getUsers(): User[] {
    const users = clone(cached.users);
    // Backfill gender from MOCK_USERS for users loaded from storage (may lack gender)
    return users.map(u => {
      if (u.gender != null) return u;
      const mock = MOCK_USERS.find(m => m.id === u.id);
      return mock ? { ...u, gender: mock.gender } : u;
    });
  },

  getBadges(): BadgeInfo[] {
    return clone(cached.badges);
  },

  getTokenPackages(): TokenPackage[] {
    return clone(cached.tokenPackages);
  },

  getGifts(): Gift[] {
    return clone(cached.gifts);
  },

  getMonetizationSettings(): MonetizationSettings {
    return clone(cached.monetizationSettings);
  },

  getExploreCarousel(): ExploreCarouselConfig {
    return clone(cached.exploreCarousel ?? { ads: [] });
  },

  setExploreCarouselAds(ads: ExploreCarouselAd[]) {
    cached.exploreCarousel = {
      ads: ads.map((a) => normalizeExploreCarouselAd(a)),
    };
    saveToStorage(cached);
  },

  getPlatformRevenueFromTokenSales(): number {
    return cached.platformRevenueFromTokenSales ?? 0;
  },

  addPlatformRevenueFromTokenSales(amount: number) {
    cached.platformRevenueFromTokenSales = (cached.platformRevenueFromTokenSales ?? 0) + amount;
    saveToStorage(cached);
  },

  getPlatformTransferredOut(): number {
    return cached.platformTransferredOut ?? 0;
  },

  addPlatformTransferredOut(amount: number) {
    cached.platformTransferredOut = (cached.platformTransferredOut ?? 0) + amount;
    saveToStorage(cached);
  },

  getPlatformPayoutDetails(): PayoutDetails | null {
    return cached.platformPayoutDetails ? { ...cached.platformPayoutDetails } : null;
  },

  setPlatformPayoutDetails(details: PayoutDetails | null) {
    cached.platformPayoutDetails = details;
    saveToStorage(cached);
  },

  setMonetizationSettings(settings: MonetizationSettings) {
    cached.monetizationSettings = settings;
    saveToStorage(cached);
  },

  setUsers(users: User[]) {
    cached.users = users;
    saveToStorage(cached);
  },

  setBadges(badges: BadgeInfo[]) {
    cached.badges = badges;
    saveToStorage(cached);
  },

  setTokenPackages(packages: TokenPackage[]) {
    cached.tokenPackages = packages;
    saveToStorage(cached);
  },

  setGifts(gifts: Gift[]) {
    cached.gifts = gifts;
    saveToStorage(cached);
  },

  updateUser(id: string, updates: Partial<User>) {
    const idx = cached.users.findIndex((u) => u.id === id);
    if (idx >= 0) {
      cached.users[idx] = { ...cached.users[idx], ...updates };
      saveToStorage(cached);
    }
  },

  addUser(user: User) {
    cached.users.push(user);
    saveToStorage(cached);
  },

  deleteUser(id: string) {
    cached.users = cached.users.filter((u) => u.id !== id);
    saveToStorage(cached);
  },

  updateBadge(id: string, updates: Partial<BadgeInfo>) {
    const idx = cached.badges.findIndex((b) => b.id === id);
    if (idx >= 0) {
      cached.badges[idx] = { ...cached.badges[idx], ...updates };
      saveToStorage(cached);
    }
  },

  updateTokenPackage(id: string, updates: Partial<TokenPackage>) {
    const idx = cached.tokenPackages.findIndex((p) => p.id === id);
    if (idx >= 0) {
      cached.tokenPackages[idx] = { ...cached.tokenPackages[idx], ...updates };
      saveToStorage(cached);
    }
  },

  addTokenPackage(pkg: TokenPackage) {
    cached.tokenPackages.push(pkg);
    saveToStorage(cached);
  },

  deleteTokenPackage(id: string) {
    cached.tokenPackages = cached.tokenPackages.filter((p) => p.id !== id);
    saveToStorage(cached);
  },

  updateGift(id: string, updates: Partial<Gift>) {
    const idx = cached.gifts.findIndex((g) => g.id === id);
    if (idx >= 0) {
      cached.gifts[idx] = { ...cached.gifts[idx], ...updates };
      saveToStorage(cached);
    }
  },

  addGift(gift: Gift) {
    cached.gifts.push(gift);
    saveToStorage(cached);
  },

  deleteGift(id: string) {
    cached.gifts = cached.gifts.filter((g) => g.id !== id);
    saveToStorage(cached);
  },

  resetToDefaults() {
    cached = clone(defaultData);
    saveToStorage(cached);
  },
};
