-- Idempotency store for external payment webhooks.
-- Ensures each provider event is processed once.
-- Rollback: drop policy payment_webhook_events_no_client_access, disable RLS on table if desired, then drop table public.payment_webhook_events.

create table if not exists public.payment_webhook_events (
  provider_event_id text primary key,
  payment_ref text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  token_amount integer not null check (token_amount > 0),
  processed_at timestamptz not null default now()
);

create index if not exists payment_webhook_events_payment_ref_idx
  on public.payment_webhook_events (payment_ref);

alter table public.payment_webhook_events enable row level security;

drop policy if exists "payment_webhook_events_no_client_access" on public.payment_webhook_events;
create policy "payment_webhook_events_no_client_access"
  on public.payment_webhook_events for all
  to authenticated
  using (false)
  with check (false);
