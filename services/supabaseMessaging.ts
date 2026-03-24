import type { ConversationRow, MessageRow, ProfileRowPartial } from '../models/supabase';
import { SupabaseTable } from '../models/supabase';
import type { User } from '../types';
import type { Message } from '../types';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { profileRowToPublicUser } from './mapProfileToUser';

export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export type InboxSummary = {
  conversationId: string;
  partner: User;
  preview: string;
  at: number;
};

function rowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    senderId: row.sender_id,
    text: row.body ?? undefined,
    imageUrl: row.image_url ?? undefined,
    videoUrl: row.video_url ?? undefined,
    audioUrl: row.audio_url ?? undefined,
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
    console.error('ensureMatchPair', error);
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
    console.error('getOrCreateConversation select', selErr);
    return null;
  }
  if (found?.id) return found.id as string;

  const { data: inserted, error: insErr } = await sb
    .from(SupabaseTable.conversations)
    .insert({ participant_a: lo, participant_b: hi })
    .select('id')
    .single();
  if (insErr) {
    console.error('getOrCreateConversation insert', insErr);
    return null;
  }
  return inserted?.id as string;
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase()
    .from(SupabaseTable.messages)
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('listMessages', error);
    return [];
  }
  return ((data ?? []) as MessageRow[]).map(rowToMessage);
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
    console.error('sendMessage', error);
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
    console.error('listInboxForUser conversations', cErr);
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
    console.error('listInboxForUser messages', mErr);
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
    console.error('listInboxForUser profiles', pErr);
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
        if (row?.id) onInsert(rowToMessage(row));
      }
    )
    .subscribe();
  return channel;
}

export function unsubscribeChannel(ch: RealtimeChannel | null) {
  if (ch && isSupabaseConfigured()) {
    void getSupabase().removeChannel(ch);
  }
}
