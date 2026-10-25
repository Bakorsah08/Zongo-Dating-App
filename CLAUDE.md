# Project rules

## Keep MANUAL_SETUP.md current

[MANUAL_SETUP.md](MANUAL_SETUP.md) is the single checklist of everything the owner must do by hand: dashboard steps, secrets, webhooks, env vars, store and provider config, and pending deploys.

Whenever a change creates, changes or removes a manual step, update MANUAL_SETUP.md in the same turn, before wrapping up. That includes:

- a new or renamed Edge Function secret (`Deno.env.get(...)`) or `VITE_*` variable
- a new Edge Function, webhook endpoint, or `verify_jwt` change
- a new third-party provider, or a new dashboard or store setting it needs (Stripe, Paystack, RevenueCat, App Store / Play, Supabase Auth)
- new data that an admin must enter (e.g. token package price or product ids)
- a migration or function written but not yet applied or deployed
- a security advisor finding or housekeeping step left for the owner

How to update it:

- Put each item in the section for its area, or add a numbered section. Keep the ☐ checkbox style.
- Update the "Where things stand" table and the "Last checked" date.
- Mark items ✅ when you've verified them done (e.g. a deploy, or a secret the function now accepts). Remove items that no longer apply.
- Never write secret values. Name the secret and say where its value comes from.
- In your closing message, tell the owner which items you added or changed.
