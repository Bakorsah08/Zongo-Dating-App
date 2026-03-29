-- Drop legacy client-callable earnings/cashout RPCs from older installs of
-- 20250325150000_wallet_rpc_rls.sql. New installs no longer create these; balance authority
-- is Edge Functions + service_role (wallet_apply_delta) and authenticated request_cashout.
-- Rollback: recreate functions from a schema backup; avoid granting execute to authenticated in production.

drop function if exists public.wallet_credit_earnings(numeric);
drop function if exists public.wallet_cash_out(numeric);

grant execute on function public.wallet_apply_delta(uuid, integer, text, text, jsonb) to service_role;
