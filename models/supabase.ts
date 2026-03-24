/**
 * Row shapes for public.* tables (Supabase Postgres).
 * Keep in sync with supabase/migrations/*.sql
 */
import type { BadgeTier, PayoutDetails, UserGender } from '../types';
import type {
  DiscoveryPreferences,
  NotificationPreferences,
  PrivacyPreferences,
} from '../userPreferencesStore';

/** JSON columns as returned by PostgREST */
export type JsonRecord = Record<string, unknown>;

export type ProfileBadgeTierDb =
  | 'none'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'diamond';

export type AppNotificationTypeDb = 'super_like' | 'system';

export type UserAdSubmissionStatusDb = 'pending' | 'approved' | 'rejected';

export type ExploreCarouselSourceDb = 'platform' | 'user';

/** public.profiles — 1:1 with auth.users */
export type ProfileRow = {
  id: string;
  display_name: string;
  age: number;
  bio: string;
  avatar_url: string;
  location: string;
  gender: UserGender | null;
  interests: string[];
  album_urls: string[];
  badge_tier: ProfileBadgeTierDb;
  is_online: boolean;
  is_live: boolean;
  is_ai: boolean;
  personality: string[];
  style: string;
  video_url: string;
  voice_name: string;
  created_at: string;
  updated_at: string;
};

/** Lenient shape for PostgREST reads before/without full column set */
export type ProfileRowPartial = Partial<Omit<ProfileRow, 'id'>> & Pick<ProfileRow, 'id'>;

/** public.user_account — wallet + payout (private) */
export type UserAccountRow = {
  user_id: string;
  token_balance: number;
  earnings: string | number;
  transferred_out: string | number;
  payout_details: PayoutDetails | JsonRecord | null;
  pending_ad_refund_tokens: number;
  updated_at: string;
};

/** public.follows */
export type FollowRow = {
  follower_id: string;
  following_id: string;
  created_at: string;
};

/** public.user_blocks */
export type UserBlockRow = {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
};

/** public.match_pairs — user_low < user_high */
export type MatchPairRow = {
  user_low: string;
  user_high: string;
  created_at: string;
};

/** public.conversations — participant_a < participant_b */
export type ConversationRow = {
  id: string;
  participant_a: string;
  participant_b: string;
  last_message_at: string | null;
  created_at: string;
};

/** public.messages */
export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  image_url: string | null;
  video_url: string | null;
  audio_url: string | null;
  created_at: string;
};

export type AppNotificationSystemKindDb =
  | 'user_ad_expired'
  | 'user_ad_rejected'
  | 'user_ad_approved'
  | 'admin_broadcast';

/** public.app_notifications */
export type AppNotificationRow = {
  id: string;
  recipient_id: string;
  type: AppNotificationTypeDb;
  read: boolean;
  from_user_id: string | null;
  from_name: string | null;
  from_avatar: string | null;
  system_kind: AppNotificationSystemKindDb | string | null;
  system_message: string | null;
  created_at: string;
};

/** public.user_preferences — jsonb mirrors client stores */
export type UserPreferencesRow = {
  user_id: string;
  discovery: DiscoveryPreferences | JsonRecord;
  notifications: NotificationPreferences | JsonRecord;
  privacy: PrivacyPreferences | JsonRecord;
  updated_at: string;
};

/** public.user_ad_submissions */
export type UserAdSubmissionRow = {
  id: string;
  user_id: string;
  status: UserAdSubmissionStatusDb;
  title: string;
  subtitle: string;
  badge_label: string;
  image_url: string;
  image_data_url: string;
  background_color: string;
  link_url: string;
  display_duration_sec: number;
  duration_days: number;
  tokens_paid: number;
  created_at: string;
  reviewed_at: string | null;
  carousel_ad_id: string | null;
};

/** public.explore_carousel_ads */
export type ExploreCarouselAdRow = {
  id: string;
  enabled: boolean;
  badge_label: string;
  title: string;
  subtitle: string;
  image_url: string;
  image_data_url: string;
  background_color: string;
  link_url: string;
  display_duration_sec: number;
  source: ExploreCarouselSourceDb;
  user_submission_id: string | null;
  submitted_by_user_id: string | null;
  campaign_duration_days: number | null;
  campaign_started_at: string | null;
  campaign_ends_at: string | null;
  created_at: string;
  updated_at: string;
};

/** public.platform_settings — singleton id = 1 */
export type PlatformSettingsRow = {
  id: number;
  monetization: JsonRecord;
  updated_at: string;
};

/** public.gift_events */
export type GiftEventRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  gift_id: string;
  gift_name: string;
  token_value: number;
  created_at: string;
};

/** Table names for typed Supabase .from() calls */
export const SupabaseTable = {
  profiles: 'profiles',
  userAccount: 'user_account',
  follows: 'follows',
  userBlocks: 'user_blocks',
  matchPairs: 'match_pairs',
  conversations: 'conversations',
  messages: 'messages',
  appNotifications: 'app_notifications',
  userPreferences: 'user_preferences',
  userAdSubmissions: 'user_ad_submissions',
  exploreCarouselAds: 'explore_carousel_ads',
  platformSettings: 'platform_settings',
  giftEvents: 'gift_events',
} as const;

export type SupabaseTableName = (typeof SupabaseTable)[keyof typeof SupabaseTable];

/** Maps DB snake_case profile → app-facing User helpers use BadgeTier from types */
export function profileBadgeTierToApp(tier: ProfileBadgeTierDb | string | undefined): BadgeTier | undefined {
  if (
    tier === 'none' ||
    tier === 'bronze' ||
    tier === 'silver' ||
    tier === 'gold' ||
    tier === 'platinum' ||
    tier === 'diamond'
  ) {
    return tier;
  }
  return undefined;
}
