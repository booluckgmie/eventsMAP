// server/services/db-migrate.js
// Seed/status helper for Supabase (schema itself is managed via Supabase migrations).
//
// Usage:
//   npm run db:seed      — insert demo rows (no-op if already present)
//   npm run db:status    — show live counts
'use strict';

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function makeClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SECRET_KEY');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

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

async function status(db) {
  const [{ count: regCount }, { data: paidRows }, { count: attCount }, { count: ciCount }, { data: pkgRows }] = await Promise.all([
    db.from('registrations').select('*', { count: 'exact', head: true }),
    db.from('registrations').select('id').eq('paid', true),
    db.from('attendees').select('*', { count: 'exact', head: true }),
    db.from('attendees').select('*', { count: 'exact', head: true }).eq('checked_in', true),
    db.from('registrations').select('package_type'),
  ]);
  console.log('Registrations :', regCount || 0);
  console.log('Paid          :', (paidRows || []).length);
  console.log('Attendees     :', attCount || 0);
  console.log('Checked-in    :', ciCount || 0);
  const byPkg = {};
  (pkgRows || []).forEach(p => { byPkg[p.package_type] = (byPkg[p.package_type] || 0) + 1; });
  Object.entries(byPkg).forEach(([k, n]) => console.log(`  ${k.padEnd(15)}`, n));
}

async function seed(db) {
  for (const s of SEEDS) {
    const r = s.reg;
    const { error: regErr } = await db.from('registrations').upsert({
      id: r.id, reg_mode: r.reg_mode, package_type: r.package_type, membership: r.membership,
      tier_key: r.tier_key, category_label: r.category_label, pax_count: r.pax_count,
      total_amount: r.total_amount, payment_method: r.payment_method, paid: r.paid || false,
      bill_id: r.bill_id || null, bill_url: r.bill_url || null,
      receipt_status: r.receipt_status || null, consent_tnc: r.consent_tnc, consent_pdpa: r.consent_pdpa,
    }, { onConflict: 'id', ignoreDuplicates: true });
    if (regErr) throw new Error(regErr.message);

    const attendeeRows = s.attendees.map(a => ({
      registration_id: r.id, is_primary: a.is_primary, title: a.title, full_name: a.full_name,
      nric_passport: a.nric_passport, email: a.email, phone_mobile: a.phone_mobile, phone_office: a.phone_office,
      institution: a.institution, address_practice: a.address_practice, mdc_no: a.mdc_no,
      food_preference: a.food_preference, qr_hash: qrHash(r.id, a.full_name), checked_in: false,
    }));
    const { error: attErr } = await db.from('attendees').upsert(attendeeRows, { onConflict: 'qr_hash', ignoreDuplicates: true });
    if (attErr) throw new Error(attErr.message);

    console.log(`  ✓ ${r.id} — ${s.attendees.length} attendee(s)`);
  }
}

async function main() {
  const wantSeed = process.argv.includes('--seed') || process.argv.includes('--reset');
  const wantStatus = process.argv.includes('--status');

  const db = makeClient();
  try {
    if (wantStatus) {
      await status(db);
      return;
    }
    if (wantSeed) {
      await seed(db);
    }
    console.log('\n[MIGRATE] ✅ Done. Run: npm run dev\n');
  } catch (e) {
    console.error('\n[MIGRATE] ✗', e.message);
    process.exit(1);
  }
}

main();
