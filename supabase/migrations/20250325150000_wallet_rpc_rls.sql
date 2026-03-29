-- Wallet: remove arbitrary client UPDATE on user_account. Authenticated clients may only
-- call wallet_bootstrap_if_zero to seed starter tokens when balance is still 0.
-- All other balance / earnings changes go through trusted backends:
--   - Edge Functions: wallet-action, payments-webhook, admin flows
--   - SQL: public.wallet_apply_delta (service_role), public.request_cashout (JWT)
-- Apply after 20250324120000_zongo_domain_schema.sql.
-- Rollback: restore prior user_account update policy and any client-callable wallet_* RPCs you removed.

drop policy if exists "user_account_update_own" on public.user_account;

-- ---------------------------------------------------------------------------
-- Bootstrap starter tokens when balance is still 0
-- ---------------------------------------------------------------------------
create or replace function public.wallet_bootstrap_if_zero(p_starter integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  tb integer;
  earn numeric;
  tout numeric;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if coalesce(p_starter, 0) > 0 then
    update public.user_account
    set token_balance = p_starter
    where user_id = uid and token_balance = 0;
  end if;

  select ua.token_balance, ua.earnings, ua.transferred_out
    into tb, earn, tout
  from public.user_account ua
  where ua.user_id = uid;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_wallet');
  end if;

  return jsonb_build_object(
    'ok', true,
    'token_balance', tb,
    'earnings', earn,
    'transferred_out', tout
  );
end;
$$;

revoke all on function public.wallet_bootstrap_if_zero(integer) from public;
grant execute on function public.wallet_bootstrap_if_zero(integer) to authenticated;

comment on function public.wallet_bootstrap_if_zero(integer) is
  'Seeds starter tokens when balance is 0; all other wallet mutations use trusted server paths.';
