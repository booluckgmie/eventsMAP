# Plesk Deployment Guide
## Subdomain: events.maad.com.my
## Server: e122.mschosting.com

---

## Overview

```
events.maad.com.my/           ← Public registration form
events.maad.com.my/admin      ← Committee dashboard
events.maad.com.my/checkin    ← Event-day check-in kiosk
events.maad.com.my/api/health ← System health check
```

For the next event, change `.env` + swap the DB → same subdomain, fresh content.

---

## STEP 1 — Create Subdomain in Plesk

1. Plesk → **Websites & Domains**
2. Click **Add Subdomain**
3. Fill in:
   - **Subdomain name**: `events`
   - **Domain**: `maad.com.my`
   - **Document root**: `/events.maad.com.my` (auto-filled)
4. Click **OK**

Your subdomain is now: `events.maad.com.my`

---

## STEP 2 — Free SSL Certificate

1. Plesk → **Websites & Domains** → `events.maad.com.my`
2. Click **SSL/TLS Certificates**
3. Click **Get it free** under Let's Encrypt
4. Tick: ✅ Secure the subdomain
5. Tick: ✅ Redirect from HTTP to HTTPS
6. Click **Get it free**

BillPlz webhook **requires HTTPS** — do this before going live.

---

## STEP 3 — Create MySQL Database

1. Plesk → **Databases** → **Add Database**
2. Fill in:
   - **Database name**: `events`
   - **Database server**: localhost
   - **Create user**: tick ✅
   - **Database username**: `eventsuser`
   - **Password**: (generate strong, save it)
3. Click **OK**

Note the **actual names** Plesk assigns (prefixed with hosting username):
```
DB_NAME = maadcommy_events
DB_USER = maadcommy_eventsuser
```
*(Check the exact prefix in Plesk → Databases — it shows the full name)*

### Apply SQL Schema via phpMyAdmin

1. Plesk → **Databases** → click **phpMyAdmin** next to your new DB
2. In phpMyAdmin: left panel → click `maadcommy_events`
3. Click **SQL** tab at the top
4. Open `sql/setup.sql` from this repo → copy all content → paste → click **Go**
5. You should see: *"Your SQL query has been executed successfully"*
6. Left panel → click `registrations` to verify the table was created

---

## STEP 4 — Connect GitHub Repository

1. Plesk → **Websites & Domains** → `events.maad.com.my`
2. Click **Git** (or **Git Repositories**)
3. Click **Add Repository**

Fill in:
```
Remote Git repository URL:
  https://YOUR_TOKEN@github.com/yourorg/maad-map-system.git

  (For public repo, just:)
  https://github.com/yourorg/maad-map-system.git

Target directory:
  /maad-map-system
  (This goes inside /var/www/vhosts/events.maad.com.my/maad-map-system)

Deploy branch: main

✅ Deploy automatically when changes are pushed to the remote repository
```

Click **OK** → Plesk clones the repo.

**To get a GitHub token** (for private repo):
```
github.com → Settings → Developer settings
→ Personal access tokens → Tokens (classic)
→ Generate new token → tick "repo" → Generate → copy
```

---

## STEP 5 — Set Up Node.js App

1. Plesk → **Websites & Domains** → `events.maad.com.my`
2. Click **Node.js**
3. Configure:

```
Node.js version:        20.x  (select latest LTS)
Document root:          /httpdocs  (leave as-is)
Application root:       /maad-map-system
Application startup file: server/index.js
Application mode:       production
```

4. Click **Enable Node.js**
5. Click **NPM Install** → waits for install to complete
6. Click **Run Script** → type `db:setup` → click Run
   *(Creates the MySQL table — only needed first time)*

---

## STEP 6 — Environment Variables

In Plesk Node.js settings → scroll to **Environment Variables** → add each one:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `FRONTEND_URL` | `https://events.maad.com.my` |
| `DB_HOST` | `localhost` |
| `DB_PORT` | `3306` |
| `DB_NAME` | `maadcommy_events` |
| `DB_USER` | `maadcommy_eventsuser` |
| `DB_PASSWORD` | *(your DB password)* |
| `EVENT_NAME` | `MAAD × MAP 2025` |
| `EVENT_SHORT` | `MAP 2025` |
| `EVENT_DATE` | `30 April 2025, Wednesday` |
| `EVENT_TIME` | `8:00 AM – 5:00 PM` |
| `EVENT_VENUE` | `Dewan Muktamar, PWTC, Kuala Lumpur` |
| `EVENT_CAPACITY` | `150` |
| `EVENT_EMAIL` | `maadkl@yahoo.com` |
| `FEE_PROFESSIONAL` | `150` |
| `FEE_STUDENT` | `80` |
| `GMAIL_USER` | `committee@maad.org.my` |
| `GMAIL_APP_PASSWORD` | `xxxx xxxx xxxx xxxx` |
| `EMAIL_FROM_NAME` | `MAAD × MAP 2025 Committee` |
| `EMAIL_REPLY_TO` | `maadkl@yahoo.com` |
| `BILLPLZ_API_KEY` | *(from app.billplz.com)* |
| `BILLPLZ_COLLECTION_ID` | `MAADevents` |
| `BILLPLZ_SANDBOX` | `false` |
| `ADMIN_SECRET_KEY` | *(generate below)* |

