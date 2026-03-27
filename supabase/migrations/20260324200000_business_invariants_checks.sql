-- Business invariants: moderation/review fields, ad & cashout state machines,
-- carousel source consistency, wallet ledger signs, URL/text bounds.
-- Rollback: drop transition triggers/functions and the added *_ck constraints from this migration, then reintroduce previous constraints/policies that match your older state model.

-- ---------------------------------------------------------------------------
-- 1) Ad submissions: moderation fields + sensible bounds
-- ---------------------------------------------------------------------------
alter table public.user_ad_submissions
  drop constraint if exists user_ad_submissions_moderation_ck;

alter table public.user_ad_submissions
  add constraint user_ad_submissions_moderation_ck check (
    (status = 'pending' and reviewed_at is null and carousel_ad_id is null)
    or (
      status = 'approved'
      and reviewed_at is not null
      and carousel_ad_id is not null
    )
    or (
      status = 'rejected'
      and reviewed_at is not null
      and carousel_ad_id is null
    )
  );

alter table public.user_ad_submissions
  drop constraint if exists user_ad_submissions_duration_days_ck;

alter table public.user_ad_submissions
  add constraint user_ad_submissions_duration_days_ck check (
    duration_days >= 1
    and duration_days <= 3660
  );

alter table public.user_ad_submissions
  drop constraint if exists user_ad_submissions_text_url_ck;

alter table public.user_ad_submissions
  add constraint user_ad_submissions_text_url_ck check (
    char_length(title) <= 500
    and char_length(subtitle) <= 500
    and char_length(badge_label) <= 120
    and char_length(image_url) <= 2048
    and char_length(image_data_url) <= 2097152
    and char_length(background_color) <= 128
    and char_length(link_url) <= 2048
    and (
      link_url = ''
      or link_url ~* '^https?://'
      or left(link_url, 1) = '/'
    )
    and (
      image_url = ''
      or image_url ~* '^https?://'
      or left(image_url, 2) = '//'
      or left(image_url, 1) = '/'
      or left(image_url, 5) = 'data:'
    )
  );

create or replace function public.enforce_user_ad_submission_status_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'update' and old.status is distinct from new.status then
    if old.status <> 'pending' then
      raise exception 'user_ad_submissions: status is immutable after %', old.status
        using errcode = 'check_violation';
    end if;
    if new.status not in ('approved', 'rejected') then
      raise exception 'user_ad_submissions: invalid transition pending -> %', new.status
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists user_ad_submissions_status_transition_trg on public.user_ad_submissions;
create trigger user_ad_submissions_status_transition_trg
  before update on public.user_ad_submissions
  for each row execute function public.enforce_user_ad_submission_status_transition();

-- ---------------------------------------------------------------------------
-- 2) Explore carousel: source/user linkage + enabled user campaigns
-- ---------------------------------------------------------------------------
alter table public.explore_carousel_ads
  drop constraint if exists explore_carousel_ads_source_links_ck;

alter table public.explore_carousel_ads
  add constraint explore_carousel_ads_source_links_ck check (
    (
      source = 'platform'
      and user_submission_id is null
      and submitted_by_user_id is null
    )
    or (
      source = 'user'
      and user_submission_id is not null
      and submitted_by_user_id is not null
    )
  );

alter table public.explore_carousel_ads
  drop constraint if exists explore_carousel_ads_user_campaign_window_ck;

alter table public.explore_carousel_ads
  add constraint explore_carousel_ads_user_campaign_window_ck check (
    not (enabled and source = 'user')
    or (
      campaign_started_at is not null
      and campaign_ends_at is not null
      and campaign_ends_at > campaign_started_at
      and campaign_duration_days is not null
      and campaign_duration_days >= 1
      and campaign_duration_days <= 3660
    )
  );

alter table public.explore_carousel_ads
  drop constraint if exists explore_carousel_ads_text_url_ck;

alter table public.explore_carousel_ads
  add constraint explore_carousel_ads_text_url_ck check (
    char_length(title) <= 500
    and char_length(subtitle) <= 500
    and char_length(badge_label) <= 120
    and char_length(image_url) <= 2048
    and char_length(image_data_url) <= 2097152
    and char_length(background_color) <= 128
    and char_length(link_url) <= 2048
    and (
      link_url = ''
      or link_url ~* '^https?://'
      or left(link_url, 1) = '/'
    )
    and (
      image_url = ''
      or image_url ~* '^https?://'
      or left(image_url, 2) = '//'
      or left(image_url, 1) = '/'
      or left(image_url, 5) = 'data:'
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Cashout queue: review metadata vs status + transitions
-- ---------------------------------------------------------------------------
alter table public.cashout_requests
  drop constraint if exists cashout_requests_review_fields_ck;

alter table public.cashout_requests
  add constraint cashout_requests_review_fields_ck check (
    (
      status = 'pending'
      and reviewed_at is null
      and reviewed_by is null
    )
    or (
      status in ('approved', 'rejected', 'paid')
      and reviewed_at is not null
      and reviewed_by is not null
    )
  );

alter table public.cashout_requests
  drop constraint if exists cashout_requests_notes_len_ck;

alter table public.cashout_requests
  add constraint cashout_requests_notes_len_ck check (
    notes is null
    or char_length(notes) <= 2000
  );

create or replace function public.enforce_cashout_request_status_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'update' and old.status is distinct from new.status then
    if old.status = 'pending' then
      if new.status not in ('approved', 'rejected', 'paid') then
        raise exception 'cashout_requests: invalid transition pending -> %', new.status
          using errcode = 'check_violation';
      end if;
    elsif old.status = 'approved' then
      if new.status <> 'paid' then
        raise exception 'cashout_requests: invalid transition approved -> %', new.status
          using errcode = 'check_violation';
      end if;
    else
      raise exception 'cashout_requests: status % is terminal', old.status
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists cashout_requests_status_transition_trg on public.cashout_requests;
create trigger cashout_requests_status_transition_trg
  before update on public.cashout_requests
  for each row execute function public.enforce_cashout_request_status_transition();

-- ---------------------------------------------------------------------------
-- 4) Wallet ledger: amount sign by kind + bounded reference_id
-- ---------------------------------------------------------------------------
alter table public.wallet_ledger
  drop constraint if exists wallet_ledger_amount_sign_ck;

alter table public.wallet_ledger
  add constraint wallet_ledger_amount_sign_ck check (
    (
      kind in ('purchase_credit', 'gift_credit')
      and amount > 0
    )
    or (
      kind in ('gift_debit', 'cashout_debit')
      and amount < 0
    )
    or (kind = 'admin_adjust' and amount <> 0)
  );

alter table public.wallet_ledger
  drop constraint if exists wallet_ledger_reference_id_len_ck;

alter table public.wallet_ledger
  add constraint wallet_ledger_reference_id_len_ck check (
    reference_id is null
    or char_length(reference_id) <= 512
  );

-- ---------------------------------------------------------------------------
-- 5) RLS: clients cannot inject “pre-reviewed” or non-pending cashouts
-- ---------------------------------------------------------------------------
drop policy if exists "user_ad_submissions_insert_own" on public.user_ad_submissions;
create policy "user_ad_submissions_insert_own"
  on public.user_ad_submissions for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and status = 'pending'
    and reviewed_at is null
    and carousel_ad_id is null
  );

drop policy if exists "cashout_insert_own" on public.cashout_requests;
create policy "cashout_insert_own"
  on public.cashout_requests for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and status = 'pending'
    and reviewed_at is null
    and reviewed_by is null
  );
