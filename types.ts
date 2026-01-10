
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
}

export interface Message {
  id: string;
  senderId: string;
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  timestamp: number;
}

export enum View {
  EXPLORE = 'explore',
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
  currentView: View;
  selectedChatPartner?: User;
  selectedLiveHost?: User;
  selectedUserForDetail?: User;
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