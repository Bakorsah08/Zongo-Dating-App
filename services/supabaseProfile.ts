import { profileBadgeTierToApp, type ProfileRowPartial } from '../models/supabase';
import type { BadgeTier, User, UserGender } from '../types';
import { normalizeUserMood } from '../userMoods';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { devError } from '../lib/devLog';

export type { ProfileRow, ProfileRowPartial } from '../models/supabase';

const PLACEHOLDER_AVATAR = 'https://picsum.photos/seed/zongo-profile/400/400';

function rowToUser(base: User, row: ProfileRowPartial): User {
  const avatar = row.avatar_url?.trim() || PLACEHOLDER_AVATAR;
  const album =
    row.album_urls && row.album_urls.length > 0 ? [...row.album_urls] : [avatar];
  const badgeTier = profileBadgeTierToApp(row.badge_tier) ?? base.badgeTier;

  return {
    ...base,
    id: row.id,
    name: row.display_name?.trim() || 'Member',
    age: Math.max(18, Math.min(100, row.age || 25)),
    bio: row.bio ?? '',
    avatar,
    interests: row.interests?.length ? [...row.interests] : base.interests,
    location: row.location?.trim() || '—',
    album,
    gender: row.gender ?? base.gender,
    badgeTier,
    isOnline: row.is_online ?? base.isOnline,
    isLive: row.is_live ?? base.isLive,
    isAI: row.is_ai ?? base.isAI,
    personality: row.personality?.length ? [...row.personality] : base.personality,
    style: row.style?.trim() ? row.style : base.style,
    videoUrl: row.video_url?.trim() ? row.video_url : base.videoUrl,
    voiceName: row.voice_name?.trim() ? row.voice_name : base.voiceName,
    mood: normalizeUserMood(row.mood ?? base.mood),
  };
}

export async function fetchMyProfile(userId: string, base: User): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) {
    devError('fetchMyProfile', error);
    return null;
  }
  if (!data) return null;
  return rowToUser(base, data as ProfileRowPartial);
}

export async function ensureProfileRow(userId: string, email: string | undefined): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = getSupabase();
  const local = email?.split('@')[0] || 'Member';
  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      display_name: local,
      age: 25,
      bio: '',
      avatar_url: PLACEHOLDER_AVATAR,
      location: '',
    },
    { onConflict: 'id' }
  );
  if (error) {
    devError('ensureProfileRow', error);
    return false;
  }
  return true;
}

export async function updateMyProfile(userId: string, updates: Partial<User>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = getSupabase();
  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.display_name = updates.name;
  if (updates.age !== undefined) patch.age = Math.max(18, Math.min(100, updates.age));
  if (updates.bio !== undefined) patch.bio = updates.bio;
  if (updates.avatar !== undefined) patch.avatar_url = updates.avatar;
  if (updates.location !== undefined) patch.location = updates.location;
  if (updates.gender !== undefined) patch.gender = updates.gender;
  if (updates.interests !== undefined) patch.interests = updates.interests;
  if (updates.album !== undefined) patch.album_urls = updates.album;
  if (updates.badgeTier !== undefined) patch.badge_tier = updates.badgeTier;
  if (updates.isOnline !== undefined) patch.is_online = updates.isOnline;
  if (updates.isLive !== undefined) patch.is_live = updates.isLive;
  if (updates.isAI !== undefined) patch.is_ai = updates.isAI;
  if (updates.personality !== undefined) patch.personality = updates.personality;
  if (updates.style !== undefined) patch.style = updates.style;
  if (updates.videoUrl !== undefined) patch.video_url = updates.videoUrl;
  if (updates.voiceName !== undefined) patch.voice_name = updates.voiceName;
  if (updates.mood !== undefined) patch.mood = updates.mood;
  if (Object.keys(patch).length === 0) return true;
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) {
    devError('updateMyProfile', error);
    return false;
  }
  return true;
}

export async function updateProfileGender(userId: string, gender: UserGender): Promise<boolean> {
  return updateMyProfile(userId, { gender });
}
