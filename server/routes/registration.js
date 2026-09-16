// server/routes/registration.js — JSC 2026
'use strict';

const express  = require('express');
const router   = express.Router();
const ev       = require('../event-config');
const db       = require('../services/db');
const mailer   = require('../services/email');
const billplz  = require('../services/billplz');

// All valid categories pulled from event-config
const VALID_CATS = Object.keys(ev.fees);

function validate(b) {
  const errors = [];
  if (!b.name?.trim())                                    errors.push('name is required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email || '')) errors.push('valid email required');
  if ((b.phone||'').replace(/[\s\-()+]/g,'').length < 9)  errors.push('valid mobile number required');
  if (!b.ic?.trim() && !b.passport?.trim())               errors.push('IC or passport number required');
  if (!VALID_CATS.includes(b.cat))                        errors.push('valid attendance category required');
  if (['Workshop','Combo','ComboIntl'].includes(b.cat) && !b.workshop?.trim())
    errors.push('workshop selection required for this category');
  if (!b.consentTnc)  errors.push('Terms & Conditions consent required');
  if (!b.consentPdpa) errors.push('PDPA consent required');
  return errors;
}

router.post('/', async (req, res) => {
  try {
    const b = req.body;

    // 1. Validate
    const errors = validate(b);
    if (errors.length)
      return res.status(400).json({ error: 'Validation failed', details: errors });

    // 2. Capacity check
    const stats = await db.getStats();
    if (stats.total >= ev.capacity)
      return res.status(409).json({ error: 'Registration is full', capacity: ev.capacity });

    // 3. Duplicate email
    const email = (b.email || '').trim().toLowerCase();
    if (await db.emailExists(email))
      return res.status(409).json({ error: 'This email is already registered' });

    // 4. Build record
    const id  = await db.nextId();
    const fee = ev.fees[b.cat];
    const now = new Date().toISOString().slice(0,19).replace('T',' ');

    // Workshop goes into notes field with clear label
    const workshopNote = b.workshop ? `Workshop: ${b.workshop}` : '';
    const extraNotes   = b.notes?.trim() || '';
    const notes        = [workshopNote, extraNotes].filter(Boolean).join(' | ') || null;

    // Create real BillPlz bill for paid categories
    let billId  = null;
    let billUrl = null;
    if (fee > 0) {
      const bill = await billplz.createBill({
        id, name: b.name.trim(), email,
        phone: b.phone.trim(), fee, cat: b.cat, notes,
      });
      billId  = bill.billId;
      billUrl = bill.billUrl;
    }

    const participant = {
      id,
      titlePrefix:  b.titlePrefix?.trim()  || '',
      name:         b.name.trim(),
      gender:       b.gender               || null,
      dob:          b.dob                  || null,
      ic:           b.ic?.trim()           || null,
      passport:     b.passport?.trim()     || null,
      email,
      phone:        b.phone.trim(),
      officePhone:  b.officePhone?.trim()  || null,
      org:          b.org?.trim()          || null,
      cat:          b.cat,
      fee,
      diet:         b.diet                 || 'Standard',
      notes,
      paid:         fee === 0,
      paidAt:       fee === 0 ? now : null,
      billId,
      billUrl,
      consentTnc:   Boolean(b.consentTnc),
      consentPdpa:  Boolean(b.consentPdpa),
    };

    // 5. Save
    await db.insert(participant);

    // 6. Emails — fire-and-forget
    mailer.sendRegistrationConfirmation(participant)
      .catch(e => console.error('[REGISTER] Confirmation email failed:', e.message));

    if (fee === 0) {
      mailer.sendPaymentConfirmedWithQR(participant)
        .catch(e => console.error('[REGISTER] QR email failed:', e.message));
    }

    // 7. Respond
    return res.status(201).json({
      success: true,
      id,
      name:    participant.name,
      email,
      cat:     participant.cat,
      fee,
      paid:    participant.paid,
      billUrl: participant.billUrl,
      message: fee > 0
        ? 'Registered. BillPlz payment link sent to your email.'
        : 'Registered. QR code will be emailed shortly.',
    });

  } catch (err) {
    console.error('[REGISTER]', err);
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

module.exports = router; // <-- Make sure this is present

