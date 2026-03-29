import type { PostgrestError } from '@supabase/supabase-js';
import type { TokenPackage } from '../types';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';

type TokenPackageRow = {
  id: string;
  tokens: number;
  display_price: string;
  currency: string;
  stripe_price_id: string | null;
  revenuecat_product_id: string | null;
  active: boolean;
  sort_order: number;
};

function rowToTokenPackage(r: TokenPackageRow): TokenPackage {
  return { id: r.id, tokens: r.tokens, price: r.display_price };
}

export async function fetchActiveTokenPackagesFromDb(): Promise<TokenPackage[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  const { data, error } = await sb
    .from('token_packages')
    .select('id,tokens,display_price,currency,stripe_price_id,revenuecat_product_id,active,sort_order')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('tokens', { ascending: true });
  if (error) throw error;
  return (data as TokenPackageRow[]).map(rowToTokenPackage);
}

export type AdminTokenPackageInput = {
  id: string;
  tokens: number;
  display_price: string;
  currency?: string;
  stripe_price_id?: string | null;
  revenuecat_product_id?: string | null;
  active?: boolean;
  sort_order?: number;
};

export async function adminUpsertTokenPackageDb(input: AdminTokenPackageInput): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Supabase is not configured.' };
  const sb = getSupabase();
  const payload = {
    id: input.id,
    tokens: input.tokens,
    display_price: input.display_price,
    currency: input.currency ?? 'USD',
    stripe_price_id: input.stripe_price_id ?? null,
    revenuecat_product_id: input.revenuecat_product_id ?? null,
    active: input.active ?? true,
    sort_order: input.sort_order ?? 0,
  };
  const { error } = await sb.from('token_packages').upsert(payload, { onConflict: 'id' });
  if (error) return { ok: false, error: (error as PostgrestError).message };
  return { ok: true };
}

export async function adminDeleteTokenPackageDb(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Supabase is not configured.' };
  const sb = getSupabase();
  const { error } = await sb.from('token_packages').delete().eq('id', id);
  if (error) return { ok: false, error: (error as PostgrestError).message };
  return { ok: true };
}

