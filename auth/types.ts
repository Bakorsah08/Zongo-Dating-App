export type Role = 'super_admin' | 'support' | 'moderator';

export type Permission =
  | 'manage_users'
  | 'manage_badges'
  | 'manage_tokens'
  | 'manage_gifts'
  | 'manage_monetization'
  | 'reset_data'
  | 'manage_admins'
  | 'manage_explore_ads'
  | 'send_app_notifications'
  | 'review_reports'
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
    'manage_explore_ads',
    'send_app_notifications',
    'review_reports',
  ],
  support: [
    'view_dashboard',
    'manage_users',
    'manage_badges',
    'manage_tokens',
    'manage_gifts',
    'manage_monetization',
    'send_app_notifications',
    'review_reports',
  ],
  moderator: ['view_dashboard', 'manage_users', 'review_reports'],
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
