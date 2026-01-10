
import { MOCK_USERS, MOCK_AI_COMPANIONS } from '../constants';
import { User } from '../types';

// In-memory database simulation
const db = {
  users: [...MOCK_USERS, {
    id: 'me',
    name: 'James',
    age: 26,
    bio: 'Lover of tech and design. Looking for someone to explore the world with.',
    avatar: 'https://picsum.photos/seed/me/200',
    interests: ['Coding', 'Design', 'Travel'],
    location: 'New York',
    distance: 0,
    isOnline: true,
    album: [
      'https://picsum.photos/seed/me1/400/400',
      'https://picsum.photos/seed/me2/400/400'
    ],
    earnings: 345
  }],
  aiCompanions: [...MOCK_AI_COMPANIONS],
  matches: ['1', '2'] // IDs of users matched with 'me'
};

const FAKE_LATENCY = 300; // ms

const findUser = (userId: string) => db.users.find(u => u.id === userId) || db.aiCompanions.find(u => u.id === userId);

// --- API Functions ---

export const getCurrentUser = async (): Promise<User> => {
  return new Promise(resolve => {
    setTimeout(() => {
      const user = findUser('me');
      if (!user) throw new Error("Current user not found!");
      resolve(JSON.parse(JSON.stringify(user))); // Deep copy
    }, FAKE_LATENCY);
  });
};

export const getDiscoverUsers = async (): Promise<User[]> => {
  return new Promise(resolve => {
    setTimeout(() => {
      // Exclude the current user from the discover feed
      const users = db.users.filter(u => u.id !== 'me');
      resolve(JSON.parse(JSON.stringify(users)));
    }, FAKE_LATENCY);
  });
};

export const getAICompanions = async (): Promise<User[]> => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(JSON.parse(JSON.stringify(db.aiCompanions)));
    }, FAKE_LATENCY);
  });
};

export const getMatches = async (): Promise<User[]> => {
  return new Promise(resolve => {
    setTimeout(() => {
      const matchedUsers = db.matches.map(id => findUser(id)).filter(Boolean) as User[];
      resolve(JSON.parse(JSON.stringify(matchedUsers)));
    }, FAKE_LATENCY);
  });
};

export const addMatch = async (userId: string): Promise<User> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!db.matches.includes(userId)) {
          db.matches.push(userId);
        }
        const newMatch = findUser(userId);
        if (newMatch) {
            resolve(JSON.parse(JSON.stringify(newMatch)));
        } else {
            reject(new Error('User to match not found'));
        }
      }, FAKE_LATENCY);
    });
};

export const updateUserAlbum = async (userId: string, newAlbum: string[]): Promise<User> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const user = findUser(userId);
            if (user) {
                user.album = newAlbum;
                resolve(JSON.parse(JSON.stringify(user)));
            } else {
                reject(new Error("User not found"));
            }
        }, FAKE_LATENCY);
    });
};

export const updateUserAvatar = async (userId: string, newAvatarUrl: string): Promise<User> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const user = findUser(userId);
            if (user) {
                user.avatar = newAvatarUrl;
                resolve(JSON.parse(JSON.stringify(user)));
            } else {
                reject(new Error("User not found"));
            }
        }, FAKE_LATENCY);
    });
};

export const updateUserEarnings = async (userId: string, amountToAdd: number): Promise<User> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const user = findUser(userId);
            if (user) {
                user.earnings = (user.earnings || 0) + amountToAdd;
                resolve(JSON.parse(JSON.stringify(user)));
            } else {
                reject(new Error("User not found"));
            }
        }, FAKE_LATENCY);
    });
};

export const performCashOut = async (userId: string, amountToSubtract: number): Promise<User> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const user = findUser(userId);
            if (user) {
                user.earnings = (user.earnings || 0) - amountToSubtract;
                resolve(JSON.parse(JSON.stringify(user)));
            } else {
                reject(new Error("User not found"));
            }
        }, FAKE_LATENCY);
    });
};