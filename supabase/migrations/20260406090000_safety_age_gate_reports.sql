-- App store safety requirements: 18+ age confirmation and user reports for moderation.
-- Birthdates live in their own table because public.profiles is readable by every signed-in user;
-- only the derived age is copied onto the profile.
-- Rollback: drop table public.user_reports; drop table public.user_age_verifications (cascades its triggers);
--   drop trigger profiles_sync_age_from_birthdate on public.profiles; drop function public.sync_profile_age_from_birthdate(),
--   public.enforce_adult_birthdate(), public.apply_verified_age(); alter table public.profiles drop constraint profiles_age_adult.

-- ---------------------------------------------------------------------------
-- 1. Age verification (one row per user, write-once from the client)
-- ---------------------------------------------------------------------------
create table if not exists public.user_age_verifications (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  birthdate date not null,
  verified_at timestamptz not null default now()
);

comment on table public.user_age_verifications is 'Self-declared birthdate from the 18+ age gate. Private to the owner; not editable once set.';

create or replace function public.enforce_adult_birthdate()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.birthdate > (current_date - interval '18 years')::date then
    raise exception 'must_be_18' using errcode = 'P0001';
  end if;
  if new.birthdate < (current_date - interval '120 years')::date then
    raise exception 'invalid_birthdate' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists user_age_verifications_enforce_adult on public.user_age_verifications;
create trigger user_age_verifications_enforce_adult
  before insert or update on public.user_age_verifications
  for each row execute procedure public.enforce_adult_birthdate();

-- Copy the derived age onto the public profile once verified.
create or replace function public.apply_verified_age()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set age = extract(year from age(current_date, new.birthdate))::int
   where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists user_age_verifications_apply_age on public.user_age_verifications;
create trigger user_age_verifications_apply_age
  after insert or update on public.user_age_verifications
  for each row execute procedure public.apply_verified_age();

alter table public.user_age_verifications enable row level security;

drop policy if exists "user_age_verifications_select_own" on public.user_age_verifications;
create policy "user_age_verifications_select_own"
  on public.user_age_verifications for select
  to authenticated
  using (user_id = auth.uid());

-- Insert only; no update or delete policy, so a confirmed birthdate can't be changed from the client.
drop policy if exists "user_age_verifications_insert_own" on public.user_age_verifications;
create policy "user_age_verifications_insert_own"
  on public.user_age_verifications for insert
  to authenticated
  with check (user_id = auth.uid());

revoke all on public.user_age_verifications from anon;

-- Keep profiles.age consistent with the verified birthdate, whatever the client sends.
create or replace function public.sync_profile_age_from_birthdate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dob date;
begin
  select birthdate into dob from public.user_age_verifications where user_id = new.id;
  if dob is not null then
    new.age := extract(year from age(current_date, dob))::int;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_sync_age_from_birthdate on public.profiles;
create trigger profiles_sync_age_from_birthdate
  before update of age on public.profiles
  for each row execute procedure public.sync_profile_age_from_birthdate();

alter table public.profiles
  drop constraint if exists profiles_age_adult;
alter table public.profiles
  add constraint profiles_age_adult check (age >= 18);

-- ---------------------------------------------------------------------------
-- 2. User reports (moderation queue)
-- ---------------------------------------------------------------------------
create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (
    reason in ('fake_profile', 'harassment', 'inappropriate_content', 'scam', 'underage', 'hate_speech', 'other')
  ),
  details text not null default '' check (char_length(details) <= 1000),
  context text not null default 'profile' check (context in ('profile', 'chat', 'live')),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  resolution_note text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint user_reports_no_self check (reporter_id is null or reporter_id <> reported_id)
);

comment on table public.user_reports is 'User-submitted reports. Reviewed by admins through the admin-review-reports function.';

create index if not exists user_reports_status_created_idx
  on public.user_reports (status, created_at desc);
create index if not exists user_reports_reported_idx
  on public.user_reports (reported_id);

-- One open report per reporter and target; re-reporting while open is a no-op.
create unique index if not exists user_reports_one_open_per_pair
  on public.user_reports (reporter_id, reported_id)
  where status = 'open';

alter table public.user_reports enable row level security;

drop policy if exists "user_reports_insert_own" on public.user_reports;
create policy "user_reports_insert_own"
  on public.user_reports for insert
  to authenticated
  with check (
    reporter_id = auth.uid()
    and status = 'open'
    and reviewed_by is null
    and reviewed_at is null
    and resolution_note is null
  );

drop policy if exists "user_reports_select_own" on public.user_reports;
create policy "user_reports_select_own"
  on public.user_reports for select
  to authenticated
  using (reporter_id = auth.uid());

revoke all on public.user_reports from anon;

revoke execute on function public.enforce_adult_birthdate() from public, anon, authenticated;
revoke execute on function public.apply_verified_age() from public, anon, authenticated;
revoke execute on function public.sync_profile_age_from_birthdate() from public, anon, authenticated;
