-- Hardening follow-up: remove deprecated client-set balance RPC entirely.
-- Balance mutations must use trusted server-side flows only.
-- Rollback: recreate function public.wallet_set_token_balance(integer) and restore only the minimum grants required by your trusted caller path.

drop function if exists public.wallet_set_token_balance(integer);