**Generate ADMIN_SECRET_KEY** (run this locally):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Click **Apply** → Click **Restart App**

---

## STEP 7 — BillPlz Webhook

In your BillPlz dashboard ([app.billplz.com](https://app.billplz.com)):

1. Settings → API → Webhook
2. Set **Callback URL** (server-to-server, fires on payment):
   ```
   https://events.maad.com.my/api/billplz/webhook
   ```
3. Set **Redirect URL** (browser redirect after payment):
   ```
   https://events.maad.com.my/api/billplz/redirect
   ```
4. Save

---

## STEP 8 — Auto-Deploy (GitHub → Plesk)

1. In Plesk → `events.maad.com.my` → Git → your repo
2. Copy the **"Deploy Hook URL"** shown by Plesk
   *(looks like: `https://e122.mschosting.com:8443/modules/git/...`)*

3. In GitHub → your repo → **Settings** → **Webhooks** → **Add webhook**:
   ```
   Payload URL:  (paste Plesk deploy hook URL)
   Content type: application/json
   Events:       ✅ Just the push event
   ```
   Click **Add webhook**

4. In GitHub → your repo → **Settings** → **Secrets and variables** → **Actions**
   → **New repository secret**:
   ```
   Name:  PLESK_DEPLOY_HOOK
   Value: (paste same Plesk deploy hook URL)
   ```

Now every `git push origin main`:
1. GitHub Actions runs CI tests (with real MySQL)
2. If tests pass → triggers Plesk deploy hook
3. Plesk pulls latest code → runs `npm install` → restarts Node.js

---

## STEP 9 — Verify Everything

Visit these URLs and confirm:

```
✅ https://events.maad.com.my/api/health
   Expected: {"status":"ok","event":"MAAD × MAP 2025","stats":{...}}

✅ https://events.maad.com.my/
   Expected: Registration form loads with correct event details

✅ https://events.maad.com.my/admin
   Expected: Admin dashboard (needs x-admin-key)

✅ https://events.maad.com.my/checkin
   Expected: Check-in kiosk
```

Test email:
```bash
# In Plesk Node.js → Run Script → type:
email:verify
```

---

## Running a Future Event (Same Subdomain)

When the next event comes (e.g. MAAD AGM 2026):

1. **Create new DB** in Plesk → `maadcommy_agm2026`
2. **Apply schema** → paste `sql/setup.sql` in phpMyAdmin
3. **Update ENV VARS** in Plesk Node.js:
   ```
   DB_NAME          = maadcommy_agm2026
   DB_USER          = maadcommy_agm2026user
   DB_PASSWORD      = new_password
   EVENT_NAME       = MAAD AGM 2026
   EVENT_DATE       = 15 March 2026, Sunday
   EVENT_VENUE      = PWTC, Kuala Lumpur
   BILLPLZ_COLLECTION_ID = MAADAGM2026
   FEE_PROFESSIONAL = 200
   FEE_STUDENT      = 100
   ```
4. Click **Restart App**
5. Done — same URL, fresh event, new data

Old event data stays safe in its own DB (`maadcommy_events`).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| App not starting | Plesk → Node.js → Logs → check error. Usually missing ENV VAR. |
| `DB_* error` | Confirm exact DB_NAME and DB_USER from Plesk → Databases |
| `502 Bad Gateway` | App crashed — check logs, run NPM Install again |
| Registration page blank | Check browser console — likely `/api/event` returning error |
| Email not sending | Run `email:verify` script in Plesk. Check GMAIL_APP_PASSWORD |
| BillPlz webhook 404 | Confirm URL is `https://events.maad.com.my/api/billplz/webhook` |
| SSL not working | Plesk → SSL/TLS → Let's Encrypt → reissue certificate |
