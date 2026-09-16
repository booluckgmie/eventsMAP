# MAAD × MAP — Event Registration System

Full-stack event management system covering **Registration → BillPlz Payment → QR Email → Event Day Check-in → Committee Dashboard**.

Built with Node.js + Express + MySQL. Designed for cPanel shared hosting or any VPS.

---

## Repository Structure

```
maad-map-system/
├── frontend/
│   ├── registration.html   ← Public registration form (3-step)
│   ├── admin.html          ← Committee dashboard
│   └── checkin.html        ← Event-day check-in kiosk
├── server/
│   ├── index.js            ← Express entry point
│   ├── routes/
│   │   ├── registration.js ← POST /api/register
│   │   ├── participants.js ← Admin CRUD (x-admin-key protected)
│   │   └── billplz.js      ← BillPlz webhook + manual confirm
│   ├── services/
│   │   ├── db.js           ← MySQL pool + CRUD layer
│   │   ├── db-migrate.js   ← Schema runner (Node.js)
│   │   ├── email.js        ← Nodemailer + Gmail App Password
│   │   ├── email-test.js   ← CLI email tester
│   │   └── qr.js           ← QR code generator
│   └── templates/
│       └── emails.js       ← 3 HTML email templates
├── sql/
│   └── setup.sql           ← cPanel phpMyAdmin SQL (paste directly)
├── .env.example            ← Config template
└── .github/workflows/
    └── ci.yml              ← GitHub Actions CI with MySQL service
```

---

## Quick Start (Local Development)

```bash
# 1. Clone
git clone https://github.com/yourorg/maad-map-system.git
cd maad-map-system

# 2. Install
npm install

# 3. Configure
cp .env.example .env
# Edit .env — fill in DB_*, GMAIL_*, BILLPLZ_*, ADMIN_SECRET_KEY

# 4. Create MySQL database (local)
mysql -u root -p -e "CREATE DATABASE maadxmapevents CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 5. Run schema
npm run db:setup        # creates table + indexes
npm run db:seed         # optional: adds 5 demo rows

# 6. Verify email
npm run email:verify    # test Gmail SMTP
npm run email:preview   # save HTML previews to ./email-previews/

# 7. Start
npm run dev             # development (auto-restart)
npm start               # production
```

Open:
- **Registration** → http://localhost:3000
- **Admin**        → http://localhost:3000/admin  (requires x-admin-key header)
- **Check-in**     → http://localhost:3000/checkin
- **Health API**   → http://localhost:3000/api/health

---

## cPanel Deployment (Shared Hosting)

### Step 1 — MySQL Database in cPanel

1. Login to **cPanel** → **MySQL Databases**
2. **Create Database**: `maad_map`
   - Full name on cPanel: `cpanelusername_maad_map`
3. **Create Database User**: `maaduser`
   - Full name on cPanel: `cpanelusername_maaduser`
   - Set a strong password
4. **Add User to Database** → grant **ALL PRIVILEGES**
5. Open **phpMyAdmin** → select `cpanelusername_maad_map` → click **SQL** tab
6. Paste the entire contents of `sql/setup.sql` → click **Go**

Update `.env`:
```env
DB_HOST=localhost
DB_USER=cpanelusername_maaduser
DB_PASSWORD=your_db_password
DB_NAME=cpanelusername_maad_map
```

### Step 2 — Node.js App in cPanel

1. cPanel → **Setup Node.js App**
2. **Node.js version**: 20.x (LTS)
3. **Application mode**: Production
4. **Application root**: `/home/cpanelusername/maad-map-system`
5. **Application URL**: your domain e.g. `maad.app`
6. **Application startup file**: `server/index.js`
7. Click **Create**

### Step 3 — Upload Files

```bash
# Via SSH / Git
cd /home/cpanelusername/
git clone https://github.com/yourorg/maad-map-system.git

# Or upload zip via cPanel File Manager, then unzip

# Install dependencies
cd maad-map-system
npm install --omit=dev
```

### Step 4 — Environment Variables

In cPanel → Setup Node.js App → **Environment Variables**, add each key from `.env.example`. Or create the `.env` file directly:

```bash
# In SSH
cp .env.example .env
nano .env   # fill in all values
```

### Step 5 — Start App

In cPanel → Setup Node.js App → click **Run JS Script** → run `server/index.js`.

Or via SSH with PM2:
```bash
npm install -g pm2
pm2 start server/index.js --name maad-system
pm2 save
pm2 startup
```

### Step 6 — BillPlz Webhook

