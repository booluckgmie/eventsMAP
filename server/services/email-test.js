// server/services/email-test.js
// Usage: node server/services/email-test.js [verify|preview|registration|payment|reminder|all]
'use strict';

require('dotenv').config();
const fs       = require('fs');
const path     = require('path');
const mailer   = require('./email');
const qr       = require('./qr');
const templates = require('../templates/emails');

const TEST_P = {
  id:           'NX-001',
  name:         'Ahmad Najmi bin Ariffin',
  email:        process.env.TEST_EMAIL || process.env.GMAIL_USER,
  phone:        '012-3456789',
  ic:           '880101-01-1234',
  org:          'PETRONAS',
  title:        'Executive, Industry Advisory',
  sector:       'Government / GLC',
  cat:          'Professional',
  fee:          150,
  diet:         'Halal only (standard)',
  tshirt:       'M',
  notes:        '',
  paid:         true,
  paidAt:       new Date().toISOString(),
  checkin:      false,
  billUrl:      'https://www.billplz.com/bills/nx-001',
  registeredAt: new Date().toISOString(),
};

const TEST_PENDING = {
  ...TEST_P,
  id: 'NX-003', name: 'Zahra Alia binti Zakaria',
  email: process.env.TEST_EMAIL || process.env.GMAIL_USER,
  org: 'UKM', cat: 'Student', fee: 80,
  paid: false, paidAt: null, billUrl: 'https://www.billplz.com/bills/nx-003',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

const cmds = {
  async verify() {
    const ok = await mailer.verifyConnection();
    console.log(ok ? '✅ SMTP OK' : '❌ SMTP failed — check .env credentials');
  },

  async registration() {
    await mailer.sendRegistrationConfirmation(TEST_P);
    console.log('✅ Registration email sent to', TEST_P.email);
  },

  async payment() {
    await mailer.sendPaymentConfirmedWithQR(TEST_P);
    console.log('✅ Payment + QR email sent to', TEST_P.email);
  },

  async reminder() {
    await mailer.sendPaymentReminder(TEST_PENDING);
    console.log('✅ Reminder sent to', TEST_PENDING.email);
  },

  async all() {
    console.log('Sending all 3 emails...');
    await cmds.registration(); await sleep(1500);
    await cmds.payment();      await sleep(1500);
    await cmds.reminder();
    console.log('✅ All sent. Check:', TEST_P.email);
  },

  async preview() {
    const outDir = path.join(process.cwd(), 'email-previews');
    fs.mkdirSync(outDir, { recursive: true });
    const qrB64 = await qr.toBase64(TEST_P);
    fs.writeFileSync(path.join(outDir, '01-registration.html'), templates.registrationReceived(TEST_P).html);
    fs.writeFileSync(path.join(outDir, '02-payment-qr.html'),   templates.paymentConfirmed(TEST_P, qrB64).html);
    fs.writeFileSync(path.join(outDir, '03-reminder.html'),     templates.paymentReminder(TEST_PENDING).html);
    console.log('✅ Previews saved to ./email-previews/ — open in browser');
  },
};

(async () => {
  const cmd = process.argv[2] || 'verify';
  if (!cmds[cmd]) {
    console.log('Commands: verify | preview | registration | payment | reminder | all');
    process.exit(1);
  }
  await cmds[cmd]();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
