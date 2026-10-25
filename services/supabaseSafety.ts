import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { devError } from '../lib/devLog';

// ---------------------------------------------------------------------------
// 18+ age gate
// ---------------------------------------------------------------------------

export const MINIMUM_AGE = 18;

/** Whole years between `birthdate` (YYYY-MM-DD) and today. */
export function ageFromBirthdate(birthdate: string, today = new Date()): number {
  const [y, m, d] = birthdate.split('-').map(Number);
  let age = today.getFullYear() - y;
  const beforeBirthday = today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

/** True when the user has already confirmed a birthdate (or the check can't run without Supabase). */
export async function fetchHasVerifiedAge(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;
  const { data, error } = await getSupabase()
    .from('user_age_verifications')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    devError('fetchHasVerifiedAge', error);
    return false;
  }
  return Boolean(data);
}

export type SubmitBirthdateResult = { ok: true } | { ok: false; error: 'must_be_18' | 'invalid_birthdate' | 'failed' };

export async function submitBirthdate(userId: string, birthdate: string): Promise<SubmitBirthdateResult> {
  if (!isSupabaseConfigured()) return { ok: true };
  const { error } = await getSupabase().from('user_age_verifications').insert({ user_id: userId, birthdate });
  if (!error) return { ok: true };
  // Already verified (e.g. a second tab): treat as success.
  if (error.code === '23505') return { ok: true };
  if (error.message?.includes('must_be_18')) return { ok: false, error: 'must_be_18' };
  if (error.message?.includes('invalid_birthdate')) return { ok: false, error: 'invalid_birthdate' };
  devError('submitBirthdate', error);
  return { ok: false, error: 'failed' };
}

const UNDERAGE_FLAG_KEY = 'zongo_underage_block_v1';

/** Remember on this device that an under-18 birthdate was entered, so the gate can't simply be retried. */
export function markDeviceUnderage(): void {
  try {
    localStorage.setItem(UNDERAGE_FLAG_KEY, String(Date.now()));
  } catch {
    /* private mode */
  }
}

export function isDeviceMarkedUnderage(): boolean {
  try {
    return Boolean(localStorage.getItem(UNDERAGE_FLAG_KEY));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export type ReportReason =
  | 'fake_profile'
  | 'harassment'
  | 'inappropriate_content'
  | 'scam'
  | 'underage'
  | 'hate_speech'
  | 'other';

export const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: 'fake_profile', label: 'Fake profile or impersonation' },
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'inappropriate_content', label: 'Nudity or sexual content' },
  { id: 'scam', label: 'Scam or asking for money' },
  { id: 'underage', label: 'Appears to be under 18' },
  { id: 'hate_speech', label: 'Hate speech or threats' },
  { id: 'other', label: 'Something else' },
];

export type ReportContext = 'profile' | 'chat' | 'live';

export async function submitUserReport(input: {
  reporterId: string;
  reportedId: string;
  reason: ReportReason;
  details: string;
  context: ReportContext;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: true };
  const { error } = await getSupabase().from('user_reports').insert({
    reporter_id: input.reporterId,
    reported_id: input.reportedId,
    reason: input.reason,
    details: input.details.trim().slice(0, 1000),
    context: input.context,
  });
  // An open report for this person already exists; the moderators have it.
  if (!error || error.code === '23505') return { ok: true };
  devError('submitUserReport', error);
  return { ok: false, error: 'Could not send your report. Please try again.' };
}

// ---------------------------------------------------------------------------
// Account deletion
// ---------------------------------------------------------------------------

export async function deleteMyAccount(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Supabase is not configured.' };
  const { data, error } = await getSupabase().functions.invoke('delete-account', {
    body: { confirm: 'DELETE' },
  });
  if (error) return { ok: false, error: error.message };
  const d = data as { ok?: boolean; error?: string } | null;
  if (d?.ok) return { ok: true };
  if (d?.error === 'admin_account') {
    return { ok: false, error: 'Admin accounts must be removed by a super admin in the admin dashboard.' };
  }
  return { ok: false, error: 'Could not delete your account. Please try again or contact support.' };
}

// ---------------------------------------------------------------------------
// Admin moderation queue
// ---------------------------------------------------------------------------

export type ReportStatus = 'open' | 'actioned' | 'dismissed';

export type AdminReport = {
  id: string;
  reporterId: string | null;
  reportedId: string;
  reason: ReportReason;
  details: string;
  context: ReportContext;
  status: ReportStatus;
  resolutionNote: string | null;
  createdAt: number;
  reviewedAt?: number;
  reporterName: string | null;
  reportedName: string;
  reportedAvatar: string | null;
  reportedOpenCount: number;
};

type AdminReportRow = {
  id: string;
  reporter_id: string | null;
  reported_id: string;
  reason: ReportReason;
  details: string;
  context: ReportContext;
  status: ReportStatus;
  resolution_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  reporter: { display_name: string } | null;
  reported: { display_name: string; avatar_url: string } | null;
  reported_open_count: number;
};

export async function adminListReports(
  status: ReportStatus
): Promise<{ reports: AdminReport[]; canDeleteUsers: boolean }> {
  const { data, error } = await getSupabase().functions.invoke('admin-review-reports', {
    body: { action: 'list', status },
  });
  if (error) throw new Error(error.message);
  if (data?.ok !== true) throw new Error(String(data?.error ?? 'list_failed'));
  const rows = (data.reports ?? []) as AdminReportRow[];
  return {
    canDeleteUsers: Boolean(data.can_delete_users),
    reports: rows.map((r) => ({
      id: r.id,
      reporterId: r.reporter_id,
      reportedId: r.reported_id,
      reason: r.reason,
      details: r.details,
      context: r.context,
      status: r.status,
      resolutionNote: r.resolution_note,
      createdAt: new Date(r.created_at).getTime(),
      reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).getTime() : undefined,
      reporterName: r.reporter?.display_name ?? null,
      reportedName: r.reported?.display_name ?? 'Deleted member',
      reportedAvatar: r.reported?.avatar_url || null,
      reportedOpenCount: r.reported_open_count,
    })),
  };
}

export async function adminResolveReport(
  reportId: string,
  resolution: 'actioned' | 'dismissed',
  note?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await getSupabase().functions.invoke('admin-review-reports', {
    body: { action: 'resolve', report_id: reportId, resolution, note },
  });
  if (error) return { ok: false, error: error.message };
  if (data?.ok !== true) return { ok: false, error: String(data?.error ?? 'resolve_failed') };
  return { ok: true };
}

export async function adminDeleteReportedUser(
  reportId: string,
  note?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await getSupabase().functions.invoke('admin-review-reports', {
    body: { action: 'delete_reported_user', report_id: reportId, note },
  });
  if (error) return { ok: false, error: error.message };
  if (data?.ok !== true) return { ok: false, error: String(data?.error ?? 'delete_failed') };
  return { ok: true };
}
