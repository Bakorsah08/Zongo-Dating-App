import type { Session } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import type { AdminUser, Role } from '../auth/types';
import { trackFailure } from './monitoring';

type AdminRoleRow = {
  user_id: string;
  role: Role;
  created_at: string;
};

export type AdminAuditLog = {
  id: number;
  action: string;
  actorUserId: string | null;
  actorLabel: string;
  targetUserId: string | null;
  amount: number | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: number;
};

export type AdminAuditLogQuery = {
  actionPrefix?: string;
  actorUserId?: string;
  targetUserId?: string;
  fromIso?: string;
  toIso?: string;
  limit?: number;
  offset?: number;
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
  if (error) {
    trackFailure('auth', 'admin_sign_in', error, { emailDomain: email.split('@')[1] || 'unknown' });
    return { success: false, error: error.message };
  }
  const role = await fetchMyAdminRole();
  if (!role) {
    trackFailure('auth', 'admin_role_check_after_sign_in', 'missing_role');
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
  if (error) {
    trackFailure('rpc', 'fetch_my_admin_role', error);
    return null;
  }
  if (!data?.role) return null;
  return data.role as Role;
}

export async function listAdmins(): Promise<AdminUser[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase().functions.invoke('admin-manage-roles', {
    body: { action: 'list' },
  });
  if (error) {
    trackFailure('rpc', 'admin_manage_roles_list', error);
    throw new Error(error.message);
  }
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
  if (error) {
    trackFailure('rpc', 'admin_manage_roles_create', error);
    return { ok: false, error: error.message };
  }
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
  if (error) {
    trackFailure('rpc', 'admin_manage_roles_update_role', error);
    return { ok: false, error: error.message };
  }
  if (data?.ok !== true) return { ok: false, error: String(data?.error ?? 'update_failed') };
  return { ok: true };
}

export async function deleteAdmin(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Supabase not configured' };
  const { data, error } = await getSupabase().functions.invoke('admin-manage-roles', {
    body: { action: 'delete', user_id: userId },
  });
  if (error) {
    trackFailure('rpc', 'admin_manage_roles_delete', error);
    return { ok: false, error: error.message };
  }
  if (data?.ok !== true) return { ok: false, error: String(data?.error ?? 'delete_failed') };
  return { ok: true };
}

export async function fetchAuditLogs(
  query: AdminAuditLogQuery = {}
): Promise<{ rows: AdminAuditLog[]; totalCount: number }> {
  if (!isSupabaseConfigured()) return { rows: [], totalCount: 0 };

  const { data, error } = await getSupabase().rpc('admin_list_audit_logs', {
    p_action_prefix: query.actionPrefix?.trim() || null,
    p_actor_user_id: query.actorUserId?.trim() || null,
    p_target_user_id: query.targetUserId?.trim() || null,
    p_from: query.fromIso || null,
    p_to: query.toIso || null,
    p_limit: Math.max(1, Math.min(500, Math.round(query.limit ?? 100))),
    p_offset: Math.max(0, Math.round(query.offset ?? 0)),
  });
  if (error) {
    trackFailure('rpc', 'admin_list_audit_logs', error);
    throw new Error(error.message);
  }

  const rows = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    action: String(row.action ?? ''),
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    actorLabel: String(row.actor_label ?? 'system'),
    targetUserId: row.target_user_id ? String(row.target_user_id) : null,
    amount: row.amount == null ? null : Number(row.amount),
    reason: row.reason == null ? null : String(row.reason),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(String(row.created_at)).getTime(),
  }));

  const totalCount = rows.length > 0 ? Number((data as Array<{ total_count: number }>)[0].total_count ?? 0) : 0;
  return { rows, totalCount };
}
