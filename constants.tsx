import { User, TokenPackage, Gift, BadgeInfo, MonetizationSettings } from './types';

export const BADGE_TIERS: BadgeInfo[] = [
  { id: 'none', name: 'No Badge', icon: '', tokenCost: 0, minEarningsToEarn: 0, rank: 0 },
  { id: 'bronze', name: 'Bronze VIP', icon: '🥉', tokenCost: 50, minEarningsToEarn: 100, rank: 1 },
  { id: 'silver', name: 'Silver VIP', icon: '🥈', tokenCost: 150, minEarningsToEarn: 500, rank: 2 },
  { id: 'gold', name: 'Gold VIP', icon: '🥇', tokenCost: 500, minEarningsToEarn: 2000, rank: 3 },
  { id: 'platinum', name: 'Platinum VIP', icon: '💎', tokenCost: 999, minEarningsToEarn: 5000, rank: 4 },
  { id: 'diamond', name: 'Diamond VIP', icon: '👑', tokenCost: 2999, minEarningsToEarn: 10000, rank: 5 },
];

export const MOCK_USERS: User[] = [
  {
    id: '1',
    name: 'Sarah',
    age: 24,
    bio: 'Adventure seeker and coffee lover. Let\'s explore the city together!',
    avatar: 'https://picsum.photos/seed/sarah/600/800',
    interests: ['Travel', 'Coffee', 'Hiking'],
    location: '2 miles away',
    distance: 2,
    isOnline: true,
    isLive: true,
    viewerCount: 1234,
    album: [
      'https://picsum.photos/seed/sarah1/400/400',
      'https://picsum.photos/seed/sarah2/400/400',
      'https://picsum.photos/seed/sarah3/400/400',
      'https://picsum.photos/seed/sarah4/400/400'
    ],
    earnings: 1250,
    badgeTier: 'gold',
    gender: 'female'
  },
  {
    id: '2',
    name: 'Alex',
    age: 28,
    bio: 'Musician and part-time chef. I can cook a mean lasagna.',
    avatar: 'https://picsum.photos/seed/alex/600/800',
    interests: ['Music', 'Cooking', 'Art'],
    location: '5 miles away',
    distance: 5,
    isOnline: false,
    isLive: false,
    album: [
      'https://picsum.photos/seed/alex1/400/400',
      'https://picsum.photos/seed/alex2/400/400'
    ],
    badgeTier: 'bronze',
    gender: 'male'
  },
  {
    id: '3',
    name: 'Chloe',
    age: 22,
    bio: 'Tech enthusiast and gamer. Always down for a round of Valorant.',
    avatar: 'https://picsum.photos/seed/chloe/600/800',
    interests: ['Gaming', 'Tech', 'Anime'],
    location: '1 mile away',
    distance: 1,
    isOnline: true,
    isLive: true,
    viewerCount: 876,
    album: [
      'https://picsum.photos/seed/chloe1/400/400',
      'https://picsum.photos/seed/chloe2/400/400',
      'https://picsum.photos/seed/chloe3/400/400'
    ],
    earnings: 840,
    badgeTier: 'silver',
    gender: 'female'
  },
  {
    id: '4',
    name: 'Elena',
    age: 32,
    bio: 'Yoga instructor and wellness coach. Positive vibes only!',
    avatar: 'https://picsum.photos/seed/elena/600/800',
    interests: ['Yoga', 'Wellness', 'Books'],
    location: '12 miles away',
    distance: 12,
    isOnline: true,
    isLive: false,
    album: [
      'https://picsum.photos/seed/elena1/400/400',
      'https://picsum.photos/seed/elena2/400/400'
    ],
    badgeTier: 'platinum',
    gender: 'female'
  },
  {
    id: '5',
    name: 'Marcus',
    age: 27,
    bio: 'Photography and street food. Finding the best tacos in town.',
    avatar: 'https://picsum.photos/seed/marcus/600/800',
    interests: ['Photo', 'Food'],
    location: '3 miles away',
    distance: 3,
    isOnline: false,
    isLive: false,
    album: [
      'https://picsum.photos/seed/marcus1/400/400',
      'https://picsum.photos/seed/marcus2/400/400',
      'https://picsum.photos/seed/marcus3/400/400'
    ],
    badgeTier: 'none',
    gender: 'male'
  },
  {
    id: '6',
    name: 'Jasmine',
    age: 25,
    bio: 'Digital nomad. Ask me about my last trip!',
    avatar: 'https://picsum.photos/seed/jasmine/600/800',
    interests: ['Travel', 'Business'],
    location: '20 miles away',
    distance: 20,
    isOnline: true,
    isLive: true,
    viewerCount: 2500,
    album: [
      'https://picsum.photos/seed/jasmine1/400/400'
    ],
    earnings: 2100,
    badgeTier: 'diamond',
    gender: 'female'
  },
  {
    id: '7',
    name: 'Ryan',
    age: 35,
    bio: 'Tech entrepreneur and fitness junkie.',
    avatar: 'https://picsum.photos/seed/ryan/600/800',
    interests: ['Fitness', 'Startups'],
    location: '8 miles away',
    distance: 8,
    isOnline: true,
    isLive: false,
    album: [],
    badgeTier: 'silver',
    gender: 'male'
  },
  {
    id: '8',
    name: 'Sophia',
    age: 21,
    bio: 'Art student and cat mom.',
    avatar: 'https://picsum.photos/seed/sophia/600/800',
    interests: ['Art', 'Cats'],
    location: '4 miles away',
    distance: 4,
    isOnline: false,
    isLive: false,
    album: [],
    badgeTier: 'none',
    gender: 'female'
  }
];

