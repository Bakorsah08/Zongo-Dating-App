-- Zongo domain schema: social graph, chat, notifications, preferences, ads, economy.
-- Apply after 20250323120000_profiles.sql (run full chain in SQL editor or `supabase db push`).

-- ---------------------------------------------------------------------------
-- 1. Extend public profiles (discover + AI flags). Email lives in auth.users only.
-- ---------------------------------------------------------------------------
alter table public.profiles
  drop column if exists email;

alter table public.profiles
  add column if not exists badge_tier text not null default 'none'
    check (badge_tier in ('none', 'bronze', 'silver', 'gold', 'platinum', 'diamond')),
  add column if not exists is_online boolean not null default false,
  add column if not exists is_live boolean not null default false,
  add column if not exists is_ai boolean not null default false,
  add column if not exists personality text[] not null default array[]::text[],
  add column if not exists style text not null default '',
  add column if not exists video_url text not null default '',
  add column if not exists voice_name text not null default '';

comment on table public.profiles is 'Public dating profile; 1:1 with auth.users. No email column — use auth.users.';

-- ---------------------------------------------------------------------------
-- 2. Private economy + payout (not exposed in discover)
-- ---------------------------------------------------------------------------
create table if not exists public.user_account (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  token_balance integer not null default 0 check (token_balance >= 0),
  earnings numeric(14, 2) not null default 0 check (earnings >= 0),
  transferred_out numeric(14, 2) not null default 0 check (transferred_out >= 0),
  payout_details jsonb,
  pending_ad_refund_tokens integer not null default 0 check (pending_ad_refund_tokens >= 0),
  updated_at timestamptz not null default now()
);

create or replace function public.set_user_account_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists user_account_set_updated_at on public.user_account;
create trigger user_account_set_updated_at
  before update on public.user_account
  for each row execute function public.set_user_account_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Auth signup → profile + wallet row
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Member')
  )
  on conflict (id) do nothing;

  insert into public.user_account (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. New profile row (client upsert) → wallet
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_profile_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_account (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_created_user_account on public.profiles;
create trigger on_profile_created_user_account
  after insert on public.profiles
  for each row execute function public.handle_new_profile_row();

-- ---------------------------------------------------------------------------
-- 5. Follows & blocks
-- ---------------------------------------------------------------------------
create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self check (blocker_id <> blocked_id)
);

create index if not exists follows_following_idx on public.follows (following_id);
create index if not exists blocks_blocked_idx on public.user_blocks (blocked_id);

-- ---------------------------------------------------------------------------
-- 6. Matches (chat list) — ordered pair
-- ---------------------------------------------------------------------------
create table if not exists public.match_pairs (
  user_low uuid not null references public.profiles (id) on delete cascade,
  user_high uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_low, user_high),
  constraint match_pairs_ordered check (user_low < user_high)
);

create index if not exists match_pairs_user_low_idx on public.match_pairs (user_low);
create index if not exists match_pairs_user_high_idx on public.match_pairs (user_high);

-- ---------------------------------------------------------------------------
-- 7. Conversations + messages
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant_a uuid not null references public.profiles (id) on delete cascade,
  participant_b uuid not null references public.profiles (id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  constraint conversations_ordered check (participant_a < participant_b),
  constraint conversations_distinct check (participant_a <> participant_b),
  unique (participant_a, participant_b)
);

create or replace function public.normalize_conversation_participants()
returns trigger
language plpgsql
as $$
declare
  lo uuid;
  hi uuid;
begin
  lo := least(new.participant_a, new.participant_b);
  hi := greatest(new.participant_a, new.participant_b);
  new.participant_a := lo;
  new.participant_b := hi;
  return new;
end;
$$;

drop trigger if exists conversations_normalize on public.conversations;
create trigger conversations_normalize
  before insert or update on public.conversations
  for each row execute function public.normalize_conversation_participants();

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text,
  image_url text,
  video_url text,
  audio_url text,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);

create or replace function public.touch_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation_last_message();

-- ---------------------------------------------------------------------------
-- 8. In-app notifications
-- ---------------------------------------------------------------------------
create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('super_like', 'system')),
  read boolean not null default false,
  from_user_id uuid references public.profiles (id) on delete set null,
  from_name text,
  from_avatar text,
  system_kind text,
  system_message text,
  created_at timestamptz not null default now()
);

