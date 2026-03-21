import type { User, BadgeInfo, TokenPackage, Gift, MonetizationSettings, PayoutDetails, ExploreSpotlight } from '../types';
import { MOCK_USERS, BADGE_TIERS, TOKEN_PACKAGES, GIFTS, DEFAULT_MONETIZATION_SETTINGS } from '../constants';

const STORAGE_KEY = 'zongo_admin_data';

export const DEFAULT_EXPLORE_SPOTLIGHT: ExploreSpotlight = {
  enabled: false,
  badgeLabel: 'Promo',
  title: 'Featured on Zongo',
  subtitle: 'Tap to see this week’s highlight',
  imageUrl: '',
  imageDataUrl: '',
  backgroundColor: '',
  linkUrl: '',
};

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
  /** Explore first-card spotlight (ads / announcements). */
  exploreSpotlight: ExploreSpotlight;
}

function loadFromStorage(): AdminData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as AdminData;
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
    if (!data.exploreSpotlight || typeof data.exploreSpotlight !== 'object') {
      data.exploreSpotlight = { ...DEFAULT_EXPLORE_SPOTLIGHT };
    } else {
      data.exploreSpotlight = { ...DEFAULT_EXPLORE_SPOTLIGHT, ...data.exploreSpotlight };
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
  exploreSpotlight: { ...DEFAULT_EXPLORE_SPOTLIGHT },
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

  getExploreSpotlight(): ExploreSpotlight {
    const s = cached.exploreSpotlight;
    if (!s) return { ...DEFAULT_EXPLORE_SPOTLIGHT };
    return { ...DEFAULT_EXPLORE_SPOTLIGHT, ...clone(s) };
  },

  setExploreSpotlight(updates: Partial<ExploreSpotlight>) {
    cached.exploreSpotlight = {
      ...DEFAULT_EXPLORE_SPOTLIGHT,
      ...(cached.exploreSpotlight || {}),
      ...updates,
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
