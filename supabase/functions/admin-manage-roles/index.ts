import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Json = Record<string, unknown>;
type Role = 'super_admin' | 'support' | 'moderator';
type Action = 'list' | 'create' | 'update_role' | 'delete';

function json(status: number, body: Json) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function isRole(v: unknown): v is Role {
  return v === 'super_admin' || v === 'support' || v === 'moderator';
}

async function getRequesterId(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice('Bearer '.length);
  if (!token) return null;

  const client = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
  } = await client.auth.getUser();
  return user?.id ?? null;
}

async function requesterRole(admin: ReturnType<typeof createClient>, userId: string): Promise<Role | null> {
  const { data } = await admin.from('admin_roles').select('role').eq('user_id', userId).maybeSingle();
  if (!data?.role || !isRole(data.role)) return null;
  return data.role;
}

async function writeAudit(
  admin: ReturnType<typeof createClient>,
  payload: {
    action: string;
    actorUserId: string;
    targetUserId?: string | null;
    reason?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const { error } = await admin.rpc('audit_log_event', {
    p_action: payload.action,
    p_actor_user_id: payload.actorUserId,
    p_actor_label: 'admin',
    p_target_user_id: payload.targetUserId ?? null,
    p_reason: payload.reason ?? payload.action,
    p_metadata: payload.metadata ?? {},
  });
  if (error) {
    console.error('admin-manage-roles audit log failed', error);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });

  try {
    const requesterId = await getRequesterId(req);
    if (!requesterId) return json(401, { ok: false, error: 'unauthorized' });

    const admin = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));
    const role = await requesterRole(admin, requesterId);
    if (!role) return json(403, { ok: false, error: 'forbidden' });

    const body = (await req.json()) as {
      action?: Action;
      user_id?: string;
      email?: string;
      password?: string;
      name?: string;
      role?: Role;
    };
    const action = body.action;
    if (!action) return json(400, { ok: false, error: 'missing_action' });

    if (action === 'list') {
      const { data, error } = await admin.from('admin_roles').select('user_id, role, created_at');
      if (error) return json(500, { ok: false, error: error.message });
      const userIds = (data ?? []).map((x) => x.user_id);
      const emailById = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: users } = await admin.auth.admin.listUsers();
        for (const u of users.users) {
          if (userIds.includes(u.id)) emailById.set(u.id, u.email ?? u.id);
        }
      }
      return json(200, {
        ok: true,
        admins: (data ?? []).map((row) => ({
          ...row,
          email: emailById.get(row.user_id) ?? row.user_id,
        })),
      });
    }

    // Mutations require super_admin.
    if (role !== 'super_admin') return json(403, { ok: false, error: 'super_admin_required' });

    if (action === 'create') {
      if (!body.email || !body.password || !isRole(body.role)) {
        return json(400, { ok: false, error: 'invalid_payload' });
      }
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: {
          name: body.name || body.email.split('@')[0],
        },
      });
      if (createErr || !created.user) return json(500, { ok: false, error: createErr?.message ?? 'create_user_failed' });
      const { error: roleErr } = await admin.from('admin_roles').upsert({
        user_id: created.user.id,
        role: body.role,
      });
      if (roleErr) return json(500, { ok: false, error: roleErr.message });
      await writeAudit(admin, {
        action: 'admin.role.created',
        actorUserId: requesterId,
        targetUserId: created.user.id,
        reason: 'create_admin_user',
        metadata: {
          role: body.role,
          email: body.email,
        },
      });
      return json(200, { ok: true, user_id: created.user.id });
    }

    if (action === 'update_role') {
      if (!body.user_id || !isRole(body.role)) return json(400, { ok: false, error: 'invalid_payload' });
      const { error } = await admin.from('admin_roles').upsert({
        user_id: body.user_id,
        role: body.role,
      });
      if (error) return json(500, { ok: false, error: error.message });
      await writeAudit(admin, {
        action: 'admin.role.updated',
        actorUserId: requesterId,
        targetUserId: body.user_id,
        reason: 'update_admin_role',
        metadata: {
          role: body.role,
        },
      });
      return json(200, { ok: true });
    }

    if (action === 'delete') {
      if (!body.user_id) return json(400, { ok: false, error: 'invalid_payload' });
      if (body.user_id === requesterId) return json(400, { ok: false, error: 'cannot_delete_self' });
      const { error: roleErr } = await admin.from('admin_roles').delete().eq('user_id', body.user_id);
      if (roleErr) return json(500, { ok: false, error: roleErr.message });
      const { error: userErr } = await admin.auth.admin.deleteUser(body.user_id);
      if (userErr) return json(500, { ok: false, error: userErr.message });
      await writeAudit(admin, {
        action: 'admin.role.deleted',
        actorUserId: requesterId,
        targetUserId: body.user_id,
        reason: 'delete_admin_user',
      });
      return json(200, { ok: true });
    }

    return json(400, { ok: false, error: 'unsupported_action' });
  } catch (err) {
    console.error('admin-manage-roles fatal', err);
    return json(500, { ok: false, error: 'internal_error' });
  }
});
