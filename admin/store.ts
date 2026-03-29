import type {
  User,
  BadgeInfo,
  TokenPackage,
  Gift,
  MonetizationSettings,
  PayoutDetails,
  ExploreCarouselAd,
  ExploreCarouselConfig,
  UserAdSubmission,
  UserAdDurationTier,
} from '../types';
import {
  MOCK_USERS,
  BADGE_TIERS,
  TOKEN_PACKAGES,
  GIFTS,
  DEFAULT_MONETIZATION_SETTINGS,
  DEFAULT_USER_AD_DURATION_TIERS,
} from '../constants';
import { addUserAdSystemNotification } from '../notificationsStore';
import { devError } from '../lib/devLog';

const STORAGE_KEY = 'zongo_admin_data';

const USER_AD_DAY_MS = 86400000;

function newAdId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `ad-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function newUserSubmissionId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `uad-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function newUserAdTierId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `uadt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Ensures each tier has an id and sane numbers; caps at 10. Legacy rows without id get new ids. */
export function normalizeUserAdDurationTiers(raw: unknown): UserAdDurationTier[] {
  if (!Array.isArray(raw)) {
    return DEFAULT_USER_AD_DURATION_TIERS.map((t) => ({ ...t }));
  }
  if (raw.length === 0) return [];
  const out: UserAdDurationTier[] = [];
  for (let i = 0; i < raw.length && out.length < 10; i++) {
    const t = raw[i] as Partial<UserAdDurationTier>;
    const durationDays = Math.max(1, Math.min(365, Math.round(Number(t.durationDays)) || 1));
    const tokenCost = Math.max(0, Math.round(Number(t.tokenCost)) || 0);
    const id = typeof t.id === 'string' && t.id.trim() ? t.id.trim() : newUserAdTierId();
    out.push({ id, durationDays, tokenCost });
  }
  return out;
}

export function normalizeExploreCarouselAd(a: Partial<ExploreCarouselAd> & { id: string }): ExploreCarouselAd {
  const source: 'platform' | 'user' = a.source === 'user' ? 'user' : 'platform';
  const base = {
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
    source,
  } as ExploreCarouselAd;
  if (source === 'user') {
    base.userSubmissionId = a.userSubmissionId ? String(a.userSubmissionId) : undefined;
    base.submittedByUserId = a.submittedByUserId ? String(a.submittedByUserId) : undefined;
    base.campaignDurationDays =
      typeof a.campaignDurationDays === 'number' && a.campaignDurationDays > 0
        ? Math.round(a.campaignDurationDays)
        : undefined;
    base.campaignStartedAt = typeof a.campaignStartedAt === 'number' ? a.campaignStartedAt : undefined;
    base.campaignEndsAt = typeof a.campaignEndsAt === 'number' ? a.campaignEndsAt : undefined;
  }
  return base;
}

/** When toggling Live on Explore for a user-submitted slide, set campaign window from now. */
export function computeUserAdLiveToggle(ad: ExploreCarouselAd, enabled: boolean): Partial<ExploreCarouselAd> {
  if (ad.source !== 'user') return { enabled };
  if (!enabled) return { enabled: false };
  const days = Math.max(1, ad.campaignDurationDays ?? 7);
  const now = Date.now();
  return {
    enabled: true,
    campaignStartedAt: now,
    campaignEndsAt: now + days * USER_AD_DAY_MS,
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
  /** User-submitted Explore ads awaiting review or history. */
  userAdSubmissions: UserAdSubmission[];
  /** Refund credits when an ad is rejected (consumed on next app load for that user). */
  pendingTokenCreditsByUserId: Record<string, number>;
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
    const tiers = data.monetizationSettings.userAdDurationTiers;
    if (!Array.isArray(tiers)) {
      data.monetizationSettings.userAdDurationTiers = [...DEFAULT_USER_AD_DURATION_TIERS];
    } else {
      data.monetizationSettings.userAdDurationTiers = normalizeUserAdDurationTiers(tiers);
    }
    if (!Array.isArray(data.userAdSubmissions)) {
      data.userAdSubmissions = [];
    }
    if (!data.pendingTokenCreditsByUserId || typeof data.pendingTokenCreditsByUserId !== 'object') {
      data.pendingTokenCreditsByUserId = {};
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

export const ADMIN_DATA_CHANGED_EVENT = 'zongo-admin-data-changed';

function saveToStorage(data: AdminData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(ADMIN_DATA_CHANGED_EVENT));
    }
  } catch (e) {
    devError('Failed to save admin data', e);
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
  userAdSubmissions: [],
  pendingTokenCreditsByUserId: {},
};

let cached: AdminData = loadFromStorage() ?? { ...defaultData };

// Deep clone for immutability
function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

export const adminStore = {
  /**
   * Reload `cached` from localStorage. Required when another tab/window saved admin data;
   * otherwise getters keep returning stale in-memory state.
   */
  hydrateFromLocalStorage(): void {
    const fresh = loadFromStorage();
    if (fresh) {
      cached = fresh;
    }
  },

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
    const m = clone(cached.monetizationSettings);
    m.userAdDurationTiers = normalizeUserAdDurationTiers(m.userAdDurationTiers);
    return m;
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
    cached.monetizationSettings = {
      ...settings,
      userAdDurationTiers: normalizeUserAdDurationTiers(settings.userAdDurationTiers),
    };
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

  getUserAdSubmissions(): UserAdSubmission[] {
    return clone(cached.userAdSubmissions ?? []);
  },

  getUserAdSubmissionsForUser(userId: string): UserAdSubmission[] {
    return (cached.userAdSubmissions ?? []).filter((s) => s.userId === userId).map((s) => ({ ...s }));
  },

  submitUserAdSubmission(payload: {
    userId: string;
    tierId: string;
    durationDays: number;
    tokensPaid: number;
    title: string;
    subtitle: string;
    badgeLabel: string;
    imageUrl: string;
    imageDataUrl: string;
    backgroundColor: string;
    linkUrl: string;
    displayDurationSec: number;
  }): { ok: true; id: string } | { ok: false; error: string } {
    const tiers = normalizeUserAdDurationTiers(cached.monetizationSettings.userAdDurationTiers);
    const tier = tiers.find((t) => t.id === payload.tierId);
    if (!tier) return { ok: false, error: 'Invalid ad pricing option.' };
    if (tier.durationDays !== payload.durationDays || tier.tokenCost !== payload.tokensPaid) {
      return { ok: false, error: 'Ad cost does not match the selected option.' };
    }
    const sub: UserAdSubmission = {
      id: newUserSubmissionId(),
      userId: payload.userId,
      status: 'pending',
      title: payload.title.trim(),
      subtitle: payload.subtitle.trim(),
      badgeLabel: payload.badgeLabel.trim() || 'Promo',
      imageUrl: payload.imageUrl.trim(),
      imageDataUrl: payload.imageDataUrl.trim(),
      backgroundColor: payload.backgroundColor.trim(),
      linkUrl: payload.linkUrl.trim(),
      displayDurationSec: Math.min(120, Math.max(3, Math.round(payload.displayDurationSec) || 8)),
      durationDays: payload.durationDays,
      tokensPaid: payload.tokensPaid,
      createdAt: Date.now(),
    };
    if (!cached.userAdSubmissions) cached.userAdSubmissions = [];
    cached.userAdSubmissions.push(sub);
    saveToStorage(cached);
    return { ok: true, id: sub.id };
  },

  /** Returns new carousel slide id so the UI can select it after refresh. */
  approveUserAdSubmission(submissionId: string): string | null {
    if (!cached.userAdSubmissions) cached.userAdSubmissions = [];
    const idx = cached.userAdSubmissions.findIndex((s) => s.id === submissionId && s.status === 'pending');
    if (idx < 0) return null;
    const s = cached.userAdSubmissions[idx];
    const slide = normalizeExploreCarouselAd({
      id: newAdId(),
      enabled: false,
      badgeLabel: s.badgeLabel,
      title: s.title,
      subtitle: s.subtitle,
      imageUrl: s.imageUrl,
      imageDataUrl: s.imageDataUrl,
      backgroundColor: s.backgroundColor,
      linkUrl: s.linkUrl,
      displayDurationSec: s.displayDurationSec,
      source: 'user',
      userSubmissionId: s.id,
      submittedByUserId: s.userId,
      campaignDurationDays: s.durationDays,
    });
    cached.exploreCarousel = {
      ads: [...(cached.exploreCarousel?.ads ?? []), slide].map((a) => normalizeExploreCarouselAd(a)),
    };
    cached.userAdSubmissions[idx] = {
      ...s,
      status: 'approved',
      reviewedAt: Date.now(),
      carouselAdId: slide.id,
    };
    saveToStorage(cached);
    addUserAdSystemNotification(
      s.userId,
      'user_ad_approved',
      'Your Explore ad was approved. An admin can set it live on Explore when ready.'
    );
    return slide.id;
  },

  rejectUserAdSubmission(submissionId: string): boolean {
    if (!cached.userAdSubmissions) cached.userAdSubmissions = [];
    const idx = cached.userAdSubmissions.findIndex((s) => s.id === submissionId && s.status === 'pending');
    if (idx < 0) return false;
    const s = cached.userAdSubmissions[idx];
    const credits = cached.pendingTokenCreditsByUserId ?? {};
    credits[s.userId] = (credits[s.userId] ?? 0) + s.tokensPaid;
    cached.pendingTokenCreditsByUserId = credits;
    cached.userAdSubmissions[idx] = { ...s, status: 'rejected', reviewedAt: Date.now() };
    saveToStorage(cached);
    addUserAdSystemNotification(
      s.userId,
      'user_ad_rejected',
      'Your Explore ad was not approved. The tokens you paid have been returned to your balance.'
    );
    return true;
  },

  /** Apply refunded tokens for this user (e.g. after a rejected ad). Returns amount credited. */
  consumePendingTokenCredits(userId: string): number {
    const credits = cached.pendingTokenCreditsByUserId ?? {};
    const amt = credits[userId] ?? 0;
    if (amt <= 0) return 0;
    const next = { ...credits };
    delete next[userId];
    cached.pendingTokenCreditsByUserId = next;
    saveToStorage(cached);
    return amt;
  },

  /** Disable expired user ads and notify owners. */
  processExpiredUserAds(): boolean {
    const ads = cached.exploreCarousel?.ads ?? [];
    let changed = false;
    const now = Date.now();
    const nextAds = ads.map((ad) => {
      if (ad.source !== 'user' || !ad.enabled || !ad.campaignEndsAt || ad.campaignEndsAt > now) {
        return ad;
      }
      changed = true;
      const uid = ad.submittedByUserId;
      if (uid) {
        addUserAdSystemNotification(
          uid,
          'user_ad_expired',
          'Your Explore ad campaign has ended and is no longer shown in the carousel.'
        );
      }
      return normalizeExploreCarouselAd({ ...ad, enabled: false, id: ad.id });
    });
    if (changed) {
      cached.exploreCarousel = { ads: nextAds.map((a) => normalizeExploreCarouselAd(a)) };
      saveToStorage(cached);
    }
    return changed;
  },

  resetToDefaults() {
    cached = clone(defaultData);
    saveToStorage(cached);
  },
};
