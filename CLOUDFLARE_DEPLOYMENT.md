# Cloudflare deployment

This project is deployed as one Cloudflare Worker with static assets. Supabase remains the backend for authentication and data. Nitro generates the Cloudflare Worker configuration as part of the build.

## Build command

```powershell
$env:NITRO_PRESET = "cloudflare"
npm run build
```

## Deploy command

```powershell
npx wrangler deploy --config .output/server/wrangler.json
```

Cloudflare must have the same build-time public variables that are used locally:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_TURNSTILE_SITE_KEY` (once Turnstile is enabled)

Do not set the Supabase service-role key in Cloudflare or any browser-exposed `VITE_` variable.

After the first deployment, set the Worker URL (and later the custom domain) in Supabase Auth's Site URL and Redirect URLs.
