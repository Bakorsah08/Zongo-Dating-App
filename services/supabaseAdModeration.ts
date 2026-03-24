import type { UserAdSubmission } from '../types';
import type { UserAdSubmissionRow } from '../models/supabase';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';

function rowToSubmission(row: UserAdSubmissionRow): UserAdSubmission {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    title: row.title,
    subtitle: row.subtitle,
    badgeLabel: row.badge_label,
    imageUrl: row.image_url,
    imageDataUrl: row.image_data_url,
    backgroundColor: row.background_color,
    linkUrl: row.link_url,
    displayDurationSec: row.display_duration_sec,
    durationDays: row.duration_days,
    tokensPaid: row.tokens_paid,
    createdAt: new Date(row.created_at).getTime(),
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).getTime() : undefined,
    carouselAdId: row.carousel_ad_id ?? undefined,
  };
}

export async function listPendingAdSubmissions(): Promise<UserAdSubmission[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase().functions.invoke('admin-approve-ad', {
    body: { action: 'list_pending' },
  });
  if (error) throw new Error(error.message);
  const rows = (data?.pending ?? []) as UserAdSubmissionRow[];
  return rows.map(rowToSubmission);
}

export async function reviewAdSubmission(
  submissionId: string,
  action: 'approve' | 'reject',
  reason?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Supabase not configured' };
  const { data, error } = await getSupabase().functions.invoke('admin-approve-ad', {
    body: {
      action,
      submission_id: submissionId,
      reason: reason?.trim() || undefined,
    },
  });
  if (error) return { ok: false, error: error.message };
  if (data?.ok !== true) return { ok: false, error: String(data?.error ?? 'review_failed') };
  return { ok: true };
}
