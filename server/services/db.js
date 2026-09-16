// server/services/db.js
// MySQL connection pool + full CRUD layer.
// All functions are async — swap pool driver without touching routes.
'use strict';

require('dotenv').config();
const mysql = require('mysql2/promise');

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

// ── Row mapper: snake_case DB → camelCase JS ──────────────────
function row(r) {
  if (!r) return null;
  return {
    id:           r.id,
    titlePrefix:  r.title_prefix  || '',
    name:         r.name,
    gender:       r.gender        || null,
    dob:          r.dob ? new Date(r.dob).toISOString().slice(0, 10) : null,
    ic:           r.ic            || null,
    passport:     r.passport      || null,
    email:        r.email,
    phone:        r.phone,
    officePhone:  r.office_phone  || null,
    org:          r.org           || null,
    cat:          r.cat,
    fee:          Number(r.fee),
    diet:         r.diet          || 'Standard',
    notes:        r.notes         || null,
    paid:         Boolean(r.paid),
    paidAt:       r.paid_at  ? new Date(r.paid_at).toISOString()  : null,
    billId:       r.bill_id  || null,
    billUrl:      r.bill_url || null,
    consentTnc:   Boolean(r.consent_tnc),
    consentPdpa:  Boolean(r.consent_pdpa),
    checkin:      Boolean(r.checkin),
    ciMode:       r.ci_mode  || null,
    ciTime:       r.ci_time  || null,
    ciAt:         r.ci_at ? new Date(r.ci_at).toISOString() : null,
    registeredAt: r.registered_at ? new Date(r.registered_at).toISOString() : new Date().toISOString(),
    updatedAt:    r.updated_at    ? new Date(r.updated_at).toISOString()    : null,
  };
}

// ── INSERT ────────────────────────────────────────────────────
async function insert(p) {
  await query(`
    INSERT INTO registrations (
      id, title_prefix, name, gender, dob, ic, passport,
      email, phone, office_phone, org,
      cat, fee, diet, notes,
      paid, paid_at, bill_id, bill_url,
      consent_tnc, consent_pdpa,
      checkin, registered_at, updated_at
    ) VALUES (
      ?,?,?,?,?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?,?, ?,?, ?, NOW(),NOW()
    )`,
    [
      p.id, p.titlePrefix||'', p.name, p.gender||null, p.dob||null, p.ic||null, p.passport||null,
      p.email, p.phone, p.officePhone||null, p.org||null,
      p.cat, p.fee, p.diet||'Standard', p.notes||null,
      p.paid?1:0, p.paidAt||null, p.billId||null, p.billUrl||null,
      p.consentTnc?1:0, p.consentPdpa?1:0,
      0,
    ]
  );
  return findById(p.id);
}

// ── FIND ALL ──────────────────────────────────────────────────
async function findAll(filter = {}) {
  let sql = 'SELECT * FROM registrations';
  const conds = [], vals = [];
  if (filter.cat     !== undefined) { conds.push('cat = ?');     vals.push(filter.cat); }
  if (filter.paid    !== undefined) { conds.push('paid = ?');    vals.push(filter.paid    ? 1 : 0); }
  if (filter.checkin !== undefined) { conds.push('checkin = ?'); vals.push(filter.checkin ? 1 : 0); }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY registered_at DESC';
  return (await query(sql, vals)).map(row);
}

// ── FIND BY ID ────────────────────────────────────────────────
async function findById(id) {
  const rows = await query(
    'SELECT * FROM registrations WHERE id = ? LIMIT 1',
    [id.toUpperCase()]
  );
  return row(rows[0]) || null;
}

// ── FIND BY FIELD (whitelisted) ───────────────────────────────
const FIELD_COL = { email:'email', billId:'bill_id', phone:'phone', ic:'ic' };

async function findBy(field, value) {
  const col = FIELD_COL[field];
  if (!col) throw new Error(`findBy: unsupported field "${field}"`);
  const rows = await query(
    `SELECT * FROM registrations WHERE ${col} = ? LIMIT 1`, [value]
  );
  return row(rows[0]) || null;
}

// ── UPDATE ────────────────────────────────────────────────────
const COL = {
  titlePrefix:'title_prefix', name:'name', gender:'gender', dob:'dob',
  ic:'ic', passport:'passport', email:'email', phone:'phone', officePhone:'office_phone',
  org:'org', cat:'cat', fee:'fee', diet:'diet', notes:'notes',
  paid:'paid', paidAt:'paid_at', billId:'bill_id', billUrl:'bill_url',
  consentTnc:'consent_tnc', consentPdpa:'consent_pdpa',
  checkin:'checkin', ciMode:'ci_mode', ciTime:'ci_time', ciAt:'ci_at',
};
const BOOL_FIELDS = new Set(['paid','checkin','consentTnc','consentPdpa']);

async function update(id, fields) {
  const set = ['updated_at = NOW()'], vals = [];
  for (const [k, v] of Object.entries(fields)) {
    const col = COL[k];
    if (!col) continue;
    set.push(`${col} = ?`);
    vals.push(BOOL_FIELDS.has(k) ? (v ? 1 : 0) : v);
  }
  vals.push(id.toUpperCase());
  await query(`UPDATE registrations SET ${set.join(', ')} WHERE id = ?`, vals);
  return findById(id);
}

// ── DELETE ────────────────────────────────────────────────────
async function remove(id) {
  const r = await query('DELETE FROM registrations WHERE id = ?', [id.toUpperCase()]);
  return r.affectedRows > 0;
}

// ── HELPERS ───────────────────────────────────────────────────
async function count(filter = {}) {
  return (await findAll(filter)).length;
}

async function nextId() {
  const rows = await query("SELECT MAX(CAST(SUBSTRING(id, 4) AS UNSIGNED)) AS n FROM registrations WHERE id LIKE 'NX-%'");
  return 'NX-' + String((Number(rows[0].n) || 0) + 1).padStart(3, '0');
}

async function emailExists(email) {
  const rows = await query(
    'SELECT id FROM registrations WHERE email = ? LIMIT 1',
    [email.toLowerCase()]
  );
  return rows.length > 0;
}

// ── STATS (dashboard) ─────────────────────────────────────────
async function getStats() {
  const capacity = parseInt(process.env.EVENT_CAPACITY || '150', 10);
  const pool = getPool();
  const [[tot]]  = await pool.execute('SELECT COUNT(*) AS n FROM registrations');
  const [[pay]]  = await pool.execute('SELECT COUNT(*) AS n, COALESCE(SUM(fee),0) AS rev FROM registrations WHERE paid = 1');
  const [[pend]] = await pool.execute('SELECT COUNT(*) AS n FROM registrations WHERE paid = 0');
  const [[ci]]   = await pool.execute('SELECT COUNT(*) AS n FROM registrations WHERE checkin = 1');
  const cats     = await query('SELECT cat, COUNT(*) AS n FROM registrations GROUP BY cat ORDER BY n DESC');
  const byCategory = {};
  cats.forEach(c => { byCategory[c.cat] = Number(c.n); });
  const total = Number(tot.n);
  return {
    total, capacity,
    seatsLeft:  Math.max(0, capacity - total),
    paid:       Number(pay.n),
    revenue:    Number(pay.rev),
    pending:    Number(pend.n),
    checkedIn:  Number(ci.n),
    byCategory,
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
  insert, findAll, getAll: findAll, findById, findBy,
  update, remove, count,
  nextId, emailExists, getStats,
  testConnection, getPool,
};
