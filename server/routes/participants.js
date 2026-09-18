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

// ── Public (no auth) — used by the onsite check-in kiosk ───────

// GET /api/participants/stats
router.get('/stats', async (req, res) => {
  try {
    res.json(await db.getStats());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/participants/onsite-search?q=...
router.get('/onsite-search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ data: [] });
    res.json({ data: await db.searchAttendees(q) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/participants/attendee/by-qr/:qrHash — used after camera scan
router.get('/attendee/by-qr/:qrHash', async (req, res) => {
  try {
    const attendee = await db.findAttendeeByQr(req.params.qrHash);
    if (!attendee) return res.status(404).json({ error: 'Invalid QR code' });
    const reg = await db.findRegistrationById(attendee.registrationId);
    res.json({ attendee, registration: reg });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/participants/attendee/:attendeeId/checkin  (kiosk — no admin key)
router.patch('/attendee/:attendeeId/checkin', async (req, res) => {
  try {
    const { attendeeId } = req.params;
    const { mode } = req.body;
    const attendee = await db.findAttendeeById(attendeeId);
    if (!attendee) return res.status(404).json({ error: 'Attendee not found' });

    const reg = await db.findRegistrationById(attendee.registrationId);
    if (!reg.paid) return res.status(409).json({ error: 'Payment not confirmed for this registration' });
    if (attendee.checkedIn) return res.json({ status: 'already_checked_in', attendee, registration: reg });

    const updated = await db.checkinAttendee(attendeeId, mode || 'Manual');
    return res.json({ status: 'checked_in', attendee: updated, registration: reg });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Admin-protected routes ────────────────────────────────────
router.use(adminAuth);

// GET /api/participants  — dashboard list (registrations + nested attendees)
router.get('/', async (req, res) => {
  try {
    const data = await db.findAllRegistrations();
    res.json({ data, stats: await db.getStats() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/participants/:id
router.get('/:id', async (req, res) => {
  try {
    const reg = await db.findRegistrationById(req.params.id);
    if (!reg) return res.status(404).json({ error: 'Not found' });
    res.json(reg);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/participants/:id/receipt — stream the uploaded bank slip
router.get('/:id/receipt', async (req, res) => {
  try {
    const receipt = await db.findReceiptData(req.params.id);
    if (!receipt) return res.status(404).json({ error: 'No receipt on file' });
    res.setHeader('Content-Type', receipt.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${receipt.filename || 'receipt'}"`);
    res.send(Buffer.from(receipt.data, 'base64'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/participants/:id/receipt  { approved: true|false }
router.patch('/:id/receipt', async (req, res) => {
  try {
    const reg = await db.findRegistrationById(req.params.id);
    if (!reg) return res.status(404).json({ error: 'Registration not found' });
    if (reg.paymentMethod !== 'MANUAL_RECEIPT') {
      return res.status(400).json({ error: 'This registration is not a manual-receipt payment' });
    }

    const approved = Boolean(req.body.approved);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const updated = await db.updateRegistration(req.params.id, {
      receiptStatus: approved ? 'APPROVED' : 'REJECTED',
      paid:   approved,
      paidAt: approved ? now : null,
    });

    if (approved) {
      mailer.sendAllTickets(updated)
        .then(() => console.log('[ADMIN] ✓ Tickets sent:', updated.id))
        .catch(e => console.error('[ADMIN] Ticket send failed:', e.message));
    } else {
      mailer.sendReceiptRejected(updated, updated.attendees[0])
        .catch(e => console.error('[ADMIN] Rejection email failed:', e.message));
    }

    return res.json({ status: approved ? 'approved' : 'rejected', registration: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/participants/resend-ticket/:attendeeId
router.post('/resend-ticket/:attendeeId', async (req, res) => {
  try {
    const attendee = await db.findAttendeeById(req.params.attendeeId);
    if (!attendee) return res.status(404).json({ error: 'Attendee not found' });
    const reg = await db.findRegistrationById(attendee.registrationId);
    if (!reg.paid) return res.status(409).json({ error: 'Not paid yet' });

    await mailer.sendTicketWithQR(reg, attendee);
    return res.json({ status: 'sent', email: attendee.email });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/participants/remind  — payment reminders for unpaid BillPlz + pending manual receipts
router.post('/remind', async (req, res) => {
  try {
    const all = await db.findAllRegistrations();
    const pending = all.filter(r => !r.paid && (r.billUrl || r.receiptStatus === 'PENDING'));
    let sent = 0;
    for (const reg of pending) {
      const primary = reg.attendees.find(a => a.isPrimary) || reg.attendees[0];
      await mailer.sendPaymentReminder(reg, primary)
        .then(() => sent++)
        .catch(e => console.error('[REMIND]', reg.id, e.message));
      await new Promise(r => setTimeout(r, 1200)); // rate limit 1.2s gap
    }
    return res.json({ status: 'done', sent, total: pending.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/participants/:id/verify-payment — check live BillPlz status
router.get('/:id/verify-payment', async (req, res) => {
  try {
    const reg = await db.findRegistrationById(req.params.id);
    if (!reg)        return res.status(404).json({ error: 'Registration not found' });
    if (!reg.billId) return res.status(400).json({ error: 'No BillPlz bill ID for this registration', paid: reg.paid });

    const billplzSvc = require('../services/billplz');
    const bill       = await billplzSvc.getBill(reg.billId);

    const billState = bill.state;
    const billPaid  = billState === 'paid';
    const amountMYR = (bill.amount || 0) / 100;
    const paidAt    = bill.paid_at || null;

    if (billPaid && !reg.paid) {
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const updated = await db.updateRegistration(req.params.id, {
        paid:   true,
        paidAt: paidAt ? new Date(paidAt).toISOString().slice(0, 19).replace('T', ' ') : nowStr,
      });

      mailer.sendAllTickets(updated).catch(e => console.error('[VERIFY] Ticket send failed:', e.message));

      return res.json({
        status: 'confirmed', billState, amountMYR, paidAt,
        billUrl: reg.billUrl, autoConfirmed: true,
        message: 'Payment confirmed via BillPlz — tickets queued',
      });
    }

    return res.json({
      status:        billPaid ? 'paid' : 'pending',
      billState, amountMYR, paidAt: paidAt || null,
      billUrl: reg.billUrl, alreadyPaid: reg.paid, autoConfirmed: false,
      message: billPaid ? 'Payment confirmed by BillPlz' : `Payment not yet received (state: ${billState})`,
    });
  } catch (err) {
    console.error('[VERIFY]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/participants/:id
router.delete('/:id', async (req, res) => {
  try {
    const reg = await db.findRegistrationById(req.params.id);
    if (!reg) return res.status(404).json({ error: 'Not found' });
    await db.removeRegistration(req.params.id);
    return res.json({ status: 'deleted', id: req.params.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/participants/test-email  ← SMTP health check
router.post('/test-email', async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: 'to email required' });
    const result = await mailer.verifyConnection();
    if (!result.ok) {
      return res.status(500).json({
        error: 'SMTP failed', user: process.env.GMAIL_USER,
        detail: result.message, code: result.code, responseCode: result.responseCode,
      });
    }

    const tier = ev.getTier('LECTURE_ONLY', 'MAP_MEMBER', 'SINGLE');
    await mailer.sendTicketWithQR(
      { id: 'TEST-001', categoryLabel: tier.label, totalAmount: tier.amount },
      { id: 1, registrationId: 'TEST-001', fullName: 'Test User', email: to, foodPreference: 'Standard', qrHash: 'TEST' }
    );
    return res.json({ status: 'sent', to, smtp_user: process.env.GMAIL_USER });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
