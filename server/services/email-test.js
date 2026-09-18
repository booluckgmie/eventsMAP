// server/services/email-test.js
// Usage: node server/services/email-test.js [verify|preview|registration|ticket|reminder|all]
'use strict';

require('dotenv').config();
const fs     = require('fs');
const path   = require('path');
const mailer = require('./email');
const qr     = require('./qr');
const tpl    = require('./email2');

const TEST_REG = {
  id: 'MMID27-TEST', regMode: 'SINGLE', packageType: 'COMBO', membership: 'MAP_MEMBER',
  tierKey: 'MAP_SINGLE', categoryLabel: 'Combo Lecture & Hands-On - MAP Member',
  paxCount: 1, totalAmount: 1000, paymentMethod: 'BILLPLZ',
  paid: true, billUrl: 'https://www.billplz.com/bills/test',
};

const TEST_ATTENDEE = {
  id: 1, registrationId: 'MMID27-TEST', isPrimary: true, title: 'Dr',
  fullName: 'Ahmad Najmi bin Ariffin', email: process.env.TEST_EMAIL || process.env.GMAIL_USER,
  nricPassport: '880101-01-1234', foodPreference: 'Halal / Standard', qrHash: 'TEST-QR-HASH',
};

const TEST_PENDING_REG = { ...TEST_REG, id: 'MMID27-PEND', paid: false, billUrl: 'https://www.billplz.com/bills/pending' };

const sleep = ms => new Promise(r => setTimeout(r, ms));

const cmds = {
  async verify() {
    const result = await mailer.verifyConnection();
    console.log(result.ok ? '✅ SMTP OK' : `❌ SMTP failed — ${result.message} (code: ${result.code})`);
  },

  async registration() {
    await mailer.sendRegistrationConfirmation(TEST_REG, TEST_ATTENDEE);
    console.log('✅ Registration email sent to', TEST_ATTENDEE.email);
  },

  async ticket() {
    await mailer.sendTicketWithQR(TEST_REG, TEST_ATTENDEE);
    console.log('✅ Ticket + QR email sent to', TEST_ATTENDEE.email);
  },

  async reminder() {
    await mailer.sendPaymentReminder(TEST_PENDING_REG, TEST_ATTENDEE);
    console.log('✅ Reminder sent to', TEST_ATTENDEE.email);
  },

  async all() {
    console.log('Sending all 3 emails...');
    await cmds.registration(); await sleep(1500);
    await cmds.ticket();       await sleep(1500);
    await cmds.reminder();
    console.log('✅ All sent. Check:', TEST_ATTENDEE.email);
  },

  async preview() {
    const outDir = path.join(process.cwd(), 'email-previews');
    fs.mkdirSync(outDir, { recursive: true });
    const qrB64 = await qr.toBase64(TEST_ATTENDEE);
    fs.writeFileSync(path.join(outDir, '01-registration.html'), tpl.registrationConfirmation(TEST_REG, TEST_ATTENDEE));
    fs.writeFileSync(path.join(outDir, '02-ticket-qr.html'),     tpl.ticketWithQR(TEST_REG, TEST_ATTENDEE, qrB64));
    fs.writeFileSync(path.join(outDir, '03-reminder.html'),      tpl.paymentReminder(TEST_PENDING_REG, TEST_ATTENDEE));
    console.log('✅ Previews saved to ./email-previews/ — open in browser');
  },
};

(async () => {
  const cmd = process.argv[2] || 'verify';
  if (!cmds[cmd]) {
    console.log('Commands: verify | preview | registration | ticket | reminder | all');
    process.exit(1);
  }
  await cmds[cmd]();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
