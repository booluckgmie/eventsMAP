// server/services/db.js
// Supabase (PostgREST) client + full CRUD layer for registrations + attendees.
'use strict';

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// ── Client (singleton) ───────────────────────────────────────────
let _client = null;

function getClient() {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error('[DB] Missing environment variable: SUPABASE_URL / SUPABASE_SECRET_KEY');
  }

  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

function unwrap({ data, error }) {
  if (error) throw new Error(`[DB] ${error.message}`);
  return data;
}

function genQrHash(regId, seed) {
  return crypto.createHash('sha256').update(`${regId}-${seed}-${Date.now()}-${Math.random()}`).digest('hex').slice(0, 24);
}

// ── Row mappers: snake_case DB → camelCase JS ──────────────────
function attendeeRow(r) {
  if (!r) return null;
  return {
    id:              r.id,
    registrationId:  r.registration_id,
    isPrimary:       Boolean(r.is_primary),
    title:           r.title || '',
    fullName:        r.full_name,
    nricPassport:    r.nric_passport,
    email:           r.email,
    phoneMobile:     r.phone_mobile || null,
    phoneOffice:     r.phone_office || null,
    institution:     r.institution || null,
    addressPractice: r.address_practice || null,
    mdcNo:           r.mdc_no || null,
    foodPreference:  r.food_preference || 'Non-vegetarian',
    qrHash:          r.qr_hash,
    checkedIn:       Boolean(r.checked_in),
    ciMode:          r.ci_mode || null,
    ciAt:            r.ci_at ? new Date(r.ci_at).toISOString() : null,
    createdAt:       r.created_at ? new Date(r.created_at).toISOString() : null,
  };
}

function registrationRow(r) {
  if (!r) return null;
  return {
    id:             r.id,
    regMode:        r.reg_mode,
    packageType:    r.package_type,
    membership:     r.membership,
    tierKey:        r.tier_key,
    categoryLabel:  r.category_label,
    paxCount:       r.pax_count,
    totalAmount:    Number(r.total_amount),
    paymentMethod:  r.payment_method,
    paid:           Boolean(r.paid),
    paidAt:         r.paid_at ? new Date(r.paid_at).toISOString() : null,
    billId:         r.bill_id || null,
    billUrl:        r.bill_url || null,
    receiptMime:      r.receipt_mime || null,
    receiptFilename:  r.receipt_filename || null,
    hasReceipt:       Boolean(r.receipt_data),
    receiptStatus:  r.receipt_status || null,
    consentTnc:     Boolean(r.consent_tnc),
    consentPdpa:    Boolean(r.consent_pdpa),
    registeredAt:   r.registered_at ? new Date(r.registered_at).toISOString() : null,
    updatedAt:      r.updated_at ? new Date(r.updated_at).toISOString() : null,
  };
}

// ── CREATE: registration + attendees ────────────────────────────
// PostgREST has no cross-table transaction; insert the registration first,
// then the attendees, and delete the registration on failure to avoid orphans.
async function createRegistration(reg, attendees) {
  const db = getClient();

  unwrap(await db.from('registrations').insert({
    id: reg.id,
    reg_mode: reg.regMode,
    package_type: reg.packageType,
    membership: reg.membership,
    tier_key: reg.tierKey,
    category_label: reg.categoryLabel,
    pax_count: reg.paxCount,
    total_amount: reg.totalAmount,
    payment_method: reg.paymentMethod,
    paid: reg.paid || false,
    paid_at: reg.paidAt || null,
    bill_id: reg.billId || null,
    bill_url: reg.billUrl || null,
    receipt_data: reg.receiptData || null,
    receipt_mime: reg.receiptMime || null,
    receipt_filename: reg.receiptFilename || null,
    receipt_status: reg.receiptStatus || null,
    consent_tnc: reg.consentTnc || false,
    consent_pdpa: reg.consentPdpa || false,
  }));

  try {
    const attendeeRows = attendees.map((a, i) => ({
      registration_id: reg.id,
      is_primary: i === 0,
      title: a.title || '',
      full_name: a.fullName,
      nric_passport: a.nricPassport || null,
      email: a.email,
      phone_mobile: a.phoneMobile || null,
      phone_office: a.phoneOffice || null,
      institution: a.institution || null,
      address_practice: a.addressPractice || null,
      mdc_no: a.mdcNo || null,
      food_preference: a.foodPreference || 'Non-vegetarian',
      qr_hash: genQrHash(reg.id, i),
      checked_in: false,
    }));
    unwrap(await db.from('attendees').insert(attendeeRows));
  } catch (err) {
    await db.from('registrations').delete().eq('id', reg.id);
    throw err;
  }

  return findRegistrationById(reg.id);
}

// ── FIND registration by id (with attendees) ────────────────────
async function findRegistrationById(id) {
  const db = getClient();
  const regs = unwrap(await db.from('registrations').select('*').eq('id', id).limit(1));
  if (!regs.length) return null;
  const attendees = unwrap(
    await db.from('attendees').select('*').eq('registration_id', id).order('id', { ascending: true })
  );
  return { ...registrationRow(regs[0]), attendees: attendees.map(attendeeRow) };
}

async function findRegistrationByBillId(billId) {
  const db = getClient();
  const regs = unwrap(await db.from('registrations').select('id').eq('bill_id', billId).limit(1));
  if (!regs.length) return null;
  return findRegistrationById(regs[0].id);
}