create index if not exists app_notifications_recipient_created_idx
  on public.app_notifications (recipient_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 9. User preferences (mirrors userPreferencesStore shape)
-- ---------------------------------------------------------------------------
create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  discovery jsonb not null default '{}'::jsonb,
  notifications jsonb not null default '{}'::jsonb,
  privacy jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 10. User-submitted Explore ads (moderation)
-- ---------------------------------------------------------------------------
create table if not exists public.user_ad_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  title text not null default '',
  subtitle text not null default '',
  badge_label text not null default 'Promo',
  image_url text not null default '',
  image_data_url text not null default '',
  background_color text not null default '',
  link_url text not null default '',
  display_duration_sec integer not null default 8 check (display_duration_sec >= 3 and display_duration_sec <= 120),
  duration_days integer not null,
  tokens_paid integer not null default 0 check (tokens_paid >= 0),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  carousel_ad_id uuid
);

create index if not exists user_ad_submissions_user_idx on public.user_ad_submissions (user_id);
create index if not exists user_ad_submissions_status_idx on public.user_ad_submissions (status);

-- ---------------------------------------------------------------------------
-- 11. Explore carousel slides (platform + approved user campaigns)
-- ---------------------------------------------------------------------------
create table if not exists public.explore_carousel_ads (
  id uuid primary key default gen_random_uuid(),
  enabled boolean not null default false,
  badge_label text not null default 'Promo',
  title text not null default '',
  subtitle text not null default '',
  image_url text not null default '',
  image_data_url text not null default '',
  background_color text not null default '',
  link_url text not null default '',
  display_duration_sec integer not null default 8 check (display_duration_sec >= 3 and display_duration_sec <= 120),
  source text not null default 'platform' check (source in ('platform', 'user')),
  user_submission_id uuid references public.user_ad_submissions (id) on delete set null,
  submitted_by_user_id uuid references public.profiles (id) on delete set null,
  campaign_duration_days integer,
  campaign_started_at timestamptz,
  campaign_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists explore_carousel_ads_enabled_idx
  on public.explore_carousel_ads (enabled, campaign_ends_at);

alter table public.user_ad_submissions
  drop constraint if exists user_ad_submissions_carousel_ad_id_fkey;
alter table public.user_ad_submissions
  add constraint user_ad_submissions_carousel_ad_id_fkey
  foreign key (carousel_ad_id) references public.explore_carousel_ads (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 12. Optional platform config JSON (admin / service role writes later)
-- ---------------------------------------------------------------------------
create table if not exists public.platform_settings (
  id smallint primary key default 1 check (id = 1),
  monetization jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id, monetization)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 13. Gift events (ledger for chat gifts)
-- ---------------------------------------------------------------------------
create table if not exists public.gift_events (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  gift_id text not null,
  gift_name text not null default '',
  token_value integer not null check (token_value >= 0),
  created_at timestamptz not null default now(),
  constraint gift_events_distinct check (sender_id <> recipient_id)
);

create index if not exists gift_events_sender_idx on public.gift_events (sender_id, created_at desc);
create index if not exists gift_events_recipient_idx on public.gift_events (recipient_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.user_account enable row level security;
alter table public.follows enable row level security;
alter table public.user_blocks enable row level security;
alter table public.match_pairs enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.app_notifications enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_ad_submissions enable row level security;
alter table public.explore_carousel_ads enable row level security;
alter table public.platform_settings enable row level security;
alter table public.gift_events enable row level security;

-- Profiles: discover needs read-all; writes stay own-row only
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- user_account
drop policy if exists "user_account_select_own" on public.user_account;
drop policy if exists "user_account_update_own" on public.user_account;
drop policy if exists "user_account_insert_own" on public.user_account;
create policy "user_account_select_own"
  on public.user_account for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_account_update_own"
  on public.user_account for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_account_insert_own"
  on public.user_account for insert
  to authenticated
  with check (auth.uid() = user_id);

-- follows
drop policy if exists "follows_select_involved" on public.follows;
drop policy if exists "follows_insert_self" on public.follows;
drop policy if exists "follows_delete_self" on public.follows;
create policy "follows_select_involved"
  on public.follows for select
  to authenticated
  using (auth.uid() = follower_id or auth.uid() = following_id);

create policy "follows_insert_self"
  on public.follows for insert
  to authenticated
  with check (auth.uid() = follower_id);

create policy "follows_delete_self"
  on public.follows for delete
  to authenticated
  using (auth.uid() = follower_id);

-- blocks
drop policy if exists "blocks_select_self" on public.user_blocks;
drop policy if exists "blocks_insert_self" on public.user_blocks;
drop policy if exists "blocks_delete_self" on public.user_blocks;
create policy "blocks_select_self"
  on public.user_blocks for select
  to authenticated
  using (auth.uid() = blocker_id);

create policy "blocks_insert_self"
  on public.user_blocks for insert
  to authenticated
  with check (auth.uid() = blocker_id);

create policy "blocks_delete_self"
  on public.user_blocks for delete
  to authenticated
  using (auth.uid() = blocker_id);

-- match_pairs
drop policy if exists "match_pairs_select_involved" on public.match_pairs;
drop policy if exists "match_pairs_insert_involved" on public.match_pairs;
drop policy if exists "match_pairs_delete_involved" on public.match_pairs;
create policy "match_pairs_select_involved"
  on public.match_pairs for select
  to authenticated
  using (auth.uid() = user_low or auth.uid() = user_high);

create policy "match_pairs_insert_involved"
  on public.match_pairs for insert
  to authenticated
  with check (auth.uid() = user_low or auth.uid() = user_high);

create policy "match_pairs_delete_involved"
  on public.match_pairs for delete
  to authenticated
  using (auth.uid() = user_low or auth.uid() = user_high);

-- conversations
drop policy if exists "conversations_select_participant" on public.conversations;
drop policy if exists "conversations_insert_participant" on public.conversations;
create policy "conversations_select_participant"
  on public.conversations for select
  to authenticated
  using (auth.uid() = participant_a or auth.uid() = participant_b);

create policy "conversations_insert_participant"
  on public.conversations for insert
  to authenticated
  with check (auth.uid() = participant_a or auth.uid() = participant_b);

-- messages
drop policy if exists "messages_select_participant" on public.messages;
drop policy if exists "messages_insert_participant" on public.messages;
create policy "messages_select_participant"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.participant_a = auth.uid() or c.participant_b = auth.uid())
    )
  );

