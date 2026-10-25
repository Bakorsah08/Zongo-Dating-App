# Manual setup checklist

Everything in this file has to be done by hand in a dashboard or your own environment.
The code, migrations and Edge Functions for it are already in the repo and deployed.

Supabase project: **Zongo Dating App** (`afvjxgvokqjagunljvgi`, eu-west-1)
Functions base URL: `https://afvjxgvokqjagunljvgi.supabase.co/functions/v1`

Last checked: 2026-10-25

---

## Where things stand

| Area | Deployed | Still needs you |
|---|---|---|
| Database migrations | All 21 applied | Sync migration history (section 7) |
| `delete-account`, `admin-review-reports` | v1 | Store and policy steps (section 10) |
| `monitoring-ingest` | v4 | Nothing |
| `create-stripe-checkout`, `stripe-webhook` | v1 | Stripe secrets, webhook, price ids |
| `revenuecat-webhook` | v1 | Product ids, RevenueCat webhook |
| `create-paystack-checkout`, `paystack-webhook` | v1 | Paystack secret, webhook, prices |
| Web Token Shop | In code | `VITE_PAYMENT_WEB_METHODS` + rebuild |
| Hosting, store accounts, legal pages | Not started | Section 9 |

Until its secrets are set, each payment function answers `503 ..._not_configured` and credits nothing.

---

## 1. Supabase Edge Function secrets

Dashboard → **Edge Functions → Secrets** (or `npx supabase secrets set NAME=value`).

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically. Don't add them.

| Secret | Used by | Value | Status |
|---|---|---|---|
| `CHECKOUT_APP_BASE_URL` | Stripe + Paystack checkout | Public app origin, no trailing slash, e.g. `https://zongo.app`. Buyers return to `/?checkout=success` or `/?checkout=cancel`. | ☐ |
| `STRIPE_SECRET_KEY` | `create-stripe-checkout`, `stripe-webhook` | `sk_test_…` first, then `sk_live_…` | ☐ |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` | `whsec_…`, shown after creating the endpoint in section 2 | ☐ |
| `PAYSTACK_SECRET_KEY` | `create-paystack-checkout`, `paystack-webhook` | `sk_test_…` first, then `sk_live_…`. Also used to verify webhook signatures. | ☐ |
| `REVENUECAT_WEBHOOK_AUTHORIZATION` | `revenuecat-webhook` | Shared secret you also enter in RevenueCat | ✅ Already set |
| `PAYMENT_WEBHOOK_SECRET` | `payments-webhook` (custom HMAC rail) | Only if you use a custom aggregator | Optional |
| `MONITORING_INGEST_KEY` | `monitoring-ingest` | Must match `VITE_MONITORING_INGEST_KEY` | Optional |

Optional fallbacks, only used when a package isn't in the database:
- `STRIPE_CHECKOUT_PRICE_MAP`, e.g. `{"p1":{"priceId":"price_xxx","tokens":100}}`
- `REVENUECAT_PRODUCT_TOKEN_MAP`, e.g. `{"zongo_tokens_100":100}`

---

## 2. Stripe (web card payments)

1. ☐ **Products → Add product** for each token package, as a one-time price. Copy each `price_…` id.
2. ☐ **Developers → Webhooks → Add endpoint**
   - URL: `https://afvjxgvokqjagunljvgi.supabase.co/functions/v1/stripe-webhook`
   - Event: `checkout.session.completed`
   - Copy the signing secret into `STRIPE_WEBHOOK_SECRET` (section 1).
3. ☐ Add `STRIPE_SECRET_KEY` (section 1).
4. ☐ Enter each Price id in **Admin → Token Packages** (section 5).

---

## 3. Paystack (web card + mobile money)

Mobile money (MTN MoMo, Telecel Cash, AirtelTigo Money, M-Pesa) runs through Paystack's hosted checkout. It needs GHS or KES.

1. ☐ In **Settings → Preferences**, make sure the **Mobile Money** and **Card** channels are enabled on your Paystack business.
2. ☐ In **Settings → API Keys & Webhooks**:
   - Copy the secret key into `PAYSTACK_SECRET_KEY` (section 1).
   - Set the **Webhook URL** to `https://afvjxgvokqjagunljvgi.supabase.co/functions/v1/paystack-webhook`.
   - Do this separately for **Test** and **Live** mode; each has its own key and webhook URL.
3. ☐ Set a Paystack price for each package in **Admin → Token Packages** (section 5). Packages without one show as unavailable for Paystack.
4. ☐ Turn it on in the frontend (section 6).
5. ☐ Test in test mode, using Paystack's test cards and test mobile money number from their docs, before switching to live keys.

**Web only.** The App Store and Google Play require their own billing for in-app tokens, so the mobile apps keep using RevenueCat. Don't enable Paystack inside the native apps.

---

## 4. RevenueCat (iOS / Android in-app purchases)

1. ☐ Create consumable products in **App Store Connect** and **Google Play Console**, using the same SKU on both, e.g. `zongo_tokens_100`.
2. ☐ In **RevenueCat**, add the products, create a default offering, and set up the webhook:
   - URL: `https://afvjxgvokqjagunljvgi.supabase.co/functions/v1/revenuecat-webhook`
   - Authorization header: the same value as `REVENUECAT_WEBHOOK_AUTHORIZATION`
3. ☐ Copy the public SDK keys into the frontend environment (section 6): `VITE_REVENUECAT_IOS_API_KEY` and `VITE_REVENUECAT_GOOGLE_API_KEY`.
4. ☐ Enter each SKU as the **Store product id** in **Admin → Token Packages** (section 5).
5. ☐ If Stripe is also connected inside RevenueCat for the same purchases, turn off one path so a payment isn't credited twice.

