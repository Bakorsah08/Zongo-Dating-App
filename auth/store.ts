import type { AdminUser, AuthSession, Role } from './types';
import { ROLE_PERMISSIONS, type Permission } from './types';

const AUTH_STORAGE_KEY = 'zongo_admin_auth';
const ADMINS_STORAGE_KEY = 'zongo_admin_users';

// SHA-256 hash helper (browser built-in)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function loadAdmins(): AdminUser[] {
  try {
    const raw = localStorage.getItem(ADMINS_STORAGE_KEY);
    if (!raw) return getDefaultAdmins();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return getDefaultAdmins();
    return parsed;
  } catch {
    return getDefaultAdmins();
  }
}

function saveAdmins(admins: AdminUser[]) {
  localStorage.setItem(ADMINS_STORAGE_KEY, JSON.stringify(admins));
}

// Default super admin - change password after first login in production
// SHA-256 hash of "admin123" - for demo only; use strong password in production
const DEFAULT_SUPER_ADMIN_HASH = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';
// Legacy wrong hash (fixes users who had the bug)
const LEGACY_WRONG_HASH = '240be518fabd2724ddb6f04eeb1b3be44e643e930e1d30226f5061f82f4f2a4f';

function getDefaultAdmins(): AdminUser[] {
  const admins: AdminUser[] = [
    {
      id: 'super-admin-1',
      email: 'admin@zongo.com',
      role: 'super_admin',
      name: 'Super Admin',
      createdAt: Date.now(),
    },
  ];
  saveAdmins(admins);
  return admins;
}

// Store: email -> password hash (for demo; in production use backend)
const PASSWORD_HASHES_KEY = 'zongo_admin_passwords';

function loadPasswordHashes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(PASSWORD_HASHES_KEY);
    if (!raw) {
      const defaults: Record<string, string> = {
        'admin@zongo.com': DEFAULT_SUPER_ADMIN_HASH,
      };
      localStorage.setItem(PASSWORD_HASHES_KEY, JSON.stringify(defaults));
      return defaults;
    }
    return JSON.parse(raw);
  } catch {
    return { 'admin@zongo.com': DEFAULT_SUPER_ADMIN_HASH };
  }
}

function savePasswordHashes(hashes: Record<string, string>) {
  localStorage.setItem(PASSWORD_HASHES_KEY, JSON.stringify(hashes));
}

export const authStore = {
  async login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    const admins = loadAdmins();
    const user = admins.find((a) => a.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return { success: false, error: 'Invalid email or password' };
    }

    const hashes = loadPasswordHashes();
    const storedHash = hashes[user.email];
    const inputHash = await hashPassword(password);

    const isValid = !storedHash || storedHash === inputHash || storedHash === LEGACY_WRONG_HASH && inputHash === DEFAULT_SUPER_ADMIN_HASH;
    if (!isValid) {
      return { success: false, error: 'Invalid email or password' };
    }

    // First-time setup or migration: if no hash or wrong legacy hash, save correct one
    if (!storedHash || storedHash === LEGACY_WRONG_HASH) {
      hashes[user.email] = inputHash;
      savePasswordHashes(hashes);
    }

    const session: AuthSession = {
      user,
      token: crypto.randomUUID(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    return { success: true };
  },

  logout() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  },

  getSession(): AuthSession | null {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw) as AuthSession;
      if (session.expiresAt < Date.now()) {
        this.logout();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  },

  isAuthenticated(): boolean {
    return this.getSession() !== null;
  },

  hasPermission(permission: Permission): boolean {
    const session = this.getSession();
    if (!session) return false;
    const permissions = ROLE_PERMISSIONS[session.user.role];
    return permissions?.includes(permission) ?? false;
  },

  hasRole(role: Role): boolean {
    const session = this.getSession();
    return session?.user.role === role;
  },

  getAdmins(): AdminUser[] {
    return loadAdmins();
  },

  addAdmin(admin: Omit<AdminUser, 'id' | 'createdAt'>): AdminUser {
    const admins = loadAdmins();
    const newAdmin: AdminUser = {
      ...admin,
      id: `admin-${Date.now()}`,
      createdAt: Date.now(),
    };
    admins.push(newAdmin);
    saveAdmins(admins);
    return newAdmin;
  },

  updateAdmin(id: string, updates: Partial<AdminUser>) {
    const admins = loadAdmins();
    const idx = admins.findIndex((a) => a.id === id);
    if (idx >= 0) {
      admins[idx] = { ...admins[idx], ...updates };
      saveAdmins(admins);
    }
  },

  deleteAdmin(id: string) {
    const admins = loadAdmins().filter((a) => a.id !== id);
    saveAdmins(admins);
  },

  async setPassword(email: string, newPassword: string) {
    const hashes = loadPasswordHashes();
    hashes[email] = await hashPassword(newPassword);
    savePasswordHashes(hashes);
  },
};
