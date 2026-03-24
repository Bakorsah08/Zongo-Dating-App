import type { ProfileRowPartial } from '../models/supabase';
import { SupabaseTable } from '../models/supabase';
import type { User } from '../types';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { profileRowToPublicUser } from './mapProfileToUser';

const PAGE_LIMIT = 200;

export async function fetchDiscoverUsers(viewerId: string): Promise<User[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase()
    .from(SupabaseTable.profiles)
    .select('*')
    .neq('id', viewerId)
    .limit(PAGE_LIMIT);
  if (error) {
    console.error('fetchDiscoverUsers', error);
    return [];
  }
  const rows = (data ?? []) as ProfileRowPartial[];
  return rows.map((r) => profileRowToPublicUser(r));
}

export async function fetchProfilesByIds(ids: string[]): Promise<User[]> {
  if (!isSupabaseConfigured() || ids.length === 0) return [];
  const { data, error } = await getSupabase()
    .from(SupabaseTable.profiles)
    .select('*')
    .in('id', ids);
  if (error) {
    console.error('fetchProfilesByIds', error);
    return [];
  }
  const rows = (data ?? []) as ProfileRowPartial[];
  const byId = new Map(rows.map((r) => [r.id, profileRowToPublicUser(r)]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as User[];
}
