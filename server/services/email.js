// server/services/email.js — nodemailer mailer (Gmail SMTP)
'use strict';

const nodemailer = require('nodemailer');
const tpl = require('./email2');
const qr  = require('./qr');

let _transport = null;

function getTransport() {
  if (_transport) return _transport;
  _transport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  return _transport;
}

function from() {
  return `"${process.env.EMAIL_FROM_NAME || 'MAAD × MAP JSC2026'}" <${process.env.GMAIL_USER}>`;
}

async function verifyConnection() {
  try {
    await getTransport().verify();
    console.log('[EMAIL] ✓ SMTP OK:', process.env.GMAIL_USER);
    return true;
  } catch (e) {
    console.error('[EMAIL] ✗ SMTP failed:', e.message);
    return false;
  }
}

async function sendRegistrationConfirmation(p) {
  const html = tpl.registrationConfirmation(p);
  await getTransport().sendMail({
    from:    from(),
    to:      p.email,
    replyTo: process.env.EMAIL_REPLY_TO || process.env.GMAIL_USER,
    subject: `[JSC 2026] Registration Received — ${p.id}`,
    html,
  });
  console.log('[EMAIL] ✓ Confirmation sent:', p.email);
}

async function sendPaymentConfirmedWithQR(p) {
  const qrDataUrl = await qr.toBase64(p);
  const qrBuffer  = await qr.toBuffer(p);
  const html = tpl.paymentConfirmedWithQR(p, qrDataUrl, qrBuffer);
  await getTransport().sendMail({
    from:    from(),
    to:      p.email,
    replyTo: process.env.EMAIL_REPLY_TO || process.env.GMAIL_USER,
    subject: `[JSC 2026] ✓ Confirmed — Your QR Code (${p.id})`,
    html,
    attachments: [{
      filename:    `QR-${p.id}.png`,
      content:     qrBuffer,
      contentType: 'image/png',
    }],
  });
  console.log('[EMAIL] ✓ QR email sent:', p.email);
}

async function sendPaymentReminder(p) {
  const html = tpl.paymentReminder(p);
  await getTransport().sendMail({
    from:    from(),
    to:      p.email,
    replyTo: process.env.EMAIL_REPLY_TO || process.env.GMAIL_USER,
    subject: `[JSC 2026] ⏳ Payment Reminder — ${p.id}`,
    html,
  });
  console.log('[EMAIL] ✓ Reminder sent:', p.email);
}

module.exports = {
  verifyConnection,
  sendRegistrationConfirmation,
  sendPaymentConfirmedWithQR,
  sendPaymentReminder,
};
