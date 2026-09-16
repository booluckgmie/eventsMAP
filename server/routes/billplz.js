// server/routes/billplz.js
'use strict';

const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();
const db      = require('../services/db');
const mailer  = require('../services/email');

function verifyXSignature(body) {
  const xSigKey = process.env.BILLPLZ_X_SIGNATURE_KEY || '';
  if (!xSigKey) return true;

  const { x_signature, ...rest } = body;
  const msg = Object.keys(rest)
    .sort()
    .map(k => `${k}|${rest[k]}`)
    .join('|');

  const expected = crypto.createHmac('sha256', xSigKey).update(msg).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(x_signature || ''));
  } catch {
    return false;
  }
}

router.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    console.log('[WEBHOOK] BillPlz payload:', JSON.stringify(body));

    // 1. Verify signature
    if (!verifyXSignature(body)) {
      console.warn('[WEBHOOK] Invalid X-Signature — rejected');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // 2. Only process confirmed paid bills
    if (body.paid !== 'true') {
      console.log('[WEBHOOK] Not paid yet, state:', body.state);
      return res.status(200).json({ received: true, action: 'ignored' });
    }

    // 3. Find registration by BillPlz bill id, fallback to reference_1
    const billId = body.id;
    let reg = await db.findRegistrationByBillId(billId);
    if (!reg && body.reference_1) {
      reg = await db.findRegistrationById(body.reference_1);
    }

    if (!reg) {
      console.error('[WEBHOOK] No registration for billId:', billId);
      return res.status(200).json({ received: true, action: 'not_found' });
    }

    if (reg.paid) {
      console.log('[WEBHOOK] Already paid:', reg.id);
      return res.status(200).json({ received: true, action: 'already_paid' });
    }

    // 4. Mark paid in DB
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    reg = await db.updateRegistration(reg.id, { paid: true, paidAt: now });
    console.log('[WEBHOOK] ✓ Marked paid:', reg.id);

    // 5. Send ticket + QR email to every attendee
    mailer.sendAllTickets(reg)
      .then(() => console.log('[WEBHOOK] ✓ Tickets sent for:', reg.id))
      .catch(e => console.error('[WEBHOOK] Ticket send failed:', e.message));

    return res.status(200).json({ received: true, action: 'paid', id: reg.id });

  } catch (err) {
    console.error('[WEBHOOK] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/redirect', (req, res) => {
  const paid = req.query.billplz?.paid === 'true' || req.query.paid === 'true';
  res.redirect(paid ? '/payment-success?payment=success' : '/payment-success?payment=pending');
});

module.exports = router;
