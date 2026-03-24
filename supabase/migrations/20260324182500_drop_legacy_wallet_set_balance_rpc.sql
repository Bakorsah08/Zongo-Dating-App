-- Hardening follow-up: remove deprecated client-set balance RPC entirely.
-- Balance mutations must use trusted server-side flows only.

drop function if exists public.wallet_set_token_balance(integer);
