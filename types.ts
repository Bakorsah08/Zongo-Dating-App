export type BadgeTier = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface BadgeInfo {
  id: BadgeTier;
  name: string;
  icon: string;
  tokenCost: number;
  minEarningsToEarn: number; // Earn free by receiving this much in gifts
  rank: number; // Higher = better ranking on explore
}

/** Bank or mobile money payout details */
export interface PayoutDetails {
  type: 'bank' | 'mobile_money';
  /** For bank */
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  /** For mobile money */
  provider?: string; // e.g. MTN, Vodafone, Airtel
  mobileNumber?: string;
}

export type UserGender = 'male' | 'female';

export interface User {
  id: string;
  name: string;
  age: number;
  bio: string;
  avatar: string;
  interests: string[];
  location: string;
  distance: number; // Distance in miles/km for filtering
  isLive?: boolean;
  isOnline: boolean; // Online status for filtering
  album: string[];
  earnings?: number; // Total earnings from gifts
  viewerCount?: number; // Number of viewers for live stream
  isAI?: boolean; // Flag for AI companions
  personality?: string[]; // For AI "features"
  style?: string; // For AI "dressing"
  videoUrl?: string; // For AI video call simulation
  voiceName?: string; // For AI voice selection
  transferredOut?: number; // Amount withdrawn to bank/mobile money
  payoutDetails?: PayoutDetails;
  badgeTier?: BadgeTier; // VIP badge - affects explore page ranking
  gender?: UserGender; // For explore filtering (male sees females, female sees males)
}

/** One slide in the Explore first-tile carousel (Ad centre). */
export interface ExploreCarouselAd {
  id: string;
  /** When true, included in the live carousel on Explore. */
  enabled: boolean;
  badgeLabel: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  imageDataUrl: string;
  backgroundColor: string;
  linkUrl: string;
  /** Seconds to show this slide before advancing (carousel uses 3–120). */
  displayDurationSec: number;
}

export interface ExploreCarouselConfig {
  /** Order matches carousel sequence on Explore. */
  ads: ExploreCarouselAd[];
}

/** In-app notification stored per recipient user id (e.g. Super Like). */
export type AppNotificationType = 'super_like';

export interface AppNotification {
  id: string;
  type: AppNotificationType;
  fromUserId: string;
  fromName: string;
  fromAvatar: string;
  createdAt: number;
  read: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  /** Voice note (e.g. blob: URL from MediaRecorder). */
  audioUrl?: string;
  timestamp: number;
}

export enum View {
  EXPLORE = 'explore',
  FOLLOWING = 'following', // People I'm following
  CHATS = 'chats',
  CHAT_ROOM = 'chat_room',
  VIDEO_CALL = 'video_call',
  LIVE_STREAM = 'live_stream',
  HOST_LIVE = 'host_live', // Added for hosting own stream
  PROFILE = 'profile',
  TOKEN_SHOP = 'token_shop',
  USER_DETAIL = 'user_detail',
  HOME = 'home',
  CASH_OUT = 'cash_out',
}

export interface AppState {
  currentUser: User;
  tokens: number;
  matches: User[];
  followingIds: string[]; // User IDs the current user is following
  currentView: View;
  selectedChatPartner?: User;
  selectedLiveHost?: User;
  selectedUserForDetail?: User;
  profileReturnView?: View; // Where to go when backing from user profile
  liveStreamParticipants?: User[]; // Host + up to 3 guests for multi-person live
  /** Host mic/camera — synced so viewers see the same overlays when watching your id */
  liveHostBroadcastMedia?: { micOn: boolean; camOn: boolean };
}

export interface TokenPackage {
  id: string;
  tokens: number;
  price: string;
}

export interface Gift {
  id: string;
  name: string;
  icon: string;
  value: number;
}

/** Admin-managed monetization: token costs and feature flags. */
export interface MonetizationSettings {
  starterTokens: number;
  liveStreamEntryTokens: number;
  videoCallTokens: number;
  /** Tokens charged each billing tick (~10s) during an active call, after the upfront connection cost. */
  videoCallPerIntervalTokens: number;
  superLikeTokens: number;
  liveStreamingEnabled: boolean;
  giftingEnabled: boolean;
  videoCallEnabled: boolean;
  vipBadgesEnabled: boolean;
  creatorCashoutEnabled: boolean;
  creatorRevenueSharePercent: number;
}
