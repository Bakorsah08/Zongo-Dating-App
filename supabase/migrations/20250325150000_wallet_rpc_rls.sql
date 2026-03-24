-- Wallet: remove arbitrary client UPDATE on user_account; use RPCs (auth.uid() only).
-- Apply after 20250324120000_zongo_domain_schema.sql.

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

-- ---------------------------------------------------------------------------
-- Token balance: allow any decrease; cap single-request credit (mock shop / grants)
-- ---------------------------------------------------------------------------
create or replace function public.wallet_set_token_balance(p_balance integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cur integer;
  newb integer;
  max_credit integer := 100000;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  newb := greatest(0, least(coalesce(p_balance, 0), 2000000000));

  select ua.token_balance into cur
  from public.user_account ua
  where ua.user_id = uid
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_wallet');
  end if;

  if newb > cur and (newb - cur) > max_credit then
    return jsonb_build_object(
      'ok', false,
      'error', 'credit_exceeds_cap',
      'current', cur,
      'max_add', max_credit
    );
  end if;

  update public.user_account
  set token_balance = newb
  where user_id = uid;

  return jsonb_build_object('ok', true, 'token_balance', newb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Earnings: bounded credit per call (gifts); cash-out moves to transferred_out
-- ---------------------------------------------------------------------------
create or replace function public.wallet_credit_earnings(p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  add_amt numeric;
  max_add numeric := 100000;
  earn numeric;
  tout numeric;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  add_amt := coalesce(p_amount, 0);
  if add_amt <= 0 or add_amt > max_add then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount', 'max', max_add);
  end if;

  update public.user_account
  set earnings = earnings + add_amt
  where user_id = uid
  returning earnings, transferred_out into earn, tout;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_wallet');
  end if;

  return jsonb_build_object(
    'ok', true,
    'earnings', earn,
    'transferred_out', tout
  );
end;
$$;

create or replace function public.wallet_cash_out(p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  amt numeric;
  earn numeric;
  tout numeric;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  amt := coalesce(p_amount, 0);
  if amt <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;

  select ua.earnings, ua.transferred_out into earn, tout
  from public.user_account ua
  where ua.user_id = uid
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_wallet');
  end if;

  if earn < amt then
    return jsonb_build_object('ok', false, 'error', 'insufficient_earnings', 'earnings', earn);
  end if;

  update public.user_account
  set
    earnings = earnings - amt,
    transferred_out = transferred_out + amt
  where user_id = uid
  returning earnings, transferred_out into earn, tout;

  return jsonb_build_object(
    'ok', true,
    'earnings', earn,
    'transferred_out', tout
  );
end;
$$;

revoke all on function public.wallet_bootstrap_if_zero(integer) from public;
revoke all on function public.wallet_set_token_balance(integer) from public;
revoke all on function public.wallet_credit_earnings(numeric) from public;
revoke all on function public.wallet_cash_out(numeric) from public;

grant execute on function public.wallet_bootstrap_if_zero(integer) to authenticated;
grant execute on function public.wallet_set_token_balance(integer) to authenticated;
grant execute on function public.wallet_credit_earnings(numeric) to authenticated;
grant execute on function public.wallet_cash_out(numeric) to authenticated;

comment on function public.wallet_set_token_balance(integer) is
  'Sets caller wallet token_balance; decreases always allowed; per-call credit capped (see function body). Real purchases should use a service-role Edge Function.';

comment on function public.wallet_credit_earnings(numeric) is
  'Adds to earnings with a per-call cap; for production gift crediting use verified server paths when abuse matters.';
