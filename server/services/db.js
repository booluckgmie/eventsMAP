// server/services/db.js
// MySQL connection pool + full CRUD layer for registrations + attendees.
'use strict';

require('dotenv').config();
const mysql = require('mysql2/promise');
const crypto = require('crypto');

// ── Pool (singleton) ──────────────────────────────────────────
let _pool = null;

function getPool() {
  if (_pool) return _pool;
  _pool = mysql.createPool({
    host:               process.env.DB_HOST     || 'localhost',
    port:               parseInt(process.env.DB_PORT || '3306', 10),
    user:               process.env.DB_USER     || 'maadxmapuser',
    password:           process.env.DB_PASSWORD || 'maadxmap123',
    database:           process.env.DB_NAME     || 'maadxmapevents',
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    timezone:           '+08:00',     // Malaysia Time (UTC+8)
    charset:            'utf8mb4',
    decimalNumbers:     true,
  });
  return _pool;
}

async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
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
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(`
      INSERT INTO registrations (
        id, reg_mode, package_type, membership, tier_key, category_label,
        pax_count, total_amount, payment_method,
        paid, paid_at, bill_id, bill_url, receipt_data, receipt_mime, receipt_filename, receipt_status,
        consent_tnc, consent_pdpa, registered_at, updated_at
      ) VALUES (
        ?,?,?,?,?,?, ?,?,?, ?,?,?,?,?,?,?,?, ?,?, NOW(),NOW()
      )`,
      [
        reg.id, reg.regMode, reg.packageType, reg.membership, reg.tierKey, reg.categoryLabel,
        reg.paxCount, reg.totalAmount, reg.paymentMethod,
        reg.paid ? 1 : 0, reg.paidAt || null, reg.billId || null, reg.billUrl || null,
        reg.receiptData || null, reg.receiptMime || null, reg.receiptFilename || null, reg.receiptStatus || null,
        reg.consentTnc ? 1 : 0, reg.consentPdpa ? 1 : 0,
      ]
    );

    for (let i = 0; i < attendees.length; i++) {
      const a = attendees[i];
      const qrHash = genQrHash(reg.id, i);
      await conn.execute(`
        INSERT INTO attendees (
          registration_id, is_primary, title, full_name, nric_passport, email,
          phone_mobile, phone_office, institution, address_practice, mdc_no,
          food_preference, qr_hash, checked_in, created_at
        ) VALUES (
          ?,?,?,?,?,?, ?,?,?,?,?, ?,?,0, NOW()
        )`,
        [
          reg.id, i === 0 ? 1 : 0, a.title || '', a.fullName, a.nricPassport, a.email,
          a.phoneMobile || null, a.phoneOffice || null, a.institution || null,
          a.addressPractice || null, a.mdcNo || null, a.foodPreference || 'Non-vegetarian',
          qrHash,
        ]
      );
    }

    await conn.commit();
    return findRegistrationById(reg.id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ── FIND registration by id (with attendees) ────────────────────
async function findRegistrationById(id) {
  const regs = await query('SELECT * FROM registrations WHERE id = ? LIMIT 1', [id]);
  if (!regs.length) return null;
  const attendees = await query('SELECT * FROM attendees WHERE registration_id = ? ORDER BY id ASC', [id]);
  return { ...registrationRow(regs[0]), attendees: attendees.map(attendeeRow) };
}

async function findRegistrationByBillId(billId) {
  const regs = await query('SELECT * FROM registrations WHERE bill_id = ? LIMIT 1', [billId]);
  if (!regs.length) return null;
  return findRegistrationById(regs[0].id);
}

// ── FIND ALL registrations (with nested attendees) ───────────────
async function findAllRegistrations(filter = {}) {
  let sql = 'SELECT * FROM registrations';
  const conds = [], vals = [];
  if (filter.paid          !== undefined) { conds.push('paid = ?');           vals.push(filter.paid ? 1 : 0); }
  if (filter.packageType   !== undefined) { conds.push('package_type = ?');   vals.push(filter.packageType); }
  if (filter.receiptStatus !== undefined) { conds.push('receipt_status = ?'); vals.push(filter.receiptStatus); }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY registered_at DESC';

  const regs = await query(sql, vals);
  if (!regs.length) return [];

  const ids = regs.map(r => r.id);
  const placeholders = ids.map(() => '?').join(',');
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
const REG_BOOL_FIELDS = new Set(['paid']);

async function updateRegistration(id, fields) {
  const set = ['updated_at = NOW()'], vals = [];
  for (const [k, v] of Object.entries(fields)) {
    const col = REG_COL[k];
    if (!col) continue;
    set.push(`${col} = ?`);
    vals.push(REG_BOOL_FIELDS.has(k) ? (v ? 1 : 0) : v);
  }
  vals.push(id);
  await query(`UPDATE registrations SET ${set.join(', ')} WHERE id = ?`, vals);
  return findRegistrationById(id);
}

async function removeRegistration(id) {
  const r = await query('DELETE FROM registrations WHERE id = ?', [id]);
  return r.affectedRows > 0;
}

/** Fetch the raw receipt bytes for an admin download/preview — kept out of the normal row shape. */
async function findReceiptData(id) {
  const rows = await query(
    'SELECT receipt_data, receipt_mime, receipt_filename FROM registrations WHERE id = ? LIMIT 1',
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
  const rows = await query('SELECT * FROM attendees WHERE id = ? LIMIT 1', [attendeeId]);
  return attendeeRow(rows[0]) || null;
}

async function findAttendeeByQr(qrHash) {
  const rows = await query('SELECT * FROM attendees WHERE qr_hash = ? LIMIT 1', [qrHash]);
  return attendeeRow(rows[0]) || null;
}

async function searchAttendees(term) {
  const like = `%${term}%`;
  const rows = await query(
    `SELECT * FROM attendees
     WHERE full_name LIKE ? OR nric_passport LIKE ? OR mdc_no LIKE ? OR registration_id LIKE ?
     LIMIT 20`,
    [like, like, like, like]
  );
  return rows.map(attendeeRow);
}

async function checkinAttendee(attendeeId, mode) {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await query(
    'UPDATE attendees SET checked_in = 1, ci_mode = ?, ci_at = ? WHERE id = ?',
    [mode || 'Manual', now, attendeeId]
  );
  return findAttendeeById(attendeeId);
}

async function emailExists(email) {
  const rows = await query('SELECT id FROM attendees WHERE email = ? LIMIT 1', [email.toLowerCase()]);
  return rows.length > 0;
}

async function nextId() {
  const rows = await query(
    "SELECT MAX(CAST(SUBSTRING_INDEX(id, '-', -1) AS UNSIGNED)) AS n FROM registrations WHERE id LIKE 'MMID27-%'"
  );
  return 'MMID27-' + String((Number(rows[0].n) || 1000) + 1);
}

// ── STATS (dashboard) ─────────────────────────────────────────
async function getStats() {
  const capacity = parseInt(process.env.EVENT_CAPACITY || '150', 10);
  const pool = getPool();

  const [[regTot]]   = await pool.execute('SELECT COUNT(*) AS n FROM registrations');
  const [[attTot]]   = await pool.execute('SELECT COUNT(*) AS n FROM attendees');
  const [[paidAgg]]  = await pool.execute('SELECT COUNT(*) AS n, COALESCE(SUM(total_amount),0) AS rev FROM registrations WHERE paid = 1');
  const [[pendAgg]]  = await pool.execute("SELECT COUNT(*) AS n FROM registrations WHERE receipt_status = 'PENDING'");
  const [[ciAgg]]    = await pool.execute('SELECT COUNT(*) AS n FROM attendees WHERE checked_in = 1');
  const pkgs = await query('SELECT package_type, COUNT(*) AS n FROM registrations GROUP BY package_type');

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
    await query('SELECT 1');
    const [[{ db }]] = await getPool().execute('SELECT DATABASE() AS db');
    console.log(`[DB] ✓ MySQL connected — ${process.env.DB_HOST || 'localhost'}/${db}`);
    return true;
  } catch (err) {
    console.error('[DB] ✗ MySQL connection failed:', err.message);
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
