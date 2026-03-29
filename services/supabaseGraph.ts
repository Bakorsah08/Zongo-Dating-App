import { SupabaseTable } from '../models/supabase';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { devError } from '../lib/devLog';

export async function listFollowingIds(userId: string): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase()
    .from(SupabaseTable.follows)
    .select('following_id')
    .eq('follower_id', userId);
  if (error) {
    devError('listFollowingIds', error);
    return [];
  }
  return (data ?? []).map((r: { following_id: string }) => r.following_id);
}

export async function listBlockedIds(userId: string): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase()
    .from(SupabaseTable.userBlocks)
    .select('blocked_id')
    .eq('blocker_id', userId);
  if (error) {
    devError('listBlockedIds', error);
    return [];
  }
  return (data ?? []).map((r: { blocked_id: string }) => r.blocked_id);
}

export async function addFollow(followerId: string, followingId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || followerId === followingId) return false;
  const { error } = await getSupabase().from(SupabaseTable.follows).insert({
    follower_id: followerId,
    following_id: followingId,
  });
  if (error) {
    if (error.code === '23505') return true;
    devError('addFollow', error);
    return false;
  }
  return true;
}

export async function removeFollow(followerId: string, followingId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { error } = await getSupabase()
    .from(SupabaseTable.follows)
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);
  if (error) {
    devError('removeFollow', error);
    return false;
  }
  return true;
}

export async function addBlock(blockerId: string, blockedId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || blockerId === blockedId) return false;
  const { error } = await getSupabase().from(SupabaseTable.userBlocks).insert({
    blocker_id: blockerId,
    blocked_id: blockedId,
  });
  if (error) {
    if (error.code === '23505') return true;
    devError('addBlock', error);
    return false;
  }
  return true;
}

export async function removeBlock(blockerId: string, blockedId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { error } = await getSupabase()
    .from(SupabaseTable.userBlocks)
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);
  if (error) {
    devError('removeBlock', error);
    return false;
  }
  return true;
}
