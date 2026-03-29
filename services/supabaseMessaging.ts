import type { ConversationRow, MessageRow, ProfileRowPartial } from '../models/supabase';
import { SupabaseTable } from '../models/supabase';
import type { User } from '../types';
import type { Message } from '../types';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { devError } from '../lib/devLog';
import { toUserSafeMessage } from '../lib/userSafeError';
import { profileRowToPublicUser } from './mapProfileToUser';
import { getSignedChatMediaUrl } from './supabaseStorage';
import { trackFailure, trackRealtimeStatus } from './monitoring';

export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export type InboxSummary = {
  conversationId: string;
  partner: User;
  preview: string;
  at: number;
};

async function rowToMessage(row: MessageRow): Promise<Message> {
  const [imageUrl, videoUrl, audioUrl] = await Promise.all([
    getSignedChatMediaUrl(row.image_url),
    getSignedChatMediaUrl(row.video_url),
    getSignedChatMediaUrl(row.audio_url),
  ]);
  return {
    id: row.id,
    senderId: row.sender_id,
    text: row.body ?? undefined,
    imageUrl,
    videoUrl,
    audioUrl,
    timestamp: new Date(row.created_at).getTime(),
  };
}

export async function ensureMatchPair(userA: string, userB: string): Promise<boolean> {
  if (!isSupabaseConfigured() || userA === userB) return false;
  const [lo, hi] = orderedPair(userA, userB);
  const { error } = await getSupabase().from(SupabaseTable.matchPairs).insert({
    user_low: lo,
    user_high: hi,
  });
  if (error && error.code !== '23505') {
    devError('ensureMatchPair', error);
    trackFailure('rpc', 'ensure_match_pair', error);
    return false;
  }
  return true;
}

export async function getOrCreateConversation(userA: string, userB: string): Promise<string | null> {
  if (!isSupabaseConfigured() || userA === userB) return null;
  const [lo, hi] = orderedPair(userA, userB);
  const sb = getSupabase();
  const { data: found, error: selErr } = await sb
    .from(SupabaseTable.conversations)
    .select('id')
    .eq('participant_a', lo)
    .eq('participant_b', hi)
    .maybeSingle();
  if (selErr) {
    devError('getOrCreateConversation select', selErr);
    trackFailure('rpc', 'get_or_create_conversation_select', selErr);
    return null;
  }
  if (found?.id) return found.id as string;

  const { data: inserted, error: insErr } = await sb
    .from(SupabaseTable.conversations)
    .insert({ participant_a: lo, participant_b: hi })
    .select('id')
    .single();
  if (insErr) {
    devError('getOrCreateConversation insert', insErr);
    trackFailure('rpc', 'get_or_create_conversation_insert', insErr);
    return null;
  }
  return inserted?.id as string;
}

export type ListMessagesResult = { messages: Message[]; error: string | null };

export async function listMessages(conversationId: string): Promise<ListMessagesResult> {
  if (!isSupabaseConfigured()) return { messages: [], error: null };
  const { data, error } = await getSupabase()
    .from(SupabaseTable.messages)
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) {
    devError('listMessages', error);
    trackFailure('rpc', 'list_messages', error);
    return { messages: [], error: toUserSafeMessage(error) };
  }
  const messages = await Promise.all(((data ?? []) as MessageRow[]).map(rowToMessage));
  return { messages, error: null };
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  payload: { text?: string; image_url?: string; video_url?: string; audio_url?: string }
): Promise<Message | null> {
  if (!isSupabaseConfigured()) return null;
  const body = payload.text?.trim() || null;
  const { data, error } = await getSupabase()
    .from(SupabaseTable.messages)
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body,
      image_url: payload.image_url ?? null,
      video_url: payload.video_url ?? null,
      audio_url: payload.audio_url ?? null,
    })
    .select('*')
    .single();
  if (error) {
    devError('sendMessage', error);
    trackFailure('rpc', 'send_message', error);
    return null;
  }
  return rowToMessage(data as MessageRow);
}

export async function listInboxForUser(userId: string): Promise<InboxSummary[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  const { data: convs, error: cErr } = await sb
    .from(SupabaseTable.conversations)
    .select('*')
    .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
    .order('last_message_at', { ascending: false });
  if (cErr) {
    devError('listInboxForUser conversations', cErr);
    trackFailure('rpc', 'list_inbox_conversations', cErr);
    return [];
  }
  const list = (convs ?? []) as ConversationRow[];
  if (list.length === 0) return [];

  const convIds = list.map((c) => c.id);
  const { data: allMsgs, error: mErr } = await sb
    .from(SupabaseTable.messages)
    .select('*')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: false });
  if (mErr) {
    devError('listInboxForUser messages', mErr);
    trackFailure('rpc', 'list_inbox_messages', mErr);
    return [];
  }
  const lastByConv = new Map<string, MessageRow>();
  for (const m of (allMsgs ?? []) as MessageRow[]) {
    if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m);
  }

  const otherIds = list.map((c) => (c.participant_a === userId ? c.participant_b : c.participant_a));
  const uniqueOthers = [...new Set(otherIds)];
  const { data: profiles, error: pErr } = await sb
    .from(SupabaseTable.profiles)
    .select('*')
    .in('id', uniqueOthers);
  if (pErr) {
    devError('listInboxForUser profiles', pErr);
    trackFailure('rpc', 'list_inbox_profiles', pErr);
    return [];
  }
  const userById = new Map(
    ((profiles ?? []) as ProfileRowPartial[]).map((p) => [p.id, profileRowToPublicUser(p)])
  );

  return list.map((c) => {
    const oid = c.participant_a === userId ? c.participant_b : c.participant_a;
    const partner = userById.get(oid) ?? ({
      id: oid,
      name: 'Member',
      age: 25,
      bio: '',
      avatar: 'https://picsum.photos/seed/unknown/200',
      interests: [],
      location: '—',
      distance: 1,
      isOnline: false,
      album: [],
    } as User);
    const last = lastByConv.get(c.id);
    const preview = last?.body?.trim() || (last?.image_url ? '📷 Photo' : last?.audio_url ? '🎤 Voice' : 'Say hi!');
    const at = last ? new Date(last.created_at).getTime() : new Date(c.created_at).getTime();
    return {
      conversationId: c.id,
      partner,
      preview,
      at,
    };
  });
}

export function subscribeToConversationMessages(
  conversationId: string,
  onInsert: (msg: Message) => void
): RealtimeChannel | null {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  const channel = sb
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: SupabaseTable.messages,
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const row = payload.new as MessageRow;
        if (row?.id) {
          void rowToMessage(row).then(onInsert);
        }
      }
    )
    .subscribe((status, err) => {
      trackRealtimeStatus('conversation_messages_subscription', status, err);
    });
  return channel;
}

export function unsubscribeChannel(ch: RealtimeChannel | null) {
  if (ch && isSupabaseConfigured()) {
    void getSupabase().removeChannel(ch);
  }
}
