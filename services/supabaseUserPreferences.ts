import { SupabaseTable } from '../models/supabase';
import type { UserPreferences } from '../userPreferencesStore';
import { USER_PREFERENCES_DEFAULTS } from '../userPreferencesStore';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function mergeDiscovery(
  base: UserPreferences['discovery'],
  raw: unknown
): UserPreferences['discovery'] {
  if (!isRecord(raw)) return base;
  return {
    ...base,
    ...(raw as Partial<UserPreferences['discovery']>),
  };
}

function mergeNotifications(
  base: UserPreferences['notifications'],
  raw: unknown
): UserPreferences['notifications'] {
  if (!isRecord(raw)) return base;
  return {
    ...base,
    ...(raw as Partial<UserPreferences['notifications']>),
  };
}

/** Privacy JSON in DB only stores non-block fields; blocks are `user_blocks`. */
function mergePrivacyRemote(
  base: UserPreferences['privacy'],
  raw: unknown
): Pick<UserPreferences['privacy'], 'showApproximateDistanceOnly'> {
  if (!isRecord(raw)) return { showApproximateDistanceOnly: base.showApproximateDistanceOnly };
  const show =
    typeof raw.showApproximateDistanceOnly === 'boolean'
      ? raw.showApproximateDistanceOnly
      : base.showApproximateDistanceOnly;
  return { showApproximateDistanceOnly: show };
}

export async function fetchUserPreferencesFromDb(userId: string): Promise<Partial<UserPreferences> | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabase()
    .from(SupabaseTable.userPreferences)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('fetchUserPreferencesFromDb', error);
    return null;
  }
  if (!data) return null;
  const d = data as { discovery: unknown; notifications: unknown; privacy: unknown };
  const base = USER_PREFERENCES_DEFAULTS;
  return {
    discovery: mergeDiscovery(base.discovery, d.discovery),
    notifications: mergeNotifications(base.notifications, d.notifications),
    privacy: {
      ...base.privacy,
      ...mergePrivacyRemote(base.privacy, d.privacy),
      blockedUserIds: [],
    },
  };
}

export async function upsertUserPreferencesDb(userId: string, prefs: UserPreferences): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const privacy = {
    showApproximateDistanceOnly: prefs.privacy.showApproximateDistanceOnly,
  };
  const { error } = await getSupabase().from(SupabaseTable.userPreferences).upsert(
    {
      user_id: userId,
      discovery: prefs.discovery as unknown as Record<string, unknown>,
      notifications: prefs.notifications as unknown as Record<string, unknown>,
      privacy: privacy as unknown as Record<string, unknown>,
    },
    { onConflict: 'user_id' }
  );
  if (error) {
    console.error('upsertUserPreferencesDb', error);
    return false;
  }
  return true;
}
