
import { User, TokenPackage, Gift } from './types';

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
    earnings: 1250
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
    ]
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
    earnings: 840
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
    ]
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
    ]
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
    earnings: 2100
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
    album: []
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
    album: []
  }
];

export const TOKEN_PACKAGES: TokenPackage[] = [
  { id: 'p1', tokens: 100, price: '$4.99' },
  { id: 'p2', tokens: 500, price: '$19.99' },
  { id: 'p3', tokens: 1000, price: '$34.99' },
];

export const TOKEN_COSTS = {
  VIDEO_CALL_PER_INTERVAL: 5,
  LIVE_STREAM: 10
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