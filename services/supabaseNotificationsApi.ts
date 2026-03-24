import type { AppNotification } from '../types';
import type { AppNotificationRow } from '../models/supabase';
import { SupabaseTable } from '../models/supabase';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';

export function appNotificationFromRow(n: AppNotificationRow): AppNotification {
  const createdAt = new Date(n.created_at).getTime();
  if (n.type === 'super_like') {
    return {
      id: n.id,
      type: 'super_like',
      read: n.read,
      createdAt,
      fromUserId: n.from_user_id ?? undefined,
      fromName: n.from_name ?? undefined,
      fromAvatar: n.from_avatar ?? undefined,
    };
  }
  return {
    id: n.id,
    type: 'system',
    read: n.read,
    createdAt,
    systemKind: (n.system_kind as AppNotification['systemKind']) ?? undefined,
    systemMessage: n.system_message ?? undefined,
  };
}

export async function fetchNotificationsForUser(userId: string): Promise<AppNotification[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase()
    .from(SupabaseTable.appNotifications)
    .select('*')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('fetchNotificationsForUser', error);
    return [];
  }
  return ((data ?? []) as AppNotificationRow[]).map(appNotificationFromRow);
}

export async function markAllNotificationsReadDb(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { error } = await getSupabase()
    .from(SupabaseTable.appNotifications)
    .update({ read: true })
    .eq('recipient_id', userId)
    .eq('read', false);
  if (error) {
    console.error('markAllNotificationsReadDb', error);
    return false;
  }
  return true;
}

export async function insertSuperLikeNotificationDb(
  recipientId: string,
  from: { id: string; name: string; avatar: string }
): Promise<boolean> {
  if (!isSupabaseConfigured() || !recipientId || recipientId === from.id) return false;
  const { error } = await getSupabase().from(SupabaseTable.appNotifications).insert({
    recipient_id: recipientId,
    type: 'super_like',
    read: false,
    from_user_id: from.id,
    from_name: from.name.trim() || 'Someone',
    from_avatar: from.avatar || '',
  });
  if (error) {
    console.error('insertSuperLikeNotificationDb', error);
    return false;
  }
  return true;
}
