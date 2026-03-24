import { SupabaseTable } from '../models/supabase';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';

export async function recordGiftEvent(
  senderId: string,
  recipientId: string,
  gift: { id: string; name: string; value: number }
): Promise<boolean> {
  if (!isSupabaseConfigured() || senderId === recipientId) return false;
  const { error } = await getSupabase().from(SupabaseTable.giftEvents).insert({
    sender_id: senderId,
    recipient_id: recipientId,
    gift_id: gift.id,
    gift_name: gift.name,
    token_value: Math.max(0, Math.round(gift.value)),
  });
  if (error) {
    console.error('recordGiftEvent', error);
    return false;
  }
  return true;
}
