import type { ExploreCarouselAd } from '../types';
import type { ExploreCarouselAdRow } from '../models/supabase';
import { SupabaseTable } from '../models/supabase';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';

function rowToAd(row: ExploreCarouselAdRow): ExploreCarouselAd {
  const userSource = row.source === 'user' ? 'user' : 'platform';
  return {
    id: row.id,
    enabled: row.enabled,
    badgeLabel: row.badge_label,
    title: row.title,
    subtitle: row.subtitle,
    imageUrl: row.image_url,
    imageDataUrl: row.image_data_url,
    backgroundColor: row.background_color,
    linkUrl: row.link_url,
    displayDurationSec: row.display_duration_sec,
    source: userSource,
    userSubmissionId: row.user_submission_id ?? undefined,
    submittedByUserId: row.submitted_by_user_id ?? undefined,
    campaignDurationDays: row.campaign_duration_days ?? undefined,
    campaignStartedAt: row.campaign_started_at
      ? new Date(row.campaign_started_at).getTime()
      : undefined,
    campaignEndsAt: row.campaign_ends_at ? new Date(row.campaign_ends_at).getTime() : undefined,
  };
}

/** Live slides the app may show (matches client-side filter for admin carousel). */
export async function fetchLiveCarouselAdsFromDb(): Promise<ExploreCarouselAd[]> {
  if (!isSupabaseConfigured()) return [];
  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from(SupabaseTable.exploreCarouselAds)
    .select('*')
    .eq('enabled', true)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('fetchLiveCarouselAdsFromDb', error);
    return [];
  }
  const rows = (data ?? []) as ExploreCarouselAdRow[];
  return rows
    .filter((row) => {
      if (row.source === 'platform') return true;
      return !row.campaign_ends_at || row.campaign_ends_at > now;
    })
    .map(rowToAd);
}
