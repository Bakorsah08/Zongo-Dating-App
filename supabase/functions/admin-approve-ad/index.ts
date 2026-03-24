import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Json = Record<string, unknown>;
type AdAction = 'approve' | 'reject' | 'list_pending';

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
    const { data: roleRow } = await admin
      .from('admin_roles')
      .select('role')
      .eq('user_id', requesterId)
      .maybeSingle();

    if (!roleRow) return json(403, { ok: false, error: 'forbidden' });

    const body = (await req.json()) as { submission_id?: string; action?: AdAction; reason?: string };
    const submissionId = body.submission_id;
    const action = body.action;
    const reason = String(body.reason ?? '').slice(0, 2000);
    if (!action || !['approve', 'reject', 'list_pending'].includes(action)) {
      return json(400, { ok: false, error: 'invalid_payload' });
    }

    if (action === 'list_pending') {
      const { data, error } = await admin
        .from('user_ad_submissions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('list pending submissions failed', error);
        return json(500, { ok: false, error: 'list_pending_failed' });
      }
      return json(200, { ok: true, pending: data ?? [] });
    }

    if (!submissionId) {
      return json(400, { ok: false, error: 'invalid_payload' });
    }

    const { data: submission, error: submissionErr } = await admin
      .from('user_ad_submissions')
      .select('*')
      .eq('id', submissionId)
      .single();
    if (submissionErr || !submission) {
      console.error('ad submission lookup error', submissionErr);
      return json(404, { ok: false, error: 'submission_not_found' });
    }

    if (action === 'reject') {
      const { data: refundData, error: refundErr } = await admin.rpc('wallet_apply_delta', {
        p_user_id: submission.user_id,
        p_delta: Number(submission.tokens_paid ?? 0),
        p_kind: 'purchase_credit',
        p_reference_id: `ad_reject:${submission.id}`,
        p_meta: {
          source: 'admin-approve-ad',
          reason,
        },
      });
      if (refundErr || refundData?.ok !== true) {
        console.error('reject refund failed', refundErr ?? refundData);
        return json(500, { ok: false, error: 'reject_refund_failed' });
      }
      const { error } = await admin
        .from('user_ad_submissions')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', submissionId);

      if (error) {
        console.error('reject ad failed', error);
        return json(500, { ok: false, error: 'reject_failed' });
      }
      return json(200, { ok: true, action, submission_id: submissionId, reason });
    }

    const nowIso = new Date().toISOString();
    const durationDays = Number(submission.duration_days ?? 0);
    const endsAt = new Date(Date.now() + Math.max(1, durationDays) * 24 * 60 * 60 * 1000).toISOString();

    const { data: adRow, error: adErr } = await admin
      .from('explore_carousel_ads')
      .insert({
        enabled: true,
        badge_label: submission.badge_label ?? 'Promo',
        title: submission.title ?? '',
        subtitle: submission.subtitle ?? '',
        image_url: submission.image_url ?? '',
        image_data_url: submission.image_data_url ?? '',
        background_color: submission.background_color ?? '',
        link_url: submission.link_url ?? '',
        display_duration_sec: submission.display_duration_sec ?? 8,
        source: 'user',
        user_submission_id: submission.id,
        submitted_by_user_id: submission.user_id,
        campaign_duration_days: durationDays,
        campaign_started_at: nowIso,
        campaign_ends_at: endsAt,
      })
      .select('id')
      .single();

    if (adErr || !adRow?.id) {
      console.error('create carousel ad failed', adErr);
      return json(500, { ok: false, error: 'create_ad_failed' });
    }

    const { error: reviewErr } = await admin
      .from('user_ad_submissions')
      .update({
        status: 'approved',
        reviewed_at: nowIso,
        carousel_ad_id: adRow.id,
      })
      .eq('id', submission.id);

    if (reviewErr) {
      console.error('approve submission failed', reviewErr);
      return json(500, { ok: false, error: 'approve_failed' });
    }

    return json(200, {
      ok: true,
      action,
      submission_id: submission.id,
      carousel_ad_id: adRow.id,
      reason,
    });
  } catch (err) {
    console.error('admin-approve-ad fatal', err);
    return json(500, { ok: false, error: 'internal_error' });
  }
});
