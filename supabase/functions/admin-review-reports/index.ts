import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { deleteMemberAccount } from '../_shared/accountDeletion.ts';

type Json = Record<string, unknown>;
type Role = 'super_admin' | 'support' | 'moderator';
type Action = 'list' | 'resolve' | 'delete_reported_user';

const LIST_LIMIT = 200;
const ROLES_ALLOWED = new Set<Role>(['super_admin', 'support', 'moderator']);
const ROLES_CAN_DELETE = new Set<Role>(['super_admin', 'support']);

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
  const client = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
  } = await client.auth.getUser();
  return user?.id ?? null;
}

type ReportRow = {
  id: string;
  reporter_id: string | null;
  reported_id: string;
  reason: string;
  details: string;
  context: string;
  status: string;
  resolution_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });

  try {
    const requesterId = await getRequesterId(req);
    if (!requesterId) return json(401, { ok: false, error: 'unauthorized' });

    const admin = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));
    const { data: roleRow } = await admin.from('admin_roles').select('role').eq('user_id', requesterId).maybeSingle();
    const role = roleRow?.role as Role | undefined;
    if (!role || !ROLES_ALLOWED.has(role)) return json(403, { ok: false, error: 'forbidden' });

    const body = (await req.json().catch(() => ({}))) as {
      action?: Action;
      status?: string;
      report_id?: string;
      resolution?: 'actioned' | 'dismissed';
      note?: string;
    };

    if (body.action === 'list') {
      const status = body.status === 'actioned' || body.status === 'dismissed' ? body.status : 'open';
      const { data, error } = await admin
        .from('user_reports')
        .select('id, reporter_id, reported_id, reason, details, context, status, resolution_note, reviewed_at, created_at')
        .eq('status', status)
        .order('created_at', { ascending: status !== 'open' ? false : true })
        .limit(LIST_LIMIT);
      if (error) {
        console.error('list reports failed', error);
        return json(500, { ok: false, error: 'list_failed' });
      }
      const rows = (data ?? []) as ReportRow[];

      const ids = [...new Set(rows.flatMap((r) => [r.reporter_id, r.reported_id]).filter((x): x is string => !!x))];
      const profiles: Record<string, { display_name: string; avatar_url: string }> = {};
      if (ids.length > 0) {
        const { data: profs } = await admin.from('profiles').select('id, display_name, avatar_url').in('id', ids);
        for (const p of profs ?? []) profiles[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
      }

      // How many open reports each target has, so moderators can spot repeat offenders.
      const reportedIds = [...new Set(rows.map((r) => r.reported_id))];
      const openCounts: Record<string, number> = {};
      if (reportedIds.length > 0) {
        const { data: open } = await admin
          .from('user_reports')
          .select('reported_id')
          .eq('status', 'open')
          .in('reported_id', reportedIds);
        for (const o of open ?? []) openCounts[o.reported_id] = (openCounts[o.reported_id] ?? 0) + 1;
      }

      return json(200, {
        ok: true,
        can_delete_users: ROLES_CAN_DELETE.has(role),
        reports: rows.map((r) => ({
          ...r,
          reporter: r.reporter_id ? profiles[r.reporter_id] ?? null : null,
          reported: profiles[r.reported_id] ?? null,
          reported_open_count: openCounts[r.reported_id] ?? 0,
        })),
      });
    }

    if (body.action === 'resolve') {
      const resolution = body.resolution;
      if (!body.report_id || (resolution !== 'actioned' && resolution !== 'dismissed')) {
        return json(400, { ok: false, error: 'invalid_payload' });
      }
      const note = String(body.note ?? '').trim().slice(0, 1000) || null;
      const { data, error } = await admin
        .from('user_reports')
        .update({ status: resolution, resolution_note: note, reviewed_by: requesterId, reviewed_at: new Date().toISOString() })
        .eq('id', body.report_id)
        .select('id, reported_id')
        .maybeSingle();
      if (error) return json(500, { ok: false, error: 'update_failed' });
      if (!data) return json(404, { ok: false, error: 'not_found' });

      const { error: auditErr } = await admin.rpc('audit_log_event', {
        p_action: `moderation.report.${resolution}`,
        p_actor_user_id: requesterId,
        p_actor_label: 'admin',
        p_target_user_id: data.reported_id,
        p_amount: null,
        p_reason: note ?? resolution,
        p_metadata: { report_id: data.id },
      });
      if (auditErr) console.error('audit log failed', auditErr);
      return json(200, { ok: true });
    }

    if (body.action === 'delete_reported_user') {
      if (!ROLES_CAN_DELETE.has(role)) return json(403, { ok: false, error: 'forbidden' });
      if (!body.report_id) return json(400, { ok: false, error: 'invalid_payload' });

      const { data: report } = await admin
        .from('user_reports')
        .select('id, reported_id, reason')
        .eq('id', body.report_id)
        .maybeSingle();
      if (!report) return json(404, { ok: false, error: 'not_found' });
      if (report.reported_id === requesterId) return json(400, { ok: false, error: 'cannot_delete_self' });

      const { data: targetRole } = await admin
        .from('admin_roles')
        .select('role')
        .eq('user_id', report.reported_id)
        .maybeSingle();
      if (targetRole?.role) return json(400, { ok: false, error: 'target_is_admin' });

      const note = String(body.note ?? '').trim().slice(0, 1000);
      // Audit first: the reports and profile cascade away with the user.
      const { error: auditErr } = await admin.rpc('audit_log_event', {
        p_action: 'moderation.account_deleted',
        p_actor_user_id: requesterId,
        p_actor_label: 'admin',
        p_target_user_id: report.reported_id,
        p_amount: null,
        p_reason: note || `report:${report.reason}`,
        p_metadata: { report_id: report.id, deleted_user_id: report.reported_id },
      });
      if (auditErr) console.error('audit log failed', auditErr);

      const result = await deleteMemberAccount(admin, report.reported_id);
      if (!result.ok) return json(500, { ok: false, error: result.error });
      return json(200, { ok: true });
    }

    return json(400, { ok: false, error: 'unsupported_action' });
  } catch (err) {
    console.error('admin-review-reports fatal', err);
    return json(500, { ok: false, error: 'internal_error' });
  }
});
