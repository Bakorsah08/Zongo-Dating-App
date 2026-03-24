import { useState, useEffect, useCallback } from 'react';
import type { AuthSession, Permission } from './types';
import { ROLE_PERMISSIONS } from './types';
import {
  fetchMyAdminRole,
  getAdminSession,
  onAdminAuthStateChange,
  signInAdmin,
  signOutAdmin,
} from '../services/supabaseAdmin';

export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    let mounted = true;
    const sync = async () => {
      const sbSession = await getAdminSession();
      if (!mounted || !sbSession?.user?.id || !sbSession.user.email) {
        if (mounted) setSession(null);
        return;
      }
      const role = await fetchMyAdminRole();
      if (!mounted || !role) {
        if (mounted) setSession(null);
        return;
      }
      setSession({
        user: {
          id: sbSession.user.id,
          email: sbSession.user.email,
          role,
          name: sbSession.user.user_metadata?.name || sbSession.user.email.split('@')[0] || 'Admin',
          createdAt: Date.now(),
        },
        token: sbSession.access_token,
        expiresAt: sbSession.expires_at ? sbSession.expires_at * 1000 : Date.now() + 60 * 60 * 1000,
      });
    };
    void sync();
    const unsub = onAdminAuthStateChange(() => {
      void sync();
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await signInAdmin(email, password);
    if (result.success) {
      const sbSession = await getAdminSession();
      const role = await fetchMyAdminRole();
      if (!sbSession?.user?.id || !sbSession.user.email || !role) {
        setSession(null);
        return { success: false, error: 'Admin role not found' };
      }
      setSession({
        user: {
          id: sbSession.user.id,
          email: sbSession.user.email,
          role,
          name: sbSession.user.user_metadata?.name || sbSession.user.email.split('@')[0] || 'Admin',
          createdAt: Date.now(),
        },
        token: sbSession.access_token,
        expiresAt: sbSession.expires_at ? sbSession.expires_at * 1000 : Date.now() + 60 * 60 * 1000,
      });
    }
    return result;
  }, []);

  const logout = useCallback(() => {
    void signOutAdmin();
    setSession(null);
  }, []);

  const hasPermission = useCallback((permission: Permission) => {
    if (!session) return false;
    const permissions = ROLE_PERMISSIONS[session.user.role];
    return permissions?.includes(permission) ?? false;
  }, [session]);

  return { session, isAuthenticated: !!session, login, logout, hasPermission };
}
