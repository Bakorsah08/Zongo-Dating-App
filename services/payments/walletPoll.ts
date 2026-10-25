import { fetchUserWallet } from '../supabaseWallet';

/** Poll until wallet balance increases (webhook credit) or attempts exhausted. */
export async function pollWalletBalanceIncrease(
  userId: string,
  beforeTokens: number,
  options?: { attempts?: number; intervalMs?: number }
): Promise<boolean> {
  const attempts = options?.attempts ?? 24;
  const intervalMs = options?.intervalMs ?? 2500;

  for (let i = 0; i < attempts; i += 1) {
    await new Promise((r) => window.setTimeout(r, intervalMs));
    const wallet = await fetchUserWallet(userId);
    if (wallet && wallet.token_balance > beforeTokens) return true;
  }
  return false;
}
