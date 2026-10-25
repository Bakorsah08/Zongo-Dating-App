import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { deleteMemberAccount } from '../_shared/accountDeletion.ts';

type Json = Record<string, unknown>;

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

/** Self-service account deletion (App Store guideline 5.1.1(v) / Google Play account deletion policy). */
Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });

  try {
    const userId = await getRequesterId(req);
    if (!userId) return json(401, { ok: false, error: 'unauthorized' });

    const body = (await req.json().catch(() => ({}))) as { confirm?: string };
    if (body.confirm !== 'DELETE') return json(400, { ok: false, error: 'confirmation_required' });

    const admin = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));

    // Admin accounts are removed by a super admin, so staff can't lock everyone out by accident.
    const { data: roleRow } = await admin.from('admin_roles').select('role').eq('user_id', userId).maybeSingle();
    if (roleRow?.role) return json(403, { ok: false, error: 'admin_account' });

    // Log before deleting: the audit row keeps the id in metadata after the user row is gone.
    const { error: auditErr } = await admin.rpc('audit_log_event', {
      p_action: 'account.self_deleted',
      p_actor_user_id: userId,
      p_actor_label: 'member',
      p_target_user_id: userId,
      p_amount: null,
      p_reason: 'user_requested_deletion',
      p_metadata: { user_id: userId },
    });
    if (auditErr) console.error('delete-account audit log failed', auditErr);

    const result = await deleteMemberAccount(admin, userId);
    if (!result.ok) return json(500, { ok: false, error: result.error });

    return json(200, { ok: true });
  } catch (err) {
    console.error('delete-account fatal', err);
    return json(500, { ok: false, error: 'internal_error' });
  }
});