// ── FIND ALL registrations (with nested attendees) ───────────────
async function findAllRegistrations(filter = {}) {
  const db = getClient();
  let q = db.from('registrations').select('*');
  if (filter.paid          !== undefined) q = q.eq('paid', filter.paid);
  if (filter.packageType   !== undefined) q = q.eq('package_type', filter.packageType);
  if (filter.receiptStatus !== undefined) q = q.eq('receipt_status', filter.receiptStatus);
  q = q.order('registered_at', { ascending: false });

  const regs = unwrap(await q);
  if (!regs.length) return [];

  const ids = regs.map(r => r.id);
  const attendees = unwrap(
    await db.from('attendees').select('*').in('registration_id', ids).order('id', { ascending: true })
  );
  const byReg = {};
  attendees.forEach(a => {
    (byReg[a.registration_id] = byReg[a.registration_id] || []).push(attendeeRow(a));
  });

  return regs.map(r => ({ ...registrationRow(r), attendees: byReg[r.id] || [] }));
}

// ── UPDATE registration ──────────────────────────────────────────
const REG_COL = {
  paid: 'paid', paidAt: 'paid_at', billId: 'bill_id', billUrl: 'bill_url',
  receiptStatus: 'receipt_status',
};

async function updateRegistration(id, fields) {
  const db = getClient();
  const patch = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(fields)) {
    const col = REG_COL[k];
    if (!col) continue;
    patch[col] = v;
  }
  unwrap(await db.from('registrations').update(patch).eq('id', id));
  return findRegistrationById(id);
}

async function removeRegistration(id) {
  const db = getClient();
  const data = unwrap(await db.from('registrations').delete().eq('id', id).select('id'));
  return data.length > 0;
}

/** Fetch the raw receipt bytes for an admin download/preview — kept out of the normal row shape. */
async function findReceiptData(id) {
  const db = getClient();
  const rows = unwrap(
    await db.from('registrations').select('receipt_data, receipt_mime, receipt_filename').eq('id', id).limit(1)
  );
  if (!rows.length || !rows[0].receipt_data) return null;
  return {
    data:     rows[0].receipt_data,
    mime:     rows[0].receipt_mime,
    filename: rows[0].receipt_filename,
  };
}

// ── ATTENDEE lookups ──────────────────────────────────────────────
async function findAttendeeById(attendeeId) {
  const db = getClient();
  const rows = unwrap(await db.from('attendees').select('*').eq('id', attendeeId).limit(1));
  return attendeeRow(rows[0]) || null;
}

async function findAttendeeByQr(qrHash) {
  const db = getClient();
  const rows = unwrap(await db.from('attendees').select('*').eq('qr_hash', qrHash).limit(1));
  return attendeeRow(rows[0]) || null;
}

async function searchAttendees(term) {
  const db = getClient();
  const like = `%${term}%`;
  const rows = unwrap(
    await db.from('attendees').select('*')
      .or(`full_name.ilike.${like},nric_passport.ilike.${like},mdc_no.ilike.${like},registration_id.ilike.${like}`)
      .limit(20)
  );
  return rows.map(attendeeRow);
}

async function checkinAttendee(attendeeId, mode) {
  const db = getClient();
  unwrap(
    await db.from('attendees')
      .update({ checked_in: true, ci_mode: mode || 'Manual', ci_at: new Date().toISOString() })
      .eq('id', attendeeId)
  );
  return findAttendeeById(attendeeId);
}

async function emailExists(email) {
  const db = getClient();
  const rows = unwrap(await db.from('attendees').select('id').eq('email', email.toLowerCase()).limit(1));
  return rows.length > 0;
}

async function nextId() {
  const db = getClient();
  const rows = unwrap(await db.from('registrations').select('id').ilike('id', 'MMID27-%'));
  const max = rows.reduce((m, r) => {
    const n = parseInt(String(r.id).split('-')[1], 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 1000);
  return 'MMID27-' + (max + 1);
}

// ── STATS (dashboard) ─────────────────────────────────────────
async function getStats() {
  const db = getClient();
  const capacity = parseInt(process.env.EVENT_CAPACITY || '100', 10);

  const [
    { count: totalRegistrations },
    { count: totalAttendees },
    paidRows,
    { count: pending },
    { count: checkedIn },
    pkgRows,
  ] = await Promise.all([
    db.from('registrations').select('*', { count: 'exact', head: true }),
    db.from('attendees').select('*', { count: 'exact', head: true }),
    db.from('registrations').select('total_amount').eq('paid', true),
    db.from('registrations').select('*', { count: 'exact', head: true }).eq('receipt_status', 'PENDING'),
    db.from('attendees').select('*', { count: 'exact', head: true }).eq('checked_in', true),
    db.from('registrations').select('package_type'),
  ]);

  const paid = unwrap(paidRows);
  const revenue = paid.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);

  const byPackage = {};
  unwrap(pkgRows).forEach(p => {
    byPackage[p.package_type] = (byPackage[p.package_type] || 0) + 1;
  });

  const attendeesTotal = totalAttendees || 0;
  return {
    totalRegistrations: totalRegistrations || 0,
    totalAttendees: attendeesTotal,
    capacity,
    seatsLeft:   Math.max(0, capacity - attendeesTotal),
    paid:        paid.length,
    revenue,
    pending:     pending || 0,
    checkedIn:   checkedIn || 0,
    byPackage,
  };
}

// ── STARTUP TEST ──────────────────────────────────────────────
async function testConnection() {
  try {
    const db = getClient();
    const { error } = await db.from('registrations').select('id', { count: 'exact', head: true });
    if (error) throw new Error(error.message);
    console.log('[DB] ✓ Supabase connected');
    return true;
  } catch (err) {
    console.error('[DB] ✗ Supabase connection failed:', err.message);
    return false;
  }
}

module.exports = {
  getClient, testConnection,
  createRegistration, findRegistrationById, findRegistrationByBillId,
  findAllRegistrations, updateRegistration, removeRegistration, findReceiptData,
  findAttendeeById, findAttendeeByQr, searchAttendees, checkinAttendee,
  emailExists, nextId, getStats,
};
