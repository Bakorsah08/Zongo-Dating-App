export type Role = 'super_admin' | 'admin' | 'moderator';

export type Permission =
  | 'manage_users'
  | 'manage_badges'
  | 'manage_tokens'
  | 'manage_gifts'
  | 'manage_monetization'
  | 'reset_data'
  | 'manage_admins'
  | 'view_dashboard';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [
    'view_dashboard',
    'manage_users',
    'manage_badges',
    'manage_tokens',
    'manage_gifts',
    'manage_monetization',
    'reset_data',
    'manage_admins',
  ],
  admin: [
    'view_dashboard',
    'manage_users',
    'manage_badges',
    'manage_tokens',
    'manage_gifts',
    'manage_monetization',
  ],
  moderator: ['view_dashboard', 'manage_users'],
};

export interface AdminUser {
  id: string;
  email: string;
  role: Role;
  name: string;
  createdAt: number;
}

export interface AuthSession {
  user: AdminUser;
  token: string;
  expiresAt: number;
}
