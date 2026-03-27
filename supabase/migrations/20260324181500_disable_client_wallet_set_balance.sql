-- Hardening: fully disable legacy client-set wallet balance RPC.
-- Balance changes must come from trusted server-side flows:
-- - payments-webhook (purchase credits)
-- - admin-reviewed workflows
-- - wallet-action/service-role mediated deltas
-- Rollback: restore execute grants on public.wallet_set_token_balance(integer) and replace the disabled function body with the prior implementation if required.

revoke all on function public.wallet_set_token_balance(integer) from public;
revoke all on function public.wallet_set_token_balance(integer) from authenticated;

create or replace function public.wallet_set_token_balance(p_balance integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return jsonb_build_object(
    'ok', false,
    'error', 'disabled',
    'message', 'Client-triggered set-balance is disabled. Use server-verified wallet events.'
  );
end;
$$;

comment on function public.wallet_set_token_balance(integer) is
  'DISABLED: Legacy client set-balance RPC removed. Use server-verified events (payments webhooks/admin workflows/wallet_apply_delta).';
