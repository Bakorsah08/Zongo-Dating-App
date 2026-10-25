import type { ProfileRowPartial } from '../models/supabase';
import { profileBadgeTierToApp } from '../models/supabase';
import type { User } from '../types';
import { normalizeUserMood } from '../userMoods';

const PLACEHOLDER_AVATAR = 'https://picsum.photos/seed/zongo-profile/400/400';

/** Deterministic fake distance for grid sorting when we have no geo in DB */
export function stableDistanceFromId(id: string, maxMiles: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % Math.max(1, maxMiles)) + 1;
}

export function profileRowToPublicUser(row: ProfileRowPartial, maxDistanceMiles = 50): User {
  const avatar = row.avatar_url?.trim() || PLACEHOLDER_AVATAR;
  const album =
    row.album_urls && row.album_urls.length > 0 ? [...row.album_urls] : [avatar];
  return {
    id: row.id,
    name: row.display_name?.trim() || 'Member',
    age: Math.max(18, Math.min(100, row.age ?? 25)),
    bio: row.bio ?? '',
    avatar,
    interests: row.interests?.length ? [...row.interests] : [],
    location: row.location?.trim() || '—',
    distance: stableDistanceFromId(row.id, maxDistanceMiles),
    isOnline: row.is_online ?? false,
    isLive: row.is_live ?? false,
    isAI: row.is_ai ?? false,
    album,
    personality: row.personality?.length ? [...row.personality] : undefined,
    style: row.style?.trim() || undefined,
    videoUrl: row.video_url?.trim() || undefined,
    voiceName: row.voice_name?.trim() || undefined,
    badgeTier: profileBadgeTierToApp(row.badge_tier) ?? 'none',
    gender: row.gender ?? undefined,
    mood: normalizeUserMood(row.mood),
  };
}
