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
  return `"${process.env.EMAIL_FROM_NAME || 'MAP Events'}" <${process.env.GMAIL_USER}>`;
}

async function verifyConnection() {
  try {
    await getTransport().verify();
    console.log('[EMAIL] ✓ SMTP OK:', process.env.GMAIL_USER);
    return { ok: true };
  } catch (e) {
    console.error('[EMAIL] ✗ SMTP failed:', e.message);
    return { ok: false, message: e.message, code: e.code, responseCode: e.responseCode, response: e.response };
  }
}

/** Sent once, immediately after registration is submitted. */
async function sendRegistrationConfirmation(reg, primary) {
  const html = tpl.registrationConfirmation(reg, primary);
  await getTransport().sendMail({
    from:    from(),
    to:      primary.email,
    replyTo: process.env.EMAIL_REPLY_TO || process.env.GMAIL_USER,
    subject: `[MMID 2027] Registration Received — ${reg.id}`,
    html,
  });
  console.log('[EMAIL] ✓ Confirmation sent:', primary.email);
}

/** Sent once per attendee, once the registration is paid/approved. */
async function sendTicketWithQR(reg, attendee) {
  const qrDataUrl = await qr.toBase64(attendee);
  const qrBuffer  = await qr.toBuffer(attendee);
  const html = tpl.ticketWithQR(reg, attendee, qrDataUrl);
  await getTransport().sendMail({
    from:    from(),
    to:      attendee.email,
    replyTo: process.env.EMAIL_REPLY_TO || process.env.GMAIL_USER,
    subject: `[MMID 2027] ✓ Your Ticket & QR Code (${reg.id})`,
    html,
    attachments: [{
      filename:    `QR-${reg.id}-${attendee.id}.png`,
      content:     qrBuffer,
      contentType: 'image/png',
    }],
  });
  console.log('[EMAIL] ✓ Ticket sent:', attendee.email);
}

/** Send tickets to every attendee on a registration (fire-and-forget per attendee). */
async function sendAllTickets(reg) {
  const results = await Promise.allSettled(
    reg.attendees.map(a => sendTicketWithQR(reg, a))
  );
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error('[EMAIL] Ticket failed:', reg.attendees[i].email, r.reason?.message);
    }
  });
}

async function sendPaymentReminder(reg, primary) {
  const html = tpl.paymentReminder(reg, primary);
  await getTransport().sendMail({
    from:    from(),
    to:      primary.email,
    replyTo: process.env.EMAIL_REPLY_TO || process.env.GMAIL_USER,
    subject: `[MMID 2027] ⏳ Payment Reminder — ${reg.id}`,
    html,
  });
  console.log('[EMAIL] ✓ Reminder sent:', primary.email);
}

async function sendReceiptRejected(reg, primary) {
  const html = tpl.receiptRejected(reg, primary);
  await getTransport().sendMail({
    from:    from(),
    to:      primary.email,
    replyTo: process.env.EMAIL_REPLY_TO || process.env.GMAIL_USER,
    subject: `[MMID 2027] Payment Receipt Not Verified — ${reg.id}`,
    html,
  });
  console.log('[EMAIL] ✓ Rejection notice sent:', primary.email);
}

module.exports = {
  verifyConnection,
  sendRegistrationConfirmation,
  sendTicketWithQR,
  sendAllTickets,
  sendPaymentReminder,
  sendReceiptRejected,
};
