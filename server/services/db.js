// server/services/db.js
// Postgres (Supabase) connection pool + full CRUD layer for registrations + attendees.
'use strict';

require('dotenv').config();
const { Pool } = require('pg');
const crypto = require('crypto');

// ── Pool (singleton) ──────────────────────────────────────────
let _pool = null;

function getPool() {
  if (_pool) return _pool;

  const useSsl = process.env.DB_SSL !== 'false'; // Supabase requires SSL; default on
  const sslOpt = useSsl ? { rejectUnauthorized: false } : false;

  _pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: sslOpt, max: 10 })
    : new Pool({
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT || '5432', 10),
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME     || 'postgres',
        ssl:      sslOpt,
        max:      10,
      });
  return _pool;
}

async function query(sql, params = []) {
  const { rows } = await getPool().query(sql, params);
  return rows;
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

// ── CREATE: registration + attendees (transactional) ───────────
async function createRegistration(reg, attendees) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO registrations (
        id, reg_mode, package_type, membership, tier_key, category_label,
        pax_count, total_amount, payment_method,
        paid, paid_at, bill_id, bill_url, receipt_data, receipt_mime, receipt_filename, receipt_status,
        consent_tnc, consent_pdpa, registered_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6, $7,$8,$9, $10,$11,$12,$13,$14,$15,$16,$17, $18,$19, NOW(),NOW()
      )`,
      [
        reg.id, reg.regMode, reg.packageType, reg.membership, reg.tierKey, reg.categoryLabel,
        reg.paxCount, reg.totalAmount, reg.paymentMethod,
        reg.paid || false, reg.paidAt || null, reg.billId || null, reg.billUrl || null,
        reg.receiptData || null, reg.receiptMime || null, reg.receiptFilename || null, reg.receiptStatus || null,
        reg.consentTnc || false, reg.consentPdpa || false,
      ]
    );

    for (let i = 0; i < attendees.length; i++) {
      const a = attendees[i];
      const qrHash = genQrHash(reg.id, i);
      await client.query(`
        INSERT INTO attendees (
          registration_id, is_primary, title, full_name, nric_passport, email,
          phone_mobile, phone_office, institution, address_practice, mdc_no,
          food_preference, qr_hash, checked_in, created_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6, $7,$8,$9,$10,$11, $12,$13,false, NOW()
        )`,
        [
          reg.id, i === 0, a.title || '', a.fullName, a.nricPassport, a.email,
          a.phoneMobile || null, a.phoneOffice || null, a.institution || null,
          a.addressPractice || null, a.mdcNo || null, a.foodPreference || 'Non-vegetarian',
          qrHash,
        ]
      );
    }

    await client.query('COMMIT');
    return findRegistrationById(reg.id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── FIND registration by id (with attendees) ────────────────────
async function findRegistrationById(id) {
  const regs = await query('SELECT * FROM registrations WHERE id = $1 LIMIT 1', [id]);
  if (!regs.length) return null;
  const attendees = await query('SELECT * FROM attendees WHERE registration_id = $1 ORDER BY id ASC', [id]);
  return { ...registrationRow(regs[0]), attendees: attendees.map(attendeeRow) };
}

async function findRegistrationByBillId(billId) {
  const regs = await query('SELECT * FROM registrations WHERE bill_id = $1 LIMIT 1', [billId]);
  if (!regs.length) return null;
  return findRegistrationById(regs[0].id);
}

// ── FIND ALL registrations (with nested attendees) ───────────────
async function findAllRegistrations(filter = {}) {
  let sql = 'SELECT * FROM registrations';
  const conds = [], vals = [];
  if (filter.paid          !== undefined) { vals.push(filter.paid); conds.push(`paid = $${vals.length}`); }
  if (filter.packageType   !== undefined) { vals.push(filter.packageType); conds.push(`package_type = $${vals.length}`); }
  if (filter.receiptStatus !== undefined) { vals.push(filter.receiptStatus); conds.push(`receipt_status = $${vals.length}`); }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY registered_at DESC';

  const regs = await query(sql, vals);
  if (!regs.length) return [];

  const ids = regs.map(r => r.id);
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  const attendees = await query(
    `SELECT * FROM attendees WHERE registration_id IN (${placeholders}) ORDER BY id ASC`,
    ids
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
  const set = [], vals = [];
  for (const [k, v] of Object.entries(fields)) {
    const col = REG_COL[k];
    if (!col) continue;
    vals.push(v);
    set.push(`${col} = $${vals.length}`);
  }
  set.push('updated_at = NOW()');
  vals.push(id);
  await query(`UPDATE registrations SET ${set.join(', ')} WHERE id = $${vals.length}`, vals);
  return findRegistrationById(id);
}

async function removeRegistration(id) {
  const { rowCount } = await getPool().query('DELETE FROM registrations WHERE id = $1', [id]);
  return rowCount > 0;
}

/** Fetch the raw receipt bytes for an admin download/preview — kept out of the normal row shape. */
async function findReceiptData(id) {
  const rows = await query(
    'SELECT receipt_data, receipt_mime, receipt_filename FROM registrations WHERE id = $1 LIMIT 1',
    [id]
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
  const rows = await query('SELECT * FROM attendees WHERE id = $1 LIMIT 1', [attendeeId]);
  return attendeeRow(rows[0]) || null;
}

async function findAttendeeByQr(qrHash) {
  const rows = await query('SELECT * FROM attendees WHERE qr_hash = $1 LIMIT 1', [qrHash]);
  return attendeeRow(rows[0]) || null;
}

async function searchAttendees(term) {
  const like = `%${term}%`;
  const rows = await query(
    `SELECT * FROM attendees
     WHERE full_name ILIKE $1 OR nric_passport ILIKE $1 OR mdc_no ILIKE $1 OR registration_id ILIKE $1
     LIMIT 20`,
    [like]
  );
  return rows.map(attendeeRow);
}

async function checkinAttendee(attendeeId, mode) {
  await query(
    'UPDATE attendees SET checked_in = true, ci_mode = $1, ci_at = NOW() WHERE id = $2',
    [mode || 'Manual', attendeeId]
  );
  return findAttendeeById(attendeeId);
}

async function emailExists(email) {
  const rows = await query('SELECT id FROM attendees WHERE email = $1 LIMIT 1', [email.toLowerCase()]);
  return rows.length > 0;
}

async function nextId() {
  const rows = await query(
    "SELECT MAX(split_part(id, '-', 2)::int) AS n FROM registrations WHERE id LIKE 'MMID27-%'"
  );
  return 'MMID27-' + String((Number(rows[0].n) || 1000) + 1);
}

// ── STATS (dashboard) ─────────────────────────────────────────
async function getStats() {
  const capacity = parseInt(process.env.EVENT_CAPACITY || '150', 10);

  const [[regTot], [attTot], [paidAgg], [pendAgg], [ciAgg], pkgs] = await Promise.all([
    query('SELECT COUNT(*) AS n FROM registrations'),
    query('SELECT COUNT(*) AS n FROM attendees'),
    query('SELECT COUNT(*) AS n, COALESCE(SUM(total_amount),0) AS rev FROM registrations WHERE paid = true'),
    query("SELECT COUNT(*) AS n FROM registrations WHERE receipt_status = 'PENDING'"),
    query('SELECT COUNT(*) AS n FROM attendees WHERE checked_in = true'),
    query('SELECT package_type, COUNT(*) AS n FROM registrations GROUP BY package_type'),
  ]);

  const byPackage = {};
  pkgs.forEach(p => { byPackage[p.package_type] = Number(p.n); });

  const totalAttendees = Number(attTot.n);
  return {
    totalRegistrations: Number(regTot.n),
    totalAttendees,
    capacity,
    seatsLeft:   Math.max(0, capacity - totalAttendees),
    paid:        Number(paidAgg.n),
    revenue:     Number(paidAgg.rev),
    pending:     Number(pendAgg.n),
    checkedIn:   Number(ciAgg.n),
    byPackage,
  };
}

// ── STARTUP TEST ──────────────────────────────────────────────
async function testConnection() {
  try {
    const rows = await query('SELECT current_database() AS db');
    console.log(`[DB] ✓ Postgres connected — ${rows[0].db}`);
    return true;
  } catch (err) {
    console.error('[DB] ✗ Postgres connection failed:', err.message);
    return false;
  }
}

module.exports = {
  getPool, testConnection,
  createRegistration, findRegistrationById, findRegistrationByBillId,
  findAllRegistrations, updateRegistration, removeRegistration, findReceiptData,
  findAttendeeById, findAttendeeByQr, searchAttendees, checkinAttendee,
  emailExists, nextId, getStats,
};
