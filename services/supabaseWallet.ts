import type { UserAccountRow } from '../models/supabase';
import { SupabaseTable } from '../models/supabase';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export type WalletSnapshot = {
  token_balance: number;
  earnings: number;
  transferred_out: number;
};

function rowToSnapshot(row: UserAccountRow): WalletSnapshot {
  return {
    token_balance: row.token_balance,
    earnings: num(row.earnings),
    transferred_out: num(row.transferred_out),
  };
}

function parseWalletRpc(data: unknown): { ok: boolean; snapshot?: WalletSnapshot; error?: string } {
  if (!data || typeof data !== 'object') return { ok: false, error: 'invalid_response' };
  const o = data as Record<string, unknown>;
  if (o.ok !== true) {
    return { ok: false, error: typeof o.error === 'string' ? o.error : 'rpc_failed' };
  }
  const hasTb = typeof o.token_balance === 'number';
  const hasE = o.earnings !== undefined;
  const hasT = o.transferred_out !== undefined;
  if (hasTb || hasE || hasT) {
    return {
      ok: true,
      snapshot: {
        token_balance: hasTb ? (o.token_balance as number) : 0,
        earnings: hasE ? num(o.earnings as string | number) : 0,
        transferred_out: hasT ? num(o.transferred_out as string | number) : 0,
      },
    };
  }
  return { ok: true };
}

export async function fetchUserWallet(userId: string): Promise<WalletSnapshot | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabase()
    .from(SupabaseTable.userAccount)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('fetchUserWallet', error);
    return null;
  }
  if (!data) return null;
  return rowToSnapshot(data as UserAccountRow);
}

/**
 * Seeds starter tokens when balance is 0. Uses RPC (RLS: no direct UPDATE on user_account).
 * `userId` must match the signed-in user (RPC uses auth.uid()).
 */
export async function bootstrapWallet(userId: string, starterIfZero: number): Promise<WalletSnapshot | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabase().rpc('wallet_bootstrap_if_zero', {
    p_starter: Math.max(0, Math.round(starterIfZero)),
  });
  if (error) {
    console.error('wallet_bootstrap_if_zero', error);
    return fetchUserWallet(userId);
  }
  const parsed = parseWalletRpc(data);
  if (parsed.ok && parsed.snapshot) return parsed.snapshot;
  if (!parsed.ok) console.warn('wallet_bootstrap_if_zero', parsed.error, data);
  return fetchUserWallet(userId);
}

/** Spends tokens via trusted server mutation. */
export async function spendTokens(_userId: string, amount: number): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { data, error } = await getSupabase().functions.invoke('wallet-action', {
    body: {
      action: 'spend_tokens',
      amount: Math.max(0, Math.round(amount)),
    },
  });
  if (error) {
    console.error('wallet-action:spend_tokens', error);
    return false;
  }
  const parsed = parseWalletRpc((data as { data?: unknown } | null)?.data ?? data);
  if (!parsed.ok) {
    console.warn('wallet-action:spend_tokens', parsed.error, data);
    return false;
  }
  return true;
}

/** Cash out: moves amount from earnings to transferred_out. RPC uses auth.uid(). */
export async function cashOutWallet(_userId: string, amount: number): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { data, error } = await getSupabase().functions.invoke('wallet-action', {
    body: {
      action: 'request_cashout',
      amount: Math.max(0, amount),
    },
  });
  if (error) {
    console.error('wallet-action:request_cashout', error);
    return false;
  }
  const parsed = parseWalletRpc((data as { data?: unknown } | null)?.data ?? data);
  if (!parsed.ok) {
    console.warn('wallet-action:request_cashout', parsed.error, data);
    return false;
  }
  return true;
}
