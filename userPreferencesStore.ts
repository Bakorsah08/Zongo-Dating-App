export type DiscoveryTextFilter = 'all' | 'recommend' | 'newcomer' | 'nearby' | 'live';

export interface DiscoveryPreferences {
  activeTextFilter: DiscoveryTextFilter;
  profileType: 'human' | 'ai';
  filterOnline: 'all' | 'online';
  maxDistance: number;
  minAge: number;
  maxAge: number;
  aiMinAge: number;
  aiMaxAge: number;
  aiPersonality: string;
  aiStyle: string;
}

export interface NotificationPreferences {
  superLikeEnabled: boolean;
  systemEnabled: boolean;
}

export interface PrivacyPreferences {
  blockedUserIds: string[];
  showApproximateDistanceOnly: boolean;
}

export interface UserPreferences {
  discovery: DiscoveryPreferences;
  notifications: NotificationPreferences;
  privacy: PrivacyPreferences;
}

const STORAGE_KEY = 'zongo_user_preferences_v1';

export const USER_PREFERENCES_UPDATED_EVENT = 'zongo-user-preferences-updated';

const DEFAULTS: UserPreferences = {
  discovery: {
    activeTextFilter: 'all',
    profileType: 'human',
    filterOnline: 'all',
    maxDistance: 50,
    minAge: 18,
    maxAge: 50,
    aiMinAge: 18,
    aiMaxAge: 35,
    aiPersonality: 'Any',
    aiStyle: 'Any',
  },
  notifications: {
    superLikeEnabled: true,
    systemEnabled: true,
  },
  privacy: {
    blockedUserIds: [],
    showApproximateDistanceOnly: false,
  },
};

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function mergePrefs(base: UserPreferences, patch: Partial<UserPreferences>): UserPreferences {
  const d = { ...base.discovery, ...patch.discovery };
  const n = { ...base.notifications, ...patch.notifications };
  const blocked =
    patch.privacy && Array.isArray(patch.privacy.blockedUserIds)
      ? [...patch.privacy.blockedUserIds]
      : [...base.privacy.blockedUserIds];
  const p = {
    ...base.privacy,
    ...patch.privacy,
    blockedUserIds: blocked,
  };
  return { discovery: d, notifications: n, privacy: p };
}

function load(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULTS);
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    if (!parsed || typeof parsed !== 'object') return clone(DEFAULTS);
    return mergePrefs(clone(DEFAULTS), parsed);
  } catch {
    return clone(DEFAULTS);
  }
}

function save(p: UserPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore quota */
  }
}

let cache: UserPreferences | null = null;

export function getUserPreferences(): UserPreferences {
  if (!cache) cache = load();
  return cache;
}

export function updateUserPreferences(patch: Partial<UserPreferences>): void {
  cache = mergePrefs(getUserPreferences(), patch);
  save(cache);
  window.dispatchEvent(new Event(USER_PREFERENCES_UPDATED_EVENT));
}

export function getDiscoveryPreferences(): DiscoveryPreferences {
  return { ...getUserPreferences().discovery };
}

export function setDiscoveryPreferences(next: DiscoveryPreferences): void {
  updateUserPreferences({ discovery: { ...next } });
}

export function getNotificationPreferences(): NotificationPreferences {
  return { ...getUserPreferences().notifications };
}

export function setNotificationPreferences(next: Partial<NotificationPreferences>): void {
  const cur = getUserPreferences();
  updateUserPreferences({ notifications: { ...cur.notifications, ...next } });
}

export function getPrivacyPreferences(): PrivacyPreferences {
  const p = getUserPreferences().privacy;
  return { ...p, blockedUserIds: [...p.blockedUserIds] };
}

export function setPrivacyPreferences(next: Partial<PrivacyPreferences>): void {
  const cur = getUserPreferences();
  const blocked =
    next.blockedUserIds !== undefined ? [...next.blockedUserIds] : [...cur.privacy.blockedUserIds];
  updateUserPreferences({
    privacy: { ...cur.privacy, ...next, blockedUserIds: blocked },
  });
}

export function addBlockedUserId(userId: string): void {
  if (!userId) return;
  const { blockedUserIds } = getPrivacyPreferences();
  if (blockedUserIds.includes(userId)) return;
  setPrivacyPreferences({ blockedUserIds: [...blockedUserIds, userId] });
}

export function removeBlockedUserId(userId: string): void {
  const { blockedUserIds } = getPrivacyPreferences();
  setPrivacyPreferences({ blockedUserIds: blockedUserIds.filter((id) => id !== userId) });
}
