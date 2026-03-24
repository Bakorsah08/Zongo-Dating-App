-- Admin + wallet hardening baseline for production.
-- Adds admin roles, immutable wallet ledger, cashout request queue,
-- and secure SQL functions for trusted server-side actions.

-- ---------------------------------------------------------------------------
-- 1) Admin roles
-- ---------------------------------------------------------------------------
create table if not exists public.admin_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('super_admin', 'moderator', 'support')),
  created_at timestamptz not null default now()
);

alter table public.admin_roles enable row level security;

drop policy if exists "admin_roles_select_self" on public.admin_roles;
create policy "admin_roles_select_self"
  on public.admin_roles for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on public.admin_roles from authenticated;

-- ---------------------------------------------------------------------------
-- 2) Immutable wallet ledger
-- ---------------------------------------------------------------------------
create table if not exists public.wallet_ledger (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('purchase_credit', 'gift_debit', 'gift_credit', 'cashout_debit', 'admin_adjust')),
  amount integer not null,
  reference_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists wallet_ledger_user_created_idx
  on public.wallet_ledger (user_id, created_at desc);

alter table public.wallet_ledger enable row level security;

drop policy if exists "wallet_ledger_select_own" on public.wallet_ledger;
create policy "wallet_ledger_select_own"
  on public.wallet_ledger for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on public.wallet_ledger from authenticated;

-- ---------------------------------------------------------------------------
-- 3) Cashout requests queue
-- ---------------------------------------------------------------------------
create table if not exists public.cashout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'rejected')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists cashout_requests_user_created_idx
  on public.cashout_requests (user_id, created_at desc);

alter table public.cashout_requests enable row level security;

drop policy if exists "cashout_select_own" on public.cashout_requests;
create policy "cashout_select_own"
  on public.cashout_requests for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "cashout_insert_own" on public.cashout_requests;
create policy "cashout_insert_own"
  on public.cashout_requests for insert
  to authenticated
  with check (auth.uid() = user_id);

revoke update, delete on public.cashout_requests from authenticated;

-- ---------------------------------------------------------------------------
-- 4) SQL helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_admin(_uid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.admin_roles ar
    where ar.user_id = _uid
  );
$$;

create or replace function public.wallet_apply_delta(
  p_user_id uuid,
  p_delta integer,
  p_kind text,
  p_reference_id text default null,
  p_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_user');
  end if;

  if coalesce(p_delta, 0) = 0 then
    return jsonb_build_object('ok', false, 'error', 'zero_delta');
  end if;

  if p_kind not in ('purchase_credit', 'gift_debit', 'gift_credit', 'cashout_debit', 'admin_adjust') then
    return jsonb_build_object('ok', false, 'error', 'invalid_kind');
  end if;

  update public.user_account
  set token_balance = token_balance + p_delta
  where user_id = p_user_id
    and token_balance + p_delta >= 0
  returning token_balance into v_balance;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'insufficient_or_missing_wallet');
  end if;

  insert into public.wallet_ledger (user_id, kind, amount, reference_id, meta)
  values (p_user_id, p_kind, p_delta, p_reference_id, coalesce(p_meta, '{}'::jsonb));

  return jsonb_build_object('ok', true, 'token_balance', v_balance);
end;
$$;

-- Client cannot call this directly; trusted backend uses service role.
revoke all on function public.wallet_apply_delta(uuid, integer, text, text, jsonb) from public;
revoke all on function public.wallet_apply_delta(uuid, integer, text, text, jsonb) from authenticated;

create or replace function public.request_cashout(p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_earn numeric;
  v_request_id uuid;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if coalesce(p_amount, 0) <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;

  update public.user_account
  set earnings = earnings - p_amount
  where user_id = uid
    and earnings >= p_amount
  returning earnings into v_earn;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'insufficient_earnings');
  end if;

  insert into public.cashout_requests (user_id, amount, status)
  values (uid, p_amount, 'pending')
  returning id into v_request_id;

  return jsonb_build_object(
    'ok', true,
    'request_id', v_request_id,
    'earnings', v_earn
  );
end;
$$;

revoke all on function public.request_cashout(numeric) from public;
grant execute on function public.request_cashout(numeric) to authenticated;
