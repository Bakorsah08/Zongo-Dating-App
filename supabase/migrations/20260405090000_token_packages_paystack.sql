-- Paystack pricing per token package (web card + mobile money checkout).
-- Paystack charges in the merchant's local currency, so each package carries its own
-- amount in the smallest currency unit (pesewas for GHS, kobo for NGN, cents for KES).
-- Rollback: alter table public.token_packages drop column if exists paystack_amount_minor, drop column if exists paystack_currency.

alter table public.token_packages
  add column if not exists paystack_amount_minor integer
    check (paystack_amount_minor is null or paystack_amount_minor > 0),
  add column if not exists paystack_currency text not null default 'GHS'
    check (paystack_currency ~ '^[A-Z]{3}$');

comment on column public.token_packages.paystack_amount_minor is 'Paystack charge in minor units (e.g. 7500 = GHS 75.00). Null = not sold via Paystack.';
comment on column public.token_packages.paystack_currency is 'ISO currency Paystack charges in. Mobile money needs GHS or KES.';
