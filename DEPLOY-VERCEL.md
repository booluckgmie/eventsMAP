# Vercel Deployment Guide

## Database: Supabase (via `@supabase/supabase-js`, not a raw connection string)

A dedicated Supabase project **`mmid2027-events`** (ref `gksynnchspxxlqiiimuo`, region `ap-southeast-1`) has already been created, with the `registrations` and `attendees` tables migrated and Row Level Security enabled.

The app talks to Supabase over its REST API (PostgREST) via the `@supabase/supabase-js` client — **not** a Postgres connection string. This avoids Vercel/pooler/IPv6 connectivity issues entirely. You need two values, both from [supabase.com/dashboard/project/gksynnchspxxlqiiimuo/settings/api-keys](https://supabase.com/dashboard/project/gksynnchspxxlqiiimuo/settings/api-keys):

1. **Project URL** → `SUPABASE_URL` (e.g. `https://gksynnchspxxlqiiimuo.supabase.co`)
2. **`secret` key** (starts with `sb_secret_...`) → `SUPABASE_SECRET_KEY` — this is the service-role-equivalent key that bypasses RLS; never expose it client-side, it only belongs in Vercel's server-side env vars.

## Vercel Project Setup

1. Go to [vercel.com/new](https://vercel.com/new) and import this GitHub repo (`booluckgmie/eventsMAP`), branch `main`.
2. Vercel should auto-detect the `vercel.json` config — no build command needed (it's a Node.js API function, not a static/framework build).
3. Under **Settings → Environment Variables**, add all of the following:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://gksynnchspxxlqiiimuo.supabase.co` |
| `SUPABASE_SECRET_KEY` | The `sb_secret_...` key from the dashboard link above |
| `BILLPLZ_API_KEY` | Your Billplz secret key |
| `BILLPLZ_COLLECTION_ID` | `msvtrfvz` |
| `BILLPLZ_X_SIGNATURE_KEY` | Your Billplz X-Signature key |
| `BILLPLZ_SANDBOX` | `false` for live payments |
| `GMAIL_USER` | Gmail address for sending emails |
| `GMAIL_APP_PASSWORD` | Gmail App Password (not your login password) |
| `EMAIL_FROM_NAME` | e.g. `MAP Events` |
| `EMAIL_REPLY_TO` | Reply-to address |
| `ADMIN_SECRET_KEY` | A long random string — this is your `/admin` dashboard password |
| `FRONTEND_URL` | Your final production URL, e.g. `https://events.maprostho.com.my` (used to build Billplz callback/redirect URLs) |
| `EVENT_CAPACITY` | `100` (or your actual seat cap) |
| Event/fee overrides | Optional — see `server/event-config.js` for the full list of `EVENT_*` / `FEE_*` vars; defaults are already set for MMID 2027 |

**None of these should ever be committed to the repo** — they only live in Vercel's encrypted environment variable store.

After adding/changing environment variables, trigger a redeploy (Vercel does **not** apply new env vars to an already-built deployment) — either push a new commit or use **Deployments → ⋯ → Redeploy** on the latest one.

## Seeding / checking data against Supabase

Set the same two env vars locally, then:

```bash
SUPABASE_URL="https://gksynnchspxxlqiiimuo.supabase.co" SUPABASE_SECRET_KEY="sb_secret_..." npm run db:seed    # demo rows (remove before going live)
SUPABASE_URL="https://gksynnchspxxlqiiimuo.supabase.co" SUPABASE_SECRET_KEY="sb_secret_..." npm run db:status  # check row counts
```

Table creation itself is managed through Supabase migrations (already applied), not this script.

## Pointing your domain

After the Vercel deployment is live and verified (test a registration end-to-end, check `/admin` and `/checkin`), point `events.maprostho.com.my` at Vercel:
1. In Vercel, go to **Settings → Domains** and add `events.maprostho.com.my`.
2. Vercel will show you a CNAME (or A record) to add in cPanel's **Zone Editor** for that subdomain.
3. Once DNS propagates, Vercel auto-issues an SSL certificate.

## Billplz webhook

Update your Billplz collection's callback URL (if not already using `FRONTEND_URL` dynamically) to `https://events.maprostho.com.my/api/billplz/webhook` once the domain is pointed.
