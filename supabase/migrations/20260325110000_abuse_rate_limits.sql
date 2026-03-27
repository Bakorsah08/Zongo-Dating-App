-- Abuse controls: throttle high-frequency writes and social churn.
-- Enforced in Postgres triggers so limits apply to all clients.
-- Rollback: drop abuse/rate-limit triggers and enforcement functions; optionally drop table public.abuse_action_log and related policies/indexes.

-- ---------------------------------------------------------------------------
-- 1) Social churn action log (follow/block insert+delete)
-- ---------------------------------------------------------------------------
create table if not exists public.abuse_action_log (
  id bigserial primary key,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  action text not null check (action in ('follow_insert', 'follow_delete', 'block_insert', 'block_delete')),
  created_at timestamptz not null default now()
);

create index if not exists abuse_action_log_actor_action_created_idx
  on public.abuse_action_log (actor_id, action, created_at desc);

create index if not exists abuse_action_log_actor_target_action_created_idx
  on public.abuse_action_log (actor_id, target_id, action, created_at desc);

alter table public.abuse_action_log enable row level security;

drop policy if exists "abuse_action_log_select_self" on public.abuse_action_log;
create policy "abuse_action_log_select_self"
  on public.abuse_action_log for select
  to authenticated
  using (auth.uid() = actor_id);

revoke insert, update, delete on public.abuse_action_log from authenticated;

create or replace function public.enforce_social_churn_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
  target uuid;
  action_prefix text;
  total_window integer;
  pair_window integer;
begin
  if tg_table_name = 'follows' then
    actor := coalesce(new.follower_id, old.follower_id);
    target := coalesce(new.following_id, old.following_id);
    action_prefix := 'follow';
  elsif tg_table_name = 'user_blocks' then
    actor := coalesce(new.blocker_id, old.blocker_id);
    target := coalesce(new.blocked_id, old.blocked_id);
    action_prefix := 'block';
  else
    return coalesce(new, old);
  end if;

  -- Per actor: no more than 40 churn events/min per graph type.
  select count(*)::integer into total_window
  from public.abuse_action_log l
  where l.actor_id = actor
    and l.action in (action_prefix || '_insert', action_prefix || '_delete')
    and l.created_at >= now() - interval '1 minute';

  if total_window >= 40 then
    raise exception '%_rate_limited: too many social graph actions; retry later', action_prefix
      using errcode = 'check_violation';
  end if;

  -- Per actor->target pair: cap repeated flip-flopping.
  select count(*)::integer into pair_window
  from public.abuse_action_log l
  where l.actor_id = actor
    and l.target_id = target
    and l.action in (action_prefix || '_insert', action_prefix || '_delete')
    and l.created_at >= now() - interval '10 minutes';

  if pair_window >= 20 then
    raise exception '%_pair_rate_limited: too many repeated actions to same user; retry later', action_prefix
      using errcode = 'check_violation';
  end if;

  insert into public.abuse_action_log (actor_id, target_id, action)
  values (
    actor,
    target,
    action_prefix || case when tg_op = 'INSERT' then '_insert' else '_delete' end
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists follows_churn_rate_limit_trg on public.follows;
create trigger follows_churn_rate_limit_trg
  before insert or delete on public.follows
  for each row execute function public.enforce_social_churn_rate_limit();

drop trigger if exists user_blocks_churn_rate_limit_trg on public.user_blocks;
create trigger user_blocks_churn_rate_limit_trg
  before insert or delete on public.user_blocks
  for each row execute function public.enforce_social_churn_rate_limit();

-- ---------------------------------------------------------------------------
-- 2) Message spam throttling
-- ---------------------------------------------------------------------------
create or replace function public.enforce_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_10s integer;
  sender_1m integer;
  conv_10s integer;
begin
  select count(*)::integer into sender_10s
  from public.messages m
  where m.sender_id = new.sender_id
    and m.created_at >= now() - interval '10 seconds';

  if sender_10s >= 12 then
    raise exception 'message_rate_limited: too many messages in 10s'
      using errcode = 'check_violation';
  end if;

  select count(*)::integer into sender_1m
  from public.messages m
  where m.sender_id = new.sender_id
    and m.created_at >= now() - interval '1 minute';

  if sender_1m >= 50 then
    raise exception 'message_rate_limited: too many messages in 1m'
      using errcode = 'check_violation';
  end if;

  select count(*)::integer into conv_10s
  from public.messages m
  where m.sender_id = new.sender_id
    and m.conversation_id = new.conversation_id
    and m.created_at >= now() - interval '10 seconds';

  if conv_10s >= 8 then
    raise exception 'message_rate_limited: too many messages in this chat'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists messages_rate_limit_trg on public.messages;
create trigger messages_rate_limit_trg
  before insert on public.messages
  for each row execute function public.enforce_message_rate_limit();

-- ---------------------------------------------------------------------------
-- 3) Notification insert throttling
-- ---------------------------------------------------------------------------
create or replace function public.enforce_notification_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_1m integer;
  sender_pair_1m integer;
begin
  if new.type <> 'super_like' or new.from_user_id is null then
    return new;
  end if;

  select count(*)::integer into sender_1m
  from public.app_notifications n
  where n.type = 'super_like'
    and n.from_user_id = new.from_user_id
    and n.created_at >= now() - interval '1 minute';

  if sender_1m >= 20 then
    raise exception 'notification_rate_limited: too many notification inserts in 1m'
      using errcode = 'check_violation';
  end if;

  select count(*)::integer into sender_pair_1m
  from public.app_notifications n
  where n.type = 'super_like'
    and n.from_user_id = new.from_user_id
    and n.recipient_id = new.recipient_id
    and n.created_at >= now() - interval '1 minute';

  if sender_pair_1m >= 3 then
    raise exception 'notification_rate_limited: too many notifications to same recipient'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists app_notifications_rate_limit_trg on public.app_notifications;
create trigger app_notifications_rate_limit_trg
  before insert on public.app_notifications
  for each row execute function public.enforce_notification_rate_limit();

-- ---------------------------------------------------------------------------
-- 4) Gift event throttling
-- ---------------------------------------------------------------------------
create or replace function public.enforce_gift_event_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_1m integer;
  pair_1m integer;
begin
  select count(*)::integer into sender_1m
  from public.gift_events g
  where g.sender_id = new.sender_id
    and g.created_at >= now() - interval '1 minute';

  if sender_1m >= 30 then
    raise exception 'gift_rate_limited: too many gift events in 1m'
      using errcode = 'check_violation';
  end if;

  select count(*)::integer into pair_1m
  from public.gift_events g
  where g.sender_id = new.sender_id
    and g.recipient_id = new.recipient_id
    and g.created_at >= now() - interval '1 minute';

  if pair_1m >= 10 then
    raise exception 'gift_rate_limited: too many gifts to same recipient in 1m'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists gift_events_rate_limit_trg on public.gift_events;
create trigger gift_events_rate_limit_trg
  before insert on public.gift_events
  for each row execute function public.enforce_gift_event_rate_limit();