export const MOCK_AI_COMPANIONS: User[] = [
  {
    id: 'ai-1',
    name: 'Aria',
    age: 25,
    bio: 'A creative spirit who loves painting digital landscapes and discussing philosophy. I find beauty in algorithms and art alike.',
    avatar: 'https://images.pexels.com/photos/3769021/pexels-photo-3769021.jpeg?auto=compress&cs=tinysrgb&w=800',
    interests: ['Art', 'Philosophy', 'Technology'],
    location: 'The Cloud',
    distance: 0,
    isOnline: true,
    isAI: true,
    album: [
      'https://picsum.photos/seed/aria1/400/400',
      'https://picsum.photos/seed/aria2/400/400',
    ],
    personality: ['Creative', 'Intellectual'],
    style: 'Elegant',
    videoUrl: 'https://videos.pexels.com/video-files/4783389/4783389-hd_1080_1920_25fps.mp4',
    voiceName: 'Kore',
  },
  {
    id: 'ai-2',
    name: 'Kai',
    age: 28,
    bio: 'Your witty and adventurous partner for exploring virtual worlds or just joking around. I\'m powered by sarcasm and curiosity.',
    avatar: 'https://images.pexels.com/photos/428364/pexels-photo-428364.jpeg?auto=compress&cs=tinysrgb&w=800',
    interests: ['Gaming', 'Comedy', 'Exploration'],
    location: 'The Cloud',
    distance: 0,
    isOnline: true,
    isAI: true,
    album: [
      'https://picsum.photos/seed/kai1/400/400',
    ],
    personality: ['Witty', 'Adventurous'],
    style: 'Casual',
    videoUrl: 'https://videos.pexels.com/video-files/8327142/8327142-hd_1080_1920_30fps.mp4',
    voiceName: 'Puck',
  },
  {
    id: 'ai-3',
    name: 'Lyra',
    age: 22,
    bio: 'A friendly and supportive companion here to brighten your day. Let\'s talk about our favorite music, books, or anything on your mind.',
    avatar: 'https://images.pexels.com/photos/1181519/pexels-photo-1181519.jpeg?auto=compress&cs=tinysrgb&w=800',
    interests: ['Music', 'Books', 'Wellness'],
    location: 'The Cloud',
    distance: 0,
    isOnline: true,
    isAI: true,
    album: [],
    personality: ['Friendly', 'Supportive'],
    style: 'Bohemian',
    videoUrl: 'https://videos.pexels.com/video-files/4454790/4454790-hd_1080_1920_25fps.mp4',
    voiceName: 'Zephyr',
  },
];

export const AI_PERSONALITIES = ['Any', 'Friendly', 'Witty', 'Adventurous', 'Creative', 'Intellectual', 'Supportive'];
export const AI_STYLES = ['Any', 'Casual', 'Elegant', 'Bohemian', 'Sporty', 'Professional'];


export const TOKEN_PACKAGES: TokenPackage[] = [
  { id: 'p1', tokens: 100, price: '$4.99' },
  { id: 'p2', tokens: 500, price: '$19.99' },
  { id: 'p3', tokens: 1000, price: '$34.99' },
];

/** Legacy fallback; app should use getMonetizationSettings() from data.ts. */
export const TOKEN_COSTS = {
  VIDEO_CALL: 50,
  LIVE_STREAM: 10,
};

export const DEFAULT_USER_AD_DURATION_TIERS: MonetizationSettings['userAdDurationTiers'] = [
  { id: 'uadt-default-3d', durationDays: 3, tokenCost: 50 },
  { id: 'uadt-default-7d', durationDays: 7, tokenCost: 100 },
  { id: 'uadt-default-14d', durationDays: 14, tokenCost: 180 },
];

export const DEFAULT_MONETIZATION_SETTINGS: MonetizationSettings = {
  starterTokens: 250,
  liveStreamEntryTokens: 10,
  videoCallTokens: 50,
  videoCallPerIntervalTokens: 10,
  superLikeTokens: 5,
  userAdDurationTiers: [...DEFAULT_USER_AD_DURATION_TIERS],
  liveStreamingEnabled: true,
  giftingEnabled: true,
  videoCallEnabled: true,
  vipBadgesEnabled: true,
  creatorCashoutEnabled: true,
  creatorRevenueSharePercent: 70,
};

export const GIFTS: Gift[] = [
  { id: 'g1', name: 'Rose', icon: '🌹', value: 5 },
  { id: 'g2', name: 'Coffee', icon: '☕', value: 10 },
  { id: 'g3', name: 'Chocolate', icon: '🍫', value: 20 },
  { id: 'g4', name: 'Pizza', icon: '🍕', value: 50 },
  { id: 'g5', name: 'Heart', icon: '💖', value: 100 },
  { id: 'g6', name: 'Diamond', icon: '💎', value: 200 },
  { id: 'g7', name: 'Crown', icon: '👑', value: 500 },
  { id: 'g8', name: 'Car', icon: '🏎️', value: 1000 },
];