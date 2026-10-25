import type { UserMoodId } from './types';

export const USER_MOOD_OPTIONS: ReadonlyArray<{ id: UserMoodId; label: string; icon: string }> = [
  { id: 'neutral', label: 'Open', icon: '💬' },
  { id: 'happy', label: 'Happy', icon: '😊' },
  { id: 'flirty', label: 'Flirty', icon: '😉' },
  { id: 'chill', label: 'Chill', icon: '😌' },
  { id: 'romantic', label: 'Romantic', icon: '💕' },
  { id: 'party', label: 'Party', icon: '🎉' },
  { id: 'focus', label: 'Busy', icon: '💼' },
];

const MOOD_IDS = new Set<UserMoodId>(USER_MOOD_OPTIONS.map((m) => m.id));

export function normalizeUserMood(raw: string | undefined | null): UserMoodId {
  if (raw && MOOD_IDS.has(raw as UserMoodId)) return raw as UserMoodId;
  return 'neutral';
}

export function getUserMoodDisplay(id: UserMoodId | undefined): (typeof USER_MOOD_OPTIONS)[number] {
  const mid = id ?? 'neutral';
  return USER_MOOD_OPTIONS.find((m) => m.id === mid) ?? USER_MOOD_OPTIONS[0];
}