In your BillPlz dashboard ([app.billplz.com](https://app.billplz.com)):
- **Callback URL** (server-to-server): `https://yourdomain.com/api/billplz/webhook`
- **Redirect URL** (browser return):   `https://yourdomain.com/api/billplz/redirect`

---

## Gmail App Password Setup

1. Go to [myaccount.google.com](https://myaccount.google.com) → **Security**
2. Enable **2-Step Verification** (required)
3. **App Passwords** → Select app: `Mail` → Device: `Other` → Name: `MAAD System`
4. Copy the 16-character password into `.env`:

```env
GMAIL_USER=committee@maad.org.my
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

Test it:
```bash
npm run email:verify      # check SMTP connection
npm run email:preview     # generate HTML previews (no send)
npm run email:test        # send all 3 test emails to GMAIL_USER
```

---

## Event Flow

```
Participant → registration.html (3-step form)
    │
    ▼
POST /api/register
    ├── Validates fields
    ├── Checks capacity & duplicate email
    ├── Saves to MySQL registrations table
    ├── Email 1: sendRegistrationConfirmation()  ← "Received + BillPlz link"
    └── (complimentary only) Email 2: sendPaymentConfirmedWithQR()

Participant clicks BillPlz link → pays
    │
    ▼
BillPlz POST /api/billplz/webhook
    ├── Verifies HMAC-SHA256 signature
    ├── Marks paid = 1 in DB
    └── Email 2: sendPaymentConfirmedWithQR()  ← QR code inline + attached

Event day → checkin.html kiosk
    ├── QR scan → PATCH /api/participants/:id/checkin
    ├── Manual code entry
    └── Name search

Admin → admin.html dashboard
    ├── Live stats (registered / paid / checked-in)
    ├── Full registrant table with filters
    ├── Mark paid → trigger QR email
    └── Export CSV
```

---

## API Reference

### Public

| Method | Path | Body / Notes |
|--------|------|------|
| `POST` | `/api/register` | Registration form data |
| `GET`  | `/api/health` | Server + DB status |
| `POST` | `/api/billplz/webhook` | BillPlz payment callback |
| `GET`  | `/api/billplz/redirect` | Browser return after payment |

### Admin (header: `x-admin-key: YOUR_KEY`)

| Method | Path | Notes |
|--------|------|------|
| `GET`    | `/api/participants` | List all; filter `?cat=&paid=&checkin=` |
| `GET`    | `/api/participants/stats` | Live dashboard counts |
| `GET`    | `/api/participants/:id` | Single record |
| `PATCH`  | `/api/participants/:id/pay` | Mark paid + send QR email |
| `PATCH`  | `/api/participants/:id/checkin` | Mark checked in |
| `POST`   | `/api/participants/remind` | Batch payment reminders |
| `POST`   | `/api/participants/resend-qr/:id` | Resend QR to participant |
| `DELETE` | `/api/participants/:id` | Remove registration |
| `POST`   | `/api/billplz/manual-confirm` | Admin confirm payment + send QR |

---

## MySQL Table: `registrations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(10) PK | NX-001, NX-002 … |
| `title_prefix` | VARCHAR(30) | Dr, Prof, Mr, etc. |
| `name` | VARCHAR(255) | Full name as per IC |
| `gender` | ENUM | Male / Female / Prefer not to say |
| `dob` | DATE | Date of birth |
| `ic` | VARCHAR(20) | MyKad format |
| `passport` | VARCHAR(30) | For non-Malaysians |
| `email` | VARCHAR(255) UNIQUE | Primary contact |
| `phone` | VARCHAR(30) | Mobile (primary) |
| `office_phone` | VARCHAR(30) | Optional |
| `org` | VARCHAR(255) | Organisation / institution |
| `cat` | ENUM | Professional / Student / VIP / Committee / Speaker |
| `fee` | DECIMAL(8,2) | Registration fee in MYR |
| `diet` | VARCHAR(100) | Food preference |
| `notes` | TEXT | Additional notes |
| `paid` | TINYINT(1) | 0=pending, 1=paid |
| `paid_at` | DATETIME | Payment confirmed timestamp |
| `bill_id` | VARCHAR(100) | BillPlz bill ID |
| `bill_url` | VARCHAR(500) | BillPlz payment link |
| `consent_tnc` | TINYINT(1) | T&C agreed |
| `consent_pdpa` | TINYINT(1) | PDPA 2010 consent |
| `checkin` | TINYINT(1) | 0=absent, 1=present |
| `ci_mode` | VARCHAR(50) | QR / Counter / Admin Override |
| `ci_time` | VARCHAR(20) | Display string "09:14 AM" |
| `ci_at` | DATETIME | Exact check-in timestamp |
| `registered_at` | DATETIME | Auto |
| `updated_at` | DATETIME | Auto ON UPDATE |

---

## Multi-Event Use

This system is reusable across MAAD events. For each new event:
1. Update `.env` — change `EVENT_NAME`, `EVENT_DATE`, `EVENT_CAPACITY`, `BILLPLZ_COLLECTION_ID`
2. Create a new database (`maad_agm2025`, `maad_dinner2026`, etc.) and run `sql/setup.sql`
3. Point `DB_NAME` to the new database

All registration data is isolated per database.

---

## Gmail Rate Limits

| Account | Limit |
|---|---|
| Free Gmail | ~100/hour, 500/day |
| Google Workspace | ~2,000/day |

For events with >500 participants, swap the transporter in `server/services/email.js` to Brevo or Amazon SES (one-line change — same Nodemailer API).

---

## Security Checklist

- [x] `.env` and `data/` in `.gitignore` — never committed
- [x] BillPlz webhook verified with HMAC-SHA256
- [x] Admin endpoints protected by `x-admin-key` header
- [x] Rate limiting on `/api/register` (10 req / 15 min per IP)
- [x] Helmet.js security headers
- [x] CORS restricted to `FRONTEND_URL` in production
- [x] Parameterised SQL queries — no injection surface
- [x] MySQL user has only the privileges it needs

---

## License

Private — MyKetapang Group (KT0302417-X). Not for redistribution.
