# All Rounder POS SaaS

Multi-tenant Point of Sale application for subscription-based shop accounts.

## Included capabilities

- Product catalogue, barcode/camera scanning, cart, stock control, and sales reports
- Server-validated checkout: sale, line items, stock movement, payment, and audit record are committed together
- Cash, KBZPay, Wave Pay, card, credit, and other payment labels; cash change calculation
- Printable receipts, full-sale refunds, stock movement history, and JSON data backup
- Shop application, super-admin approval/suspension/renewal, subscription expiry enforcement
- Owner/staff permissions and invitation-based staff onboarding

## Local development

Install dependencies and create `.env` from `.env.example` with your Supabase project URL and anon key.

```bash
npm install
npm run dev
```

Use `npm run build` to create a production build.

## Required Supabase setup

This project is a SaaS app and requires Supabase in production. Do **not** use the old local-only README instructions or the static `1234` login pattern.

1. Back up the database before changing a live project.
2. For an existing project, run [supabase_production_migration.sql](./supabase_production_migration.sql) once in the Supabase SQL Editor.
3. For a fresh project, create the base tables first, then run the production migration immediately. Never run the destructive `truncate` lines in [supabase_saas_schema.sql](./supabase_saas_schema.sql) on a live database.
4. Create the first administrator in the SQL Editor, replacing the email with your own:

   ```sql
   update public.profiles
   set role = 'super_admin'
   where email = 'you@example.com';
   ```

5. In Supabase Auth, enable email confirmation and password reset, and set the production website as an allowed redirect URL.
6. Before enabling public shop applications, create a Cloudflare Turnstile site for your POS domain. Set the public site key in your deployed app as `VITE_TURNSTILE_SITE_KEY`, and configure the corresponding Turnstile secret in **Supabase Auth → CAPTCHA protection**. Then deploy the staff invitation function:

   ```bash
   supabase functions deploy invite-staff
   ```

   The public application uses Supabase Auth's CAPTCHA check. Only the protected database sign-up trigger can create its pending tenant, so browser clients never get direct tenant-creation access.

The SQL migration removes prototype public read/write policies. It prevents browser clients from changing user roles or tenant IDs, enforces subscription expiry in database policies, and makes checkout/refunds atomic.
Staff receive only shop-facing settings through a narrow database function; the owner terminal PIN hash remains owner-only.

## Subscription operations

For the first paid pilot, manual payment verification is sufficient:

1. Receive the monthly payment through your chosen business payment channel.
2. In `/admin`, approve the shop or extend its subscription.
3. Expired subscriptions are blocked both in the UI and database rules.

Add a payment gateway only after this pilot flow is reliable.

## Production checklist

- Configure a custom domain, HTTPS, Supabase backups, error monitoring, and a support contact.
- Take/download shop backups regularly and test restoring them in a staging project.
- Keep the service role key only in Supabase Edge Function secrets—never in `.env` values exposed to the browser.
- Rotate any password or service credential that was ever committed to Git. Removing it from the current source does not remove it from earlier Git history.
- Publish terms of service, privacy policy, subscription/refund policy, and support hours before public launch.
- Test checkout, refund, staff invitation, expiry blocking, and receipt printing with 3–5 pilot shops before a broad launch.
