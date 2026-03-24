import type { Session } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import type { AdminUser, Role } from '../auth/types';

type AdminRoleRow = {
  user_id: string;
  role: Role;
  created_at: string;
};

function toAdminUser(row: AdminRoleRow, email?: string | null): AdminUser {
  return {
    id: row.user_id,
    email: email ?? row.user_id,
    role: row.role,
    name: email?.split('@')[0] || 'Admin',
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function signInAdmin(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: false, error: 'Supabase not configured' };
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) return { success: false, error: error.message };
  const role = await fetchMyAdminRole();
  if (!role) {
    await getSupabase().auth.signOut();
    return { success: false, error: 'This account is not allowed to access admin.' };
  }
  return { success: true };
}

export async function signOutAdmin(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await getSupabase().auth.signOut();
}

export async function getAdminSession(): Promise<Session | null> {
  if (!isSupabaseConfigured()) return null;
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  return session;
}

export function onAdminAuthStateChange(cb: (session: Session | null) => void): () => void {
  if (!isSupabaseConfigured()) return () => {};
  const {
    data: { subscription },
  } = getSupabase().auth.onAuthStateChange((_event, session) => cb(session));
  return () => subscription.unsubscribe();
}

export async function fetchMyAdminRole(): Promise<Role | null> {
  if (!isSupabaseConfigured()) return null;
  const {
    data: { user },
  } = await getSupabase().auth.getUser();
  if (!user) return null;
  const { data, error } = await getSupabase()
    .from('admin_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error || !data?.role) return null;
  return data.role as Role;
}

export async function listAdmins(): Promise<AdminUser[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase().functions.invoke('admin-manage-roles', {
    body: { action: 'list' },
  });
  if (error) throw new Error(error.message);
  const rows = (data?.admins ?? []) as Array<AdminRoleRow & { email?: string | null }>;
  return rows.map((row) => toAdminUser(row, row.email));
}

export async function createAdmin(input: {
  email: string;
  password: string;
  role: Role;
  name?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Supabase not configured' };
  const { data, error } = await getSupabase().functions.invoke('admin-manage-roles', {
    body: {
      action: 'create',
      email: input.email.trim().toLowerCase(),
      password: input.password,
      role: input.role,
      name: input.name?.trim() || undefined,
    },
  });
  if (error) return { ok: false, error: error.message };
  if (data?.ok !== true) return { ok: false, error: String(data?.error ?? 'create_failed') };
  return { ok: true };
}

export async function updateAdminRole(
  userId: string,
  role: Role
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Supabase not configured' };
  const { data, error } = await getSupabase().functions.invoke('admin-manage-roles', {
    body: { action: 'update_role', user_id: userId, role },
  });
  if (error) return { ok: false, error: error.message };
  if (data?.ok !== true) return { ok: false, error: String(data?.error ?? 'update_failed') };
  return { ok: true };
}

export async function deleteAdmin(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Supabase not configured' };
  const { data, error } = await getSupabase().functions.invoke('admin-manage-roles', {
    body: { action: 'delete', user_id: userId },
  });
  if (error) return { ok: false, error: error.message };
  if (data?.ok !== true) return { ok: false, error: String(data?.error ?? 'delete_failed') };
  return { ok: true };
}
