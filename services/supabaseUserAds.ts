import type { UserAdSubmission } from '../types';
import type { UserAdSubmissionRow } from '../models/supabase';
import { SupabaseTable } from '../models/supabase';
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

export async function fetchUserAdSubmissionsFromDb(userId: string): Promise<UserAdSubmission[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase()
    .from(SupabaseTable.userAdSubmissions)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('fetchUserAdSubmissionsFromDb', error);
    return [];
  }
  return ((data ?? []) as UserAdSubmissionRow[]).map(rowToSubmission);
}

export async function insertUserAdSubmissionDb(
  userId: string,
  payload: {
    durationDays: number;
    tokensPaid: number;
    title: string;
    subtitle: string;
    badgeLabel: string;
    imageUrl: string;
    imageDataUrl: string;
    backgroundColor: string;
    linkUrl: string;
    displayDurationSec: number;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Supabase not configured' };
  const { data, error } = await getSupabase()
    .from(SupabaseTable.userAdSubmissions)
    .insert({
      user_id: userId,
      status: 'pending',
      title: payload.title.trim(),
      subtitle: payload.subtitle.trim(),
      badge_label: payload.badgeLabel.trim() || 'Promo',
      image_url: payload.imageUrl.trim(),
      image_data_url: payload.imageDataUrl.trim(),
      background_color: payload.backgroundColor.trim(),
      link_url: payload.linkUrl.trim(),
      display_duration_sec: Math.min(120, Math.max(3, Math.round(payload.displayDurationSec) || 8)),
      duration_days: payload.durationDays,
      tokens_paid: payload.tokensPaid,
    })
    .select('id')
    .single();
  if (error) {
    console.error('insertUserAdSubmissionDb', error);
    return { ok: false, error: error.message };
  }
  if (!data?.id) return { ok: false, error: 'No id returned' };
  return { ok: true, id: data.id as string };
}
