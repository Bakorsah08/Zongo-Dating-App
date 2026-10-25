import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Json = Record<string, unknown>;

const MAX_MESSAGE_LEN = 2000;
const MAX_RECIPIENTS = 2500;
const LIST_PROFILES_LIMIT = 5000;
const INSERT_CHUNK = 80;

const ROLES_ALLOWED = new Set(['super_admin', 'support']);

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

async function getRequesterId(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice('Bearer '.length);
  if (!token) return null;

  const supabase = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s.trim()
  );
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });

  try {
    const requesterId = await getRequesterId(req);
    if (!requesterId) return json(401, { ok: false, error: 'unauthorized' });

    const admin = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));
    const { data: roleRow } = await admin
      .from('admin_roles')
      .select('role')
      .eq('user_id', requesterId)
      .maybeSingle();

    if (!roleRow?.role || !ROLES_ALLOWED.has(String(roleRow.role))) {
      return json(403, { ok: false, error: 'forbidden' });
    }

    const body = (await req.json()) as {
      action?: string;
      message?: string;
      recipient_ids?: string[];
    };
    const action = body.action === 'list_profiles' ? 'list_profiles' : 'send';

    if (action === 'list_profiles') {
      const { data, error } = await admin
        .from('profiles')
        .select('id, display_name, gender, badge_tier, is_online, avatar_url, location')
        .eq('is_ai', false)
        .order('created_at', { ascending: false })
        .limit(LIST_PROFILES_LIMIT);

      if (error) {
        console.error('list_profiles failed', error);
        return json(500, { ok: false, error: 'list_failed' });
      }
      return json(200, { ok: true, profiles: data ?? [] });
    }

    const message = String(body.message ?? '').trim().slice(0, MAX_MESSAGE_LEN);
    if (!message) return json(400, { ok: false, error: 'empty_message' });

    const rawIds = Array.isArray(body.recipient_ids) ? body.recipient_ids : [];
    const unique = [...new Set(rawIds.map((id) => String(id).trim()).filter(isUuid))];
    if (unique.length === 0) return json(400, { ok: false, error: 'no_valid_recipients' });
    if (unique.length > MAX_RECIPIENTS) {
      return json(400, { ok: false, error: 'too_many_recipients', max: MAX_RECIPIENTS });
    }

    let inserted = 0;
    for (let i = 0; i < unique.length; i += INSERT_CHUNK) {
      const slice = unique.slice(i, i + INSERT_CHUNK);
      const { data: existing, error: exErr } = await admin.from('profiles').select('id').in('id', slice);
      if (exErr) {
        console.error('profile lookup failed', exErr);
        return json(500, { ok: false, error: 'recipient_lookup_failed' });
      }
      const allowed = new Set((existing ?? []).map((r: { id: string }) => r.id));
      const toInsert = slice.filter((id) => allowed.has(id));
      if (toInsert.length === 0) continue;

      const rows = toInsert.map((recipient_id) => ({
        recipient_id,
        type: 'system' as const,
        read: false,
        system_kind: 'admin_broadcast',
        system_message: message,
      }));

      const { error: insErr } = await admin.from('app_notifications').insert(rows);
      if (insErr) {
        console.error('insert notifications failed', insErr);
        return json(500, { ok: false, error: 'insert_failed' });
      }
      inserted += toInsert.length;
    }

    const { error: auditErr } = await admin.rpc('audit_log_event', {
      p_action: 'notifications.admin_broadcast',
      p_actor_user_id: requesterId,
      p_actor_label: 'admin',
      p_target_user_id: null,
      p_amount: null,
      p_reason: message.slice(0, 2000),
      p_metadata: { recipient_count: inserted },
    });
    if (auditErr) console.error('audit log failed', auditErr);

    return json(200, { ok: true, sent: inserted });
  } catch (err) {
    console.error('admin-broadcast-notification fatal', err);
    return json(500, { ok: false, error: 'internal_error' });
  }
});
