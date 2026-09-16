// server/services/db-migrate.js
// Programmatic schema runner for Postgres (Supabase in production).
//
// Usage:
//   npm run db:setup     — create tables
//   npm run db:seed      — create tables + demo rows
//   npm run db:reset     — drop + recreate + seed
//   npm run db:status    — show live counts
'use strict';

require('dotenv').config();
const { Client } = require('pg');
const crypto = require('crypto');

function makeClient() {
  const useSsl = process.env.DB_SSL !== 'false';
  return process.env.DATABASE_URL
    ? new Client({ connectionString: process.env.DATABASE_URL, ssl: useSsl ? { rejectUnauthorized: false } : false })
    : new Client({
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT || '5432', 10),
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME     || 'postgres',
        ssl:      useSsl ? { rejectUnauthorized: false } : false,
      });
}

const DDL = `
CREATE TABLE IF NOT EXISTS registrations (
  id              VARCHAR(16) PRIMARY KEY,
  reg_mode        TEXT NOT NULL DEFAULT 'SINGLE' CHECK (reg_mode IN ('SINGLE','GROUP')),
  package_type    TEXT NOT NULL CHECK (package_type IN ('LECTURE_ONLY','COMBO')),
  membership      TEXT NOT NULL CHECK (membership IN ('MAP_MEMBER','NON_MEMBER')),
  tier_key        VARCHAR(30) NOT NULL,
  category_label  VARCHAR(150) NOT NULL,
  pax_count       INT NOT NULL DEFAULT 1,
  total_amount    NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  payment_method  TEXT NOT NULL DEFAULT 'BILLPLZ' CHECK (payment_method IN ('BILLPLZ','MANUAL_RECEIPT')),
  paid            BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at         TIMESTAMP DEFAULT NULL,
  bill_id         VARCHAR(100) DEFAULT NULL,
  bill_url        VARCHAR(500) DEFAULT NULL,
  receipt_data     TEXT DEFAULT NULL,
  receipt_mime     VARCHAR(100) DEFAULT NULL,
  receipt_filename VARCHAR(255) DEFAULT NULL,
  receipt_status  TEXT DEFAULT NULL CHECK (receipt_status IN ('PENDING','APPROVED','REJECTED')),
  consent_tnc     BOOLEAN NOT NULL DEFAULT FALSE,
  consent_pdpa    BOOLEAN NOT NULL DEFAULT FALSE,
  registered_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reg_paid ON registrations(paid);
CREATE INDEX IF NOT EXISTS idx_reg_package ON registrations(package_type);
CREATE INDEX IF NOT EXISTS idx_reg_receipt ON registrations(receipt_status);
CREATE INDEX IF NOT EXISTS idx_reg_date ON registrations(registered_at);

CREATE TABLE IF NOT EXISTS attendees (
  id               SERIAL PRIMARY KEY,
  registration_id  VARCHAR(16) NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  is_primary       BOOLEAN NOT NULL DEFAULT FALSE,
  title            VARCHAR(30) NOT NULL DEFAULT '',
  full_name        VARCHAR(255) NOT NULL,
  nric_passport    VARCHAR(30) NOT NULL,
  email            VARCHAR(255) NOT NULL,
  phone_mobile     VARCHAR(30) DEFAULT NULL,
  phone_office     VARCHAR(30) DEFAULT NULL,
  institution      VARCHAR(255) DEFAULT NULL,
  address_practice TEXT DEFAULT NULL,
  mdc_no           VARCHAR(50) DEFAULT NULL,
  food_preference  VARCHAR(100) NOT NULL DEFAULT 'Non-vegetarian',
  qr_hash          VARCHAR(64) NOT NULL UNIQUE,
  checked_in       BOOLEAN NOT NULL DEFAULT FALSE,
  ci_mode          VARCHAR(50) DEFAULT NULL,
  ci_at            TIMESTAMP DEFAULT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_att_registration ON attendees(registration_id);
CREATE INDEX IF NOT EXISTS idx_att_checked_in ON attendees(checked_in);
`;

function qrHash(regId, idx) {
  return crypto.createHash('sha256').update(`${regId}-${idx}-${Date.now()}-${Math.random()}`).digest('hex').slice(0, 24);
}

