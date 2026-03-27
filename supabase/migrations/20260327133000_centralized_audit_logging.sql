-- Centralized audit logging for admin actions, wallet movements, ad decisions,
-- and payout actions.

create table if not exists public.audit_logs (
  id bigserial primary key,
  action text not null,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_label text not null default 'system',
  target_user_id uuid references public.profiles (id) on delete set null,
  amount numeric(14, 2),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_len_ck check (char_length(action) between 1 and 200),
  constraint audit_logs_actor_label_len_ck check (char_length(actor_label) between 1 and 120),
  constraint audit_logs_reason_len_ck check (reason is null or char_length(reason) <= 2000)
);

create index if not exists audit_logs_created_idx
  on public.audit_logs (created_at desc);
create index if not exists audit_logs_action_created_idx
  on public.audit_logs (action, created_at desc);
create index if not exists audit_logs_actor_created_idx
  on public.audit_logs (actor_user_id, created_at desc);
create index if not exists audit_logs_target_created_idx
  on public.audit_logs (target_user_id, created_at desc);

alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from authenticated;

create or replace function public.audit_log_event(
  p_action text,
  p_actor_user_id uuid default null,
  p_actor_label text default null,
  p_target_user_id uuid default null,
  p_amount numeric default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(char_length(trim(p_action)), 0) = 0 then
    raise exception 'audit_log_event: action is required'
      using errcode = 'check_violation';
  end if;

  insert into public.audit_logs (
    action,
    actor_user_id,
    actor_label,
    target_user_id,
    amount,
    reason,
    metadata,
    created_at
  )
  values (
    trim(p_action),
    p_actor_user_id,
    coalesce(nullif(trim(p_actor_label), ''), 'system'),
    p_target_user_id,
    p_amount,
    nullif(trim(coalesce(p_reason, '')), ''),
    coalesce(p_metadata, '{}'::jsonb),
    coalesce(p_occurred_at, now())
  );
end;
$$;

revoke all on function public.audit_log_event(
  text, uuid, text, uuid, numeric, text, jsonb, timestamptz
) from public;
grant execute on function public.audit_log_event(
  text, uuid, text, uuid, numeric, text, jsonb, timestamptz
) to service_role;

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
  v_reason text;
  v_actor_raw text;
  v_actor_user_id uuid;
  v_actor_label text;
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

  v_reason := nullif(trim(coalesce(p_meta ->> 'reason', '')), '');
  if v_reason is null then
    v_reason := nullif(trim(coalesce(p_meta ->> 'source', '')), '');
  end if;

  v_actor_raw := nullif(trim(coalesce(p_meta ->> 'actor_user_id', '')), '');
  if v_actor_raw is not null and v_actor_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_actor_user_id := v_actor_raw::uuid;
  else
    v_actor_user_id := null;
  end if;

  v_actor_label := coalesce(
    nullif(trim(coalesce(p_meta ->> 'actor_label', '')), ''),
    case
      when v_actor_user_id is not null then 'user'
      else coalesce(nullif(trim(coalesce(p_meta ->> 'source', '')), ''), 'system')
    end
  );

  perform public.audit_log_event(
    p_action => 'wallet.' || p_kind,
    p_actor_user_id => v_actor_user_id,
    p_actor_label => v_actor_label,
    p_target_user_id => p_user_id,
    p_amount => p_delta::numeric,
    p_reason => v_reason,
    p_metadata => jsonb_build_object(
      'reference_id', p_reference_id,
      'meta', coalesce(p_meta, '{}'::jsonb)
    )
  );

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

  perform public.audit_log_event(
    p_action => 'payout.requested',
    p_actor_user_id => uid,
    p_actor_label => 'user',
    p_target_user_id => uid,
    p_amount => p_amount,
    p_reason => 'user_cashout_request',
    p_metadata => jsonb_build_object('cashout_request_id', v_request_id)
  );

  return jsonb_build_object(
    'ok', true,
    'request_id', v_request_id,
    'earnings', v_earn
  );
end;
$$;

revoke all on function public.request_cashout(numeric) from public;
grant execute on function public.request_cashout(numeric) to authenticated;