---

## 5. Token packages (Admin → Token Packages)

The seed packages p1–p3 exist, but none has payment ids yet, so every checkout path currently refuses them.

| Package | Tokens | Display price | Stripe Price id | Paystack price | Store product id |
|---|---|---|---|---|---|
| p1 | 100 | $4.99 | ☐ `price_…` | ☐ GHS … | ☐ `zongo_tokens_100` |
| p2 | 500 | $19.99 | ☐ `price_…` | ☐ GHS … | ☐ `zongo_tokens_500` |
| p3 | 1000 | $34.99 | ☐ `price_…` | ☐ GHS … | ☐ `zongo_tokens_1000` |

Enter Paystack prices in normal units (e.g. `75.00`); they're stored in pesewas.

---

## 6. Frontend environment (`.env.local` and your hosting provider)

Set these wherever the production build runs, then rebuild and redeploy the web app. `VITE_*` values are public, so never put secret keys here.

| Variable | Value | Status |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Already in `.env.local`; add them to production hosting too | ☐ Production |
| `VITE_APP_URL` | Production origin | ☐ |
| `VITE_PAYMENT_WEB_METHODS` | `paystack_mobile_money,paystack_card,stripe_card`. The order sets the Token Shop picker order. Without this, the shop only offers Stripe. | ☐ |
| `VITE_REVENUECAT_IOS_API_KEY`, `VITE_REVENUECAT_GOOGLE_API_KEY` | RevenueCat public SDK keys | ☐ |
| `VITE_MONITORING_ENDPOINT` | `https://afvjxgvokqjagunljvgi.supabase.co/functions/v1/monitoring-ingest` | Optional |

After a web build you ship to the stores, run `npm run cap:sync`.

---

## 7. Supabase housekeeping

1. ☐ **Sync migration history before using `supabase db push`.** Migrations applied through the dashboard and MCP were recorded under 2026-10-24 timestamps, not the dates in their filenames. Two migrations from 2026-10-24 also exist only in the database: `lock_down_security_definer_rpcs` and `revoke_public_execute_on_trigger_functions`. Run `npx supabase db pull` (or `supabase migration repair`) so the CLI doesn't try to re-apply anything.
2. ☐ **Security advisor** (Dashboard → Advisors) findings worth fixing:
   - Turn on **leaked password protection** (Authentication → Policies).
   - Set `search_path` on trigger functions, including the new `set_token_packages_updated_at`.
   - Review the tables exposed in the GraphQL schema to `anon` / `authenticated`, and revoke `SELECT` on internal ones such as `audit_logs`, `monitoring_events` and `payment_webhook_events`.

---

## 8. Local repo

1. ☐ Approve esbuild's install script, which Vite needs: `npm install-scripts approve esbuild`
2. ☐ Commit the work. The dependency upgrades, typecheck fixes, monitoring domains, and Paystack code and migrations are all uncommitted.

---

## 9. Launch accounts and listings

Allow lead time: Apple developer enrollment and the first App Store review of a dating app can each take a week or more.

1. ☐ **Domain and web hosting** for the production web app (e.g. Vercel, Netlify or Cloudflare Pages). Set the build to `npm run build` with output `dist`, add the env vars from section 6, and point `CHECKOUT_APP_BASE_URL` and `VITE_APP_URL` at the domain.
2. ☐ **Supabase Auth URLs:** under Authentication → URL Configuration, set the Site URL and redirect URLs to the production domain, and use a custom SMTP sender for confirmation emails (the built-in sender is heavily rate-limited).
3. ☐ **Apple Developer Program** ($99/yr) and **Google Play Console** ($25 one-time) accounts.
4. ☐ **Privacy Policy and Terms of Service** hosted at public URLs. Both stores require them for dating apps, and Paystack and Stripe ask for them during business verification.
5. ☐ **Store listings:** screenshots, an 18+ / mature content rating questionnaire, the data-safety form (Play) and privacy nutrition labels (Apple), and a demo login for the reviewers.
6. ☐ **Paystack and Stripe business verification (KYC)** so live keys are enabled before launch.

---

## 10. Safety features (report, account deletion, 18+ gate)

The code is in the repo. These steps make it live and keep it compliant with store rules.

1. ✅ **Migration applied** (`20260406090000_safety_age_gate_reports`). The age rules and row-level security were tested on 2026-10-25 in rolled-back transactions.
2. ✅ **Functions deployed:** `delete-account` and `admin-review-reports` (v1, JWT verification on, no new secrets).
3. ☐ **Account deletion web page (Google Play).** Play also requires a public web link where people can request deletion without reinstalling the app. Add it to the Play Console data-safety form; a page on your site that explains the in-app steps and offers a support email is enough.
4. ☐ **Privacy Policy:** describe what account deletion removes, that birthdates are collected for age verification, and how reports are handled.
5. ☐ **Moderation routine:** assign someone (super_admin, support or moderator) to check **Admin → Reports** daily. Apple expects reports to be acted on within 24 hours.
6. ☐ **Support email:** the Help sheet links to `support@zongo.app`. Make sure that mailbox exists, or change the address in `components/ProfileSettingsSheets.tsx`.
7. ☐ **Existing members** will see the birthday screen on their next sign-in. Nothing else to do; the 19 anonymous test users are included.

---

## Quick test once everything is set

1. Open the web app, sign in with an account that has an email address, and go to the **Token Shop**.
2. Pick **Mobile Money** and buy p1 with Paystack test credentials.
3. You should return to `/?checkout=success`, and the balance should go up within about a minute.
4. If it doesn't, check Dashboard → Edge Functions → `paystack-webhook` → **Logs**, and the `payment_webhook_events` table.
