// server/routes/participants.js
'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../services/db');
const ev      = require('../event-config');
const mailer  = require('../services/email');

// ── Auth middleware ───────────────────────────────────────────
function adminAuth(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (!key || key !== process.env.ADMIN_SECRET_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
}

// ── Public (no auth) ─────────────────────────────────────────

// GET /api/participants/stats
router.get('/stats', async (req, res) => {
  try {
    const s = await db.getStats();
    res.json({
      total:      s.total,
      capacity:   s.capacity,
      seatsLeft:  s.seatsLeft,
      paid:       s.paid       || 0,
      pending:    s.pending    || 0,
      checkedIn:  s.checkedIn  || 0,
      revenue:    s.revenue    || 0,
      byCategory: s.byCategory || {},
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/participants
router.get('/', async (req, res) => {
  try {
    const list = await db.findAll();
    res.json({ data: list });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/participants/:id/checkin  (used by kiosk — no admin key)
router.patch('/:id/checkin', async (req, res) => {
  try {
    const { id } = req.params;
    const { mode } = req.body;
    const p = await db.findById(id);
    if (!p)       return res.status(404).json({ error: 'Participant not found' });
    if (!p.paid)  return res.status(409).json({ error: 'Payment not confirmed' });
    if (p.checkin) return res.json({ status: 'already_checked_in', participant: p });

    const now    = new Date();
    const ciTime = now.toLocaleTimeString('en-MY', { hour:'2-digit', minute:'2-digit', hour12:true });
    const updated = await db.update(id, {
      checkin: true,
      ciMode:  mode || 'Manual',
      ciTime,
      ciAt:    now.toISOString().slice(0,19).replace('T',' '),
    });
    return res.json({ status: 'checked_in', participant: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Admin-protected routes ────────────────────────────────────
router.use(adminAuth);

// GET /api/participants/:id
router.get('/:id', async (req, res) => {
  try {
    const p = await db.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/participants/:id/pay  ← admin.html calls this
router.patch('/:id/pay', async (req, res) => {
  try {
    const { id } = req.params;
    const p = await db.findById(id);
    if (!p) return res.status(404).json({ error: 'Participant not found' });
    if (p.paid) return res.json({ status: 'already_paid', participant: p });

    const now = new Date().toISOString().slice(0,19).replace('T',' ');
    await db.update(id, { paid: true, paidAt: now });
    const updated = { ...p, paid: true, paidAt: now };

    // Generate QR and send confirmation email
    const qrSvc = require('../services/qr');
    Promise.all([qrSvc.toBase64(updated), qrSvc.toBuffer(updated)])
      .then(([dataUrl, buffer]) =>
        mailer.sendPaymentConfirmedWithQR(updated, dataUrl, buffer)
      )
      .then(() => console.log('[ADMIN] ✓ QR email sent:', updated.email))
      .catch(e  => console.error('[ADMIN] QR email failed:', e.message));

    return res.json({ status: 'confirmed', participant: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/participants/resend-qr/:id  ← admin.html calls this
router.post('/resend-qr/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const p = await db.findById(id);
    if (!p)      return res.status(404).json({ error: 'Participant not found' });
    if (!p.paid) return res.status(409).json({ error: 'Not paid yet — mark paid first' });

    const qrSvc = require('../services/qr');
    const [dataUrl, buffer] = await Promise.all([qrSvc.toBase64(p), qrSvc.toBuffer(p)]);
    await mailer.sendPaymentConfirmedWithQR(p, dataUrl, buffer);
    console.log('[ADMIN] ✓ QR resent:', p.email);
    return res.json({ status: 'sent', email: p.email });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/participants/remind  ← send payment reminders to all pending
router.post('/remind', async (req, res) => {
  try {
    const all     = await db.findAll();
    const pending = all.filter(p => !p.paid && p.fee > 0 && p.billUrl);
    let sent = 0;
    for (const p of pending) {
      await mailer.sendPaymentReminder(p)
        .then(() => sent++)
        .catch(e => console.error('[REMIND]', p.id, e.message));
      await new Promise(r => setTimeout(r, 1200)); // rate limit 1.2s gap
    }
    console.log('[ADMIN] Reminders sent:', sent, '/', pending.length);
    return res.json({ status: 'done', sent, total: pending.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/participants/:id/verify-payment  ← check live BillPlz status
router.get('/:id/verify-payment', async (req, res) => {
  try {
    const p = await db.findById(req.params.id);
    if (!p)        return res.status(404).json({ error: 'Participant not found' });
    if (!p.billId) return res.status(400).json({ error: 'No BillPlz bill ID for this participant', paid: p.paid });

    const billplzSvc = require('../services/billplz');
    const bill       = await billplzSvc.getBill(p.billId);

    const billState = bill.state;                     // 'paid' | 'due' | 'overdue' | 'deleted'
    const billPaid  = billState === 'paid';
    const amountMYR = (bill.amount || 0) / 100;
    const paidAt    = bill.paid_at || null;

    // Auto-confirm if BillPlz says paid but DB still shows unpaid
    if (billPaid && !p.paid) {
      const nowStr = new Date().toISOString().slice(0,19).replace('T',' ');
      await db.update(req.params.id, {
        paid:   true,
        paidAt: paidAt
          ? new Date(paidAt).toISOString().slice(0,19).replace('T',' ')
          : nowStr,
      });

      const updated = await db.findById(req.params.id);
      const qrSvc = require('../services/qr');
      Promise.all([qrSvc.toBase64(updated), qrSvc.toBuffer(updated)])
        .then(([dataUrl, buffer]) =>
          mailer.sendPaymentConfirmedWithQR(updated, dataUrl, buffer)
        )
        .catch(e => console.error('[VERIFY] QR email failed:', e.message));

      return res.json({
        status:        'confirmed',
        billState,
        amountMYR,
        paidAt,
        billUrl:       p.billUrl,
        autoConfirmed: true,
        message:       'Payment confirmed via BillPlz — QR email queued',
      });
    }

    return res.json({
      status:        billPaid ? 'paid' : 'pending',
      billState,
      amountMYR,
      paidAt:        paidAt || null,
      billUrl:       p.billUrl,
      alreadyPaid:   p.paid,
      autoConfirmed: false,
      message:       billPaid
        ? 'Payment confirmed by BillPlz'
        : 'Payment not yet received (state: ' + billState + ')',
    });
  } catch (err) {
    console.error('[VERIFY]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/participants/:id
router.delete('/:id', async (req, res) => {
  try {
    const p = await db.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    await db.remove(req.params.id);
    console.log('[ADMIN] ✓ Deleted:', req.params.id, p.email);
    return res.json({ status: 'deleted', id: req.params.id, email: p.email });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/participants/test-email  ← SMTP health check
router.post('/test-email', async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: 'to email required' });
    const ok = await mailer.verifyConnection();
    if (!ok) return res.status(500).json({ error: 'SMTP failed', user: process.env.GMAIL_USER });
    await mailer.sendPaymentConfirmedWithQR({
      id:'TEST-001', name:'Test User', email:to, cat:'Member',
      fee:550, paid:true, paidAt:new Date().toISOString().slice(0,10),
      titlePrefix:'', phone:'0123456789', ic:'900101-14-5001',
      billId:'TEST', billUrl:null, consentTnc:true, consentPdpa:true,
    });
    return res.json({ status: 'sent', to, smtp_user: process.env.GMAIL_USER });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;