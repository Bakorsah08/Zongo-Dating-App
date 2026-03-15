import { useState, useEffect, useCallback } from 'react';
import type { AuthSession, Permission } from './types';
import { authStore } from './store';

export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(authStore.getSession());

  useEffect(() => {
    const check = () => setSession(authStore.getSession());
    check();
    const interval = setInterval(check, 60_000); // Re-check every minute (for expiry)
    return () => clearInterval(interval);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authStore.login(email, password);
    if (result.success) setSession(authStore.getSession());
    return result;
  }, []);

  const logout = useCallback(() => {
    authStore.logout();
    setSession(null);
  }, []);

  const hasPermission = useCallback((permission: Permission) => {
    return authStore.hasPermission(permission);
  }, []);

  return { session, isAuthenticated: !!session, login, logout, hasPermission };
}