create policy "messages_insert_participant"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.participant_a = auth.uid() or c.participant_b = auth.uid())
    )
  );

-- app_notifications
drop policy if exists "app_notifications_select_recipient" on public.app_notifications;
drop policy if exists "app_notifications_update_recipient" on public.app_notifications;
drop policy if exists "app_notifications_insert_super_like" on public.app_notifications;
create policy "app_notifications_select_recipient"
  on public.app_notifications for select
  to authenticated
  using (auth.uid() = recipient_id);

create policy "app_notifications_update_recipient"
  on public.app_notifications for update
  to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

create policy "app_notifications_insert_super_like"
  on public.app_notifications for insert
  to authenticated
  with check (
    type = 'super_like'
    and auth.uid() = from_user_id
    and recipient_id <> auth.uid()
  );

-- user_preferences
drop policy if exists "user_preferences_all_own" on public.user_preferences;
create policy "user_preferences_all_own"
  on public.user_preferences for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- user_ad_submissions
drop policy if exists "user_ad_submissions_select_own" on public.user_ad_submissions;
drop policy if exists "user_ad_submissions_insert_own" on public.user_ad_submissions;
create policy "user_ad_submissions_select_own"
  on public.user_ad_submissions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_ad_submissions_insert_own"
  on public.user_ad_submissions for insert
  to authenticated
  with check (auth.uid() = user_id);

-- explore carousel: readable live ads only
drop policy if exists "explore_carousel_ads_select_live" on public.explore_carousel_ads;
create policy "explore_carousel_ads_select_live"
  on public.explore_carousel_ads for select
  to authenticated
  using (
    enabled = true
    and (
      source = 'platform'
      or campaign_ends_at is null
      or campaign_ends_at > now()
    )
  );

-- platform_settings: read-only for clients (writes via service role / dashboard)
drop policy if exists "platform_settings_select_authenticated" on public.platform_settings;
create policy "platform_settings_select_authenticated"
  on public.platform_settings for select
  to authenticated
  using (true);

-- gift_events
drop policy if exists "gift_events_select_involved" on public.gift_events;
drop policy if exists "gift_events_insert_sender" on public.gift_events;
create policy "gift_events_select_involved"
  on public.gift_events for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "gift_events_insert_sender"
  on public.gift_events for insert
  to authenticated
  with check (auth.uid() = sender_id);

-- ---------------------------------------------------------------------------
-- Realtime (optional; enable for live chat)
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.conversations;
exception
  when duplicate_object then null;
end $$;