const SEEDS = [
  {
    reg: {
      id: 'MMID27-1001', reg_mode: 'SINGLE', package_type: 'COMBO', membership: 'MAP_MEMBER',
      tier_key: 'MAP_SINGLE', category_label: 'Combo Lecture & Hands-On - MAP Member',
      pax_count: 1, total_amount: 1000.00, payment_method: 'BILLPLZ',
      paid: true, bill_id: 'BILL-883210', bill_url: 'https://www.billplz.com/bills/883210',
      consent_tnc: true, consent_pdpa: true,
    },
    attendees: [
      { is_primary: true, title: 'Dr', full_name: 'LIM WEI JIE', nric_passport: '890412-10-5431', email: 'limwj@dentistry.com', phone_mobile: '+60123456789', phone_office: '+60379561122', institution: 'Gleneagles KL', address_practice: 'Suite 4-1, Gleneagles Medical Centre, Jalan Ampang, KL', mdc_no: 'MDC-88421', food_preference: 'Non-vegetarian' },
    ],
  },
  {
    reg: {
      id: 'MMID27-1002', reg_mode: 'GROUP', package_type: 'LECTURE_ONLY', membership: 'NON_MEMBER',
      tier_key: 'NON_MAP_GROUP_5', category_label: 'Lecture Only - Group of 5 (Non Member)',
      pax_count: 5, total_amount: 2000.00, payment_method: 'MANUAL_RECEIPT',
      paid: false, receipt_status: 'PENDING',
      consent_tnc: true, consent_pdpa: true,
    },
    attendees: [
      { is_primary: true, title: 'Dato', full_name: 'DATO DR SITI AMINAH BINTI ZAIN', nric_passport: '780101-14-6020', email: 'siti.aminah@kualalumpurdental.com', phone_mobile: '+60198882345', phone_office: '+60321458899', institution: 'Bangsar Dental Specialist', address_practice: 'Bangsar Dental Specialist, Jalan Telawi 3, Bangsar', mdc_no: 'MDC-44210', food_preference: 'Vegetarian' },
      { is_primary: false, title: 'Dr', full_name: 'DR TAN KIAN HENG', nric_passport: '920304-07-5511', email: 'tan.kh@kualalumpurdental.com', phone_mobile: '+60173322110', phone_office: null, institution: 'Bangsar Dental Specialist', address_practice: null, mdc_no: 'MDC-90112', food_preference: 'Non-vegetarian' },
    ],
  },
];

async function main() {
  const [reset, seed, status] = [
    process.argv.includes('--reset'),
    process.argv.includes('--seed') || process.argv.includes('--reset'),
    process.argv.includes('--status'),
  ];

  const client = makeClient();
  try {
    await client.connect();
    console.log(`\n[MIGRATE] Connected → ${client.host || process.env.DATABASE_URL || 'postgres'}\n`);

    if (status) {
      const r = await client.query('SELECT COUNT(*) t, SUM(paid::int) p FROM registrations');
      const a = await client.query('SELECT COUNT(*) t, SUM(checked_in::int) c FROM attendees');
      console.log('Registrations :', Number(r.rows[0].t));
      console.log('Paid          :', Number(r.rows[0].p) || 0);
      console.log('Attendees     :', Number(a.rows[0].t));
      console.log('Checked-in    :', Number(a.rows[0].c) || 0);
      const pkgs = await client.query('SELECT package_type, COUNT(*) n FROM registrations GROUP BY package_type');
      pkgs.rows.forEach(p => console.log(`  ${p.package_type.padEnd(15)}`, Number(p.n)));
      return;
    }

    if (reset) {
      await client.query('DROP TABLE IF EXISTS attendees');
      await client.query('DROP TABLE IF EXISTS registrations');
      console.log('[MIGRATE] Tables dropped.\n');
    }

    await client.query(DDL);
    console.log('[MIGRATE] ✓ Tables ready.');

    if (seed) {
      for (const s of SEEDS) {
        const r = s.reg;
        await client.query(`
          INSERT INTO registrations
            (id,reg_mode,package_type,membership,tier_key,category_label,pax_count,total_amount,
             payment_method,paid,bill_id,bill_url,receipt_status,consent_tnc,consent_pdpa,
             registered_at,updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8, $9,$10,$11,$12,$13,$14,$15, NOW(),NOW())
          ON CONFLICT (id) DO NOTHING`,
          [r.id, r.reg_mode, r.package_type, r.membership, r.tier_key, r.category_label, r.pax_count, r.total_amount,
           r.payment_method, r.paid || false, r.bill_id || null, r.bill_url || null,
           r.receipt_status || null, r.consent_tnc, r.consent_pdpa]
        );
        for (const a of s.attendees) {
          await client.query(`
            INSERT INTO attendees
              (registration_id,is_primary,title,full_name,nric_passport,email,phone_mobile,phone_office,
               institution,address_practice,mdc_no,food_preference,qr_hash,checked_in,created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8, $9,$10,$11,$12,$13,false, NOW())
            ON CONFLICT (qr_hash) DO NOTHING`,
            [r.id, a.is_primary, a.title, a.full_name, a.nric_passport, a.email, a.phone_mobile, a.phone_office,
             a.institution, a.address_practice, a.mdc_no, a.food_preference, qrHash(r.id, a.full_name)]
          );
        }
        console.log(`  ✓ ${r.id} — ${s.attendees.length} attendee(s)`);
      }
    }

    console.log('\n[MIGRATE] ✅ Done. Run: npm run dev\n');

  } catch (e) {
    console.error('\n[MIGRATE] ✗', e.message);
    if (e.code === '28P01') console.error('  → Wrong DB_USER or DB_PASSWORD');
    if (e.code === 'ECONNREFUSED') console.error('  → Postgres is not reachable');
    if (e.code === '3D000') console.error(`  → Database does not exist yet`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
