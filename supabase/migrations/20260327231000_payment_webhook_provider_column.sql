-- Track which payment path credited the wallet (stripe, revenuecat, custom_hmac, future aggregators).
-- Rollback: alter table public.payment_webhook_events drop column if exists provider;

alter table public.payment_webhook_events
  add column if not exists provider text;

create index if not exists payment_webhook_events_provider_idx
  on public.payment_webhook_events (provider);

comment on column public.payment_webhook_events.provider is 'Aggregator or rail: stripe_checkout, revenuecat, custom_hmac, paystack, etc.';
