-- Token packages catalog (source of truth for purchasable token bundles).
-- Used by:
-- - Web Stripe checkout (package id -> stripe price id + tokens)
-- - RevenueCat webhook (store product_id -> tokens)
-- - App UI (list packages)
--
-- Rollback: drop table public.token_packages and its policies.

create table if not exists public.token_packages (
  id text primary key,
  tokens integer not null check (tokens > 0),
  display_price text not null default '',
  currency text not null default 'USD',
  -- Stripe Checkout uses Price IDs
  stripe_price_id text,
  -- RevenueCat events provide `product_id` (store product identifier / SKU)
  revenuecat_product_id text unique,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.token_packages is 'Token top-up packages (catalog). Admin is source of truth.';
comment on column public.token_packages.id is 'App package id (stable). Used as package_id in checkout.';
comment on column public.token_packages.revenuecat_product_id is 'Store product identifier used by RevenueCat product_id.';

-- updated_at trigger
create or replace function public.set_token_packages_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists token_packages_set_updated_at on public.token_packages;
create trigger token_packages_set_updated_at
  before update on public.token_packages
  for each row execute procedure public.set_token_packages_updated_at();

alter table public.token_packages enable row level security;

-- Everyone signed-in can read the active catalog.
drop policy if exists "token_packages_select_authenticated" on public.token_packages;
create policy "token_packages_select_authenticated"
  on public.token_packages for select
  to authenticated
  using (true);

-- Only admins can write (insert/update/delete).
drop policy if exists "token_packages_admin_insert" on public.token_packages;
create policy "token_packages_admin_insert"
  on public.token_packages for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

drop policy if exists "token_packages_admin_update" on public.token_packages;
create policy "token_packages_admin_update"
  on public.token_packages for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "token_packages_admin_delete" on public.token_packages;
create policy "token_packages_admin_delete"
  on public.token_packages for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- Seed defaults matching constants.tsx (safe if already inserted).
insert into public.token_packages (id, tokens, display_price, currency, sort_order, active)
values
  ('p1', 100, '$4.99', 'USD', 10, true),
  ('p2', 500, '$19.99', 'USD', 20, true),
  ('p3', 1000, '$34.99', 'USD', 30, true)
on conflict (id) do update set
  tokens = excluded.tokens,
  display_price = excluded.display_price,
  currency = excluded.currency,
  sort_order = excluded.sort_order;

