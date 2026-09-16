// server/routes/registration.js — MMID 2027
'use strict';

const express  = require('express');
const multer   = require('multer');
const router   = express.Router();
const ev       = require('../event-config');
const db       = require('../services/db');
const mailer   = require('../services/email');
const billplz  = require('../services/billplz');

// ── Receipt upload (manual bank transfer proof) ─────────────────
// Stored in the database as base64, not on disk — the app runs on
// serverless platforms with no persistent local filesystem.
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) return cb(new Error('Only JPG, PNG, WEBP or PDF receipts are allowed'));
    cb(null, true);
  },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePerson(p, label) {
  const errors = [];
  if (!p.fullName?.trim())                errors.push(`${label}: full name is required`);
  if (!p.nricPassport?.trim())             errors.push(`${label}: NRIC/passport is required`);
  if (!EMAIL_RE.test(p.email || ''))       errors.push(`${label}: valid email is required`);
  return errors;
}

function validate(b) {
  const errors = [];
  if (!['SINGLE', 'GROUP'].includes(b.regMode))            errors.push('valid registration mode required');
  if (!['LECTURE_ONLY', 'COMBO'].includes(b.packageType))  errors.push('valid package type required');
  if (!['MAP_MEMBER', 'NON_MEMBER'].includes(b.membership)) errors.push('valid membership category required');
  if (!['BILLPLZ', 'MANUAL_RECEIPT'].includes(b.paymentMethod)) errors.push('valid payment method required');
  if (!b.consentTnc || b.consentTnc === 'false')   errors.push('Terms & Conditions consent required');
  if (!b.consentPdpa || b.consentPdpa === 'false') errors.push('PDPA consent required');

  const primary = b.primary || {};
  errors.push(...validatePerson(primary, 'Primary delegate'));
  if ((primary.phoneMobile || '').replace(/[\s\-()+]/g, '').length < 9) {
    errors.push('Primary delegate: valid mobile number required');
  }
  if (!primary.addressPractice?.trim()) errors.push('Primary delegate: address of practice is required');

  let groupMembers = [];
  if (b.regMode === 'GROUP') {
    groupMembers = Array.isArray(b.groupMembers) ? b.groupMembers : [];
    if (groupMembers.length !== 4) {
      errors.push('Group registration requires exactly 4 additional delegates');
    } else {
      groupMembers.forEach((g, i) => errors.push(...validatePerson(g, `Delegate #${i + 2}`)));
    }
  }

  return { errors, groupMembers };
}

router.post('/', upload.single('receipt'), async (req, res) => {
  try {
    // multipart/form-data sends nested objects as JSON strings
    const b = { ...req.body };
    if (typeof b.primary === 'string')      b.primary = JSON.parse(b.primary);
    if (typeof b.groupMembers === 'string') b.groupMembers = JSON.parse(b.groupMembers);

    // 1. Validate
    const { errors, groupMembers } = validate(b);
    if (b.paymentMethod === 'MANUAL_RECEIPT' && !req.file) {
      errors.push('Payment receipt file is required for bank transfer');
    }
    if (errors.length) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    // 2. Pricing
    const tier = ev.getTier(b.packageType, b.membership, b.regMode);

    // 3. Capacity check
    const stats = await db.getStats();
    if (stats.totalAttendees + tier.pax > ev.capacity) {
      return res.status(409).json({ error: 'Not enough seats remaining', capacity: ev.capacity, seatsLeft: stats.seatsLeft });
    }

    // 4. Duplicate email (primary)
    const primaryEmail = (b.primary.email || '').trim().toLowerCase();
    if (await db.emailExists(primaryEmail)) {
      return res.status(409).json({ error: 'This email is already registered' });
    }

    // 5. Build attendee list
    const attendees = [
      {
        title:           b.primary.title?.trim()      || '',
        fullName:        b.primary.fullName.trim().toUpperCase(),
        nricPassport:    b.primary.nricPassport.trim(),
        email:           primaryEmail,
        phoneMobile:     b.primary.phoneMobile?.trim() || null,
        phoneOffice:     b.primary.phoneOffice?.trim() || null,
        institution:     b.primary.institution?.trim() || null,
        addressPractice: b.primary.addressPractice?.trim() || null,
        mdcNo:           b.primary.mdcNo?.trim() || null,
        foodPreference:  b.primary.foodPreference || 'Non-vegetarian',
      },
      ...groupMembers.map(g => ({
        title:           g.title?.trim() || '',
        fullName:        g.fullName.trim().toUpperCase(),
        nricPassport:    g.nricPassport.trim(),
        email:           (g.email || '').trim().toLowerCase(),
        phoneMobile:     b.primary.phoneMobile?.trim() || null,
        phoneOffice:     null,
        institution:     b.primary.institution?.trim() || null,
        addressPractice: null,
        mdcNo:           g.mdcNo?.trim() || null,
        foodPreference:  g.foodPreference || 'Non-vegetarian',
      })),
    ];

    // 6. Registration id + BillPlz bill (if applicable)
    const id = await db.nextId();
    let billId = null, billUrl = null;

    if (b.paymentMethod === 'BILLPLZ') {
      const bill = await billplz.createBill({
        id,
        name:  attendees[0].fullName,
        email: primaryEmail,
        phone: attendees[0].phoneMobile,
        fee:   tier.amount,
        categoryLabel: tier.label,
      });
      if (!bill.success) {
        return res.status(502).json({ error: 'Failed to create payment link', detail: bill.error });
      }
      billId  = bill.billId;
      billUrl = bill.billUrl;
    }

    const registration = {
      id,
      regMode:       b.regMode,
      packageType:   b.packageType,
      membership:    b.membership,
      tierKey:       tier.tierKey,
      categoryLabel: tier.label,
      paxCount:      tier.pax,
      totalAmount:   tier.amount,
      paymentMethod: b.paymentMethod,
      paid:          false,
      billId,
      billUrl,
      receiptData:     req.file ? req.file.buffer.toString('base64') : null,
      receiptMime:     req.file ? req.file.mimetype : null,
      receiptFilename: req.file ? req.file.originalname.slice(0, 250) : null,
      receiptStatus: b.paymentMethod === 'MANUAL_RECEIPT' ? 'PENDING' : null,
      consentTnc:    true,
      consentPdpa:   true,
    };

    // 7. Save (transactional)
    const saved = await db.createRegistration(registration, attendees);

    // 8. Confirmation email — fire-and-forget
    mailer.sendRegistrationConfirmation(saved, saved.attendees[0])
      .catch(e => console.error('[REGISTER] Confirmation email failed:', e.message));

    // 9. Respond
    return res.status(201).json({
      success: true,
      id,
      categoryLabel: tier.label,
      totalAmount:   tier.amount,
      paymentMethod: b.paymentMethod,
      billUrl,
      message: b.paymentMethod === 'BILLPLZ'
        ? 'Registered. Redirecting to BillPlz for payment.'
        : 'Registered. Your receipt is pending manual verification.',
    });

  } catch (err) {
    console.error('[REGISTER]', err);
    if (err.message?.includes('Invalid package') || err.message?.includes('Invalid pricing')) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

module.exports = router;
