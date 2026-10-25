import type { BadgeTier, User } from '../types';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { trackFailure } from './monitoring';

/** Supabase client uses this when the function URL cannot be reached or returns a relay error. */
const EDGE_INVOKE_FAILED_RE = /failed to send a request to the edge function/i;

function hintForEdgeInvokeFailure(baseMessage: string): string {
  if (!EDGE_INVOKE_FAILED_RE.test(baseMessage)) return baseMessage;
  return `${baseMessage} — Deploy this project’s function from the repo root: npx supabase functions deploy admin-broadcast-notification (after npx supabase link). In Dashboard → Project Settings → Edge Functions, confirm secrets SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY exist.`;
}

type ProfileListRow = {
  id: string;
  display_name: string;
  gender: string | null;
  badge_tier: string;
  is_online: boolean;
  avatar_url: string;
  location: string;
};

function rowToUser(row: ProfileListRow): User {
  const g = row.gender === 'male' || row.gender === 'female' ? row.gender : undefined;
  const tier = (row.badge_tier as BadgeTier) || 'none';
  return {
    id: row.id,
    name: row.display_name?.trim() || 'Member',
    age: 0,
    bio: '',
    avatar: row.avatar_url?.trim() || 'https://picsum.photos/seed/n/80',
    interests: [],
    location: row.location?.trim() || '',
    distance: 0,
    isOnline: Boolean(row.is_online),
    album: [],
    badgeTier: tier,
    gender: g,
  };
}

export async function listBroadcastAudienceProfiles(): Promise<User[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase().functions.invoke('admin-broadcast-notification', {
    body: { action: 'list_profiles' },
  });
  if (error) {
    trackFailure('rpc', 'admin_broadcast_list_profiles', error);
    throw new Error(hintForEdgeInvokeFailure(error.message));
  }
  if (data?.ok !== true) {
    const err = String(data?.error ?? 'list_failed');
    trackFailure('rpc', 'admin_broadcast_list_profiles', err);
    throw new Error(err);
  }
  const rows = (data?.profiles ?? []) as ProfileListRow[];
  return rows.map(rowToUser);
}

export async function sendAdminBroadcastNotifications(
  message: string,
  recipientIds: string[]
): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Supabase not configured' };
  const { data, error } = await getSupabase().functions.invoke('admin-broadcast-notification', {
    body: {
      action: 'send',
      message: message.trim(),
      recipient_ids: recipientIds,
    },
  });
  if (error) {
    trackFailure('rpc', 'admin_broadcast_send', error);
    return { ok: false, error: hintForEdgeInvokeFailure(error.message) };
  }
  if (data?.ok !== true) {
    return { ok: false, error: String(data?.error ?? 'send_failed') };
  }
  return { ok: true, sent: Number(data.sent ?? 0) };
}
