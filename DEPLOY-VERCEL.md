# Vercel Deployment Guide

## Database: Supabase (Postgres)

A dedicated Supabase project **`mmid2027-events`** (ref `gksynnchspxxlqiiimuo`, region `ap-southeast-1`) has already been created, with the `registrations` and `attendees` tables migrated and Row Level Security enabled.

**You need to get the database connection string yourself** — Supabase never exposes the database password through its API after project creation, only through the dashboard:

1. Go to [supabase.com/dashboard/project/gksynnchspxxlqiiimuo/settings/database](https://supabase.com/dashboard/project/gksynnchspxxlqiiimuo/settings/database)
2. Under **Connection string**, copy the **URI** format (starts with `postgresql://postgres...`). Use the **Transaction pooler** connection (port 6543) if available — it's built for serverless/short-lived connections like Vercel functions; the direct connection (port 5432) works too but pools less gracefully under serverless concurrency.
3. This is your `DATABASE_URL` value.

## Vercel Project Setup

1. Go to [vercel.com/new](https://vercel.com/new) and import this GitHub repo (`booluckgmie/eventsMAP`), branch `main` (after this PR merges) or the feature branch directly for a preview deploy.
2. Vercel should auto-detect the `vercel.json` config — no build command needed (it's a Node.js API function, not a static/framework build).
3. Under **Settings → Environment Variables**, add all of the following:

| Variable | Value |
|---|---|
| `DATABASE_URL` | The Supabase connection string from above |
| `DB_SSL` | `true` (default if omitted) |
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
| `EVENT_CAPACITY` | `150` (or your actual seat cap) |
| Event/fee overrides | Optional — see `server/event-config.js` for the full list of `EVENT_*` / `FEE_*` vars; defaults are already set for MMID 2027 |

**None of these should ever be committed to the repo** — they only live in Vercel's encrypted environment variable store.

## Running the DB migration against Supabase

Once you have `DATABASE_URL`, run this locally once (not on Vercel — it's a one-time setup step) to create the tables (if not already present) and optionally seed demo data:

```bash
DATABASE_URL="postgresql://..." npm run db:setup   # tables only
DATABASE_URL="postgresql://..." npm run db:seed    # tables + demo rows (remove before going live)
DATABASE_URL="postgresql://..." npm run db:status  # check row counts
```

## Pointing your domain

After the Vercel deployment is live and verified (test a registration end-to-end, check `/admin` and `/checkin`), point `events.maprostho.com.my` at Vercel:
1. In Vercel, go to **Settings → Domains** and add `events.maprostho.com.my`.
2. Vercel will show you a CNAME (or A record) to add in cPanel's **Zone Editor** for that subdomain.
3. Once DNS propagates, Vercel auto-issues an SSL certificate.

## Billplz webhook

Update your Billplz collection's callback URL (if not already using `FRONTEND_URL` dynamically) to `https://events.maprostho.com.my/api/billplz/webhook` once the domain is pointed.
