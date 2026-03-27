import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Json = Record<string, unknown>;
type ReviewAction = 'approve' | 'reject' | 'paid';

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

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });

  try {
    const requesterId = await getRequesterId(req);
    if (!requesterId) return json(401, { ok: false, error: 'unauthorized' });

    const admin = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));
    const { data: roleRow, error: roleErr } = await admin
      .from('admin_roles')
      .select('role')
      .eq('user_id', requesterId)
      .maybeSingle();

    if (roleErr) {
      console.error('admin role lookup error', roleErr);
      return json(500, { ok: false, error: 'role_lookup_failed' });
    }
    if (!roleRow) return json(403, { ok: false, error: 'forbidden' });

    const body = (await req.json()) as { request_id?: string; action?: ReviewAction; notes?: string };
    const requestId = body.request_id;
    const action = body.action;
    const notes = (body.notes ?? '').toString().slice(0, 2000);
    if (!requestId || !action || !['approve', 'reject', 'paid'].includes(action)) {
      return json(400, { ok: false, error: 'invalid_payload' });
    }

    const nextStatus =
      action === 'approve' ? 'approved' : action === 'paid' ? 'paid' : 'rejected';
    const patch: Record<string, unknown> = {
      status: nextStatus,
      reviewed_by: requesterId,
      reviewed_at: new Date().toISOString(),
      notes,
    };

    const { data, error } = await admin
      .from('cashout_requests')
      .update(patch)
      .eq('id', requestId)
      .select('*')
      .single();

    if (error) {
      console.error('cashout review update error', error);
      return json(500, { ok: false, error: 'cashout_update_failed' });
    }

    const { error: auditErr } = await admin.rpc('audit_log_event', {
      p_action: `payout.review.${action}`,
      p_actor_user_id: requesterId,
      p_actor_label: 'admin',
      p_target_user_id: data.user_id,
      p_amount: data.amount,
      p_reason: notes || `cashout_${action}`,
      p_metadata: {
        cashout_request_id: data.id,
        status: data.status,
      },
    });
    if (auditErr) {
      console.error('cashout review audit log failed', auditErr);
    }

    // If you decide to move transferred_out update here, do it via a secure SQL function.
    return json(200, { ok: true, reviewed: data });
  } catch (err) {
    console.error('admin-review-cashout fatal', err);
    return json(500, { ok: false, error: 'internal_error' });
  }
});
