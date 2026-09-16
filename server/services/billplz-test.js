// Quick end-to-end test: BillPlz sandbox bill creation + confirmation email
// Usage: node server/services/billplz-test.js
'use strict';

require('dotenv').config();
const billplz = require('./billplz');
const mailer  = require('./email');

const TEST = {
  id:    'NX-TEST-01',
  name:  'Ahmad Myketapang',
  email: process.env.TEST_EMAIL || 'myketapang@gmail.com',
  phone: '0123456789',
  fee:   550,
  cat:   'Member',
  notes: 'Test registration — sandbox',
};

(async () => {
  console.log('[TEST] BillPlz sandbox:', process.env.BILLPLZ_SANDBOX);
  console.log('[TEST] Creating bill for', TEST.email, '— RM', TEST.fee);

  const { billId, billUrl, error } = await billplz.createBill(TEST);

  if (error) {
    console.error('[TEST] ✗ BillPlz failed:', error);
    process.exit(1);
  }

  console.log('[TEST] ✓ Bill created:', billId);
  console.log('[TEST] ✓ Payment URL:', billUrl);

  const participant = { ...TEST, paid: false, paidAt: null, billId, billUrl };
  await mailer.sendRegistrationConfirmation(participant);
  console.log('[TEST] ✓ Confirmation email sent to', participant.email);
  console.log('[TEST] Done — check inbox for payment link.');
})().catch(e => { console.error('[TEST] Fatal:', e.message); process.exit(1); });
