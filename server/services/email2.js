// server/services/email2.js — MMID 2027 email templates
// All event values read from process.env via event-config
'use strict';

const ev = require('../event-config');

// Live event details — always fresh from env
const E = () => ({
  name:  ev.name,
  short: ev.shortName,
  date:  ev.date,
  time:  ev.time,
  venue: ev.venue,
  email: ev.email,
  url:   ev.baseUrl,
  bank:  ev.bank,
});

// ── Shared HTML wrapper ──────────────────────────────────────
const wrap = (body) => {
  const e = E();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#f4f4f6;font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1612;}
  .shell{max-width:580px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);}
  .hdr{background:#0f1e36;padding:32px;text-align:center;}
  .hdr-logo{font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;}
  .hdr-logo span{color:#3b82f6;}
  .hdr-tag{display:inline-block;margin-top:8px;background:rgba(59,130,246,0.2);border:1px solid rgba(59,130,246,0.35);border-radius:20px;padding:4px 16px;font-size:11px;font-weight:600;color:#93c5fd;letter-spacing:1.5px;text-transform:uppercase;}
  .body{padding:36px;}
  .greeting{font-size:15px;color:#3d3528;margin-bottom:20px;line-height:1.6;}
  h2{font-size:22px;font-weight:700;color:#0f1e36;margin:0 0 6px;}
  .sub{font-size:13px;color:#7a6f60;margin-bottom:24px;}
  .id-box{background:#0f1e36;border-radius:10px;padding:20px;text-align:center;margin-bottom:24px;}
  .id-lbl{font-size:10px;color:rgba(255,255,255,0.4);letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;}
  .id-val{font-size:32px;font-weight:700;color:#60a5fa;letter-spacing:4px;font-family:monospace;}
  .id-name{font-size:13px;color:rgba(255,255,255,0.6);margin-top:6px;}
  .info-card{background:#faf8f4;border:1px solid #e4ddd0;border-radius:8px;padding:18px 20px;margin-bottom:20px;}
  .info-row{display:flex;gap:12px;padding:7px 0;border-bottom:1px solid #f0ebe3;font-size:13px;}
  .info-row:last-child{border:none;}
  .info-k{color:#7a6f60;flex-shrink:0;width:120px;font-weight:500;}
  .info-v{color:#1a1612;font-weight:600;}
  .badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:0.5px;}
  .badge-paid{background:#f0f8f3;color:#1a5c35;border:1px solid rgba(26,92,53,0.2);}
  .badge-pend{background:#fdf8ed;color:#8b6914;border:1px solid rgba(139,105,20,0.2);}
  .badge-rej{background:#fdf0ef;color:#9b2c2c;border:1px solid rgba(155,44,44,0.2);}
  .btn{display:block;text-align:center;background:#3b82f6;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 28px;border-radius:8px;margin:24px 0 0;}
  .qr-wrap{text-align:center;padding:20px 0;}
  .qr-wrap img{border:6px solid #0f1e36;border-radius:8px;}
  .qr-note{font-size:11px;color:#7a6f60;margin-top:10px;}
  .event-strip{background:#faf8f4;border-top:1px solid #e4ddd0;padding:18px 20px;}
  .ev-row{font-size:12px;color:#7a6f60;padding:3px 0;}
  .ev-row span{color:#1a1612;font-weight:600;}
  .ftr{background:#0f1e36;padding:20px 32px;text-align:center;}
  .ftr p{font-size:11px;color:rgba(255,255,255,0.35);margin:4px 0;line-height:1.6;}
  .ftr a{color:rgba(255,255,255,0.5);text-decoration:none;}
</style>
</head>
<body>
<div class="shell">
<div class="hdr">
  <div class="hdr-logo">MAP <span>Events</span></div>
  <div class="hdr-tag">${e.short}</div>
</div>
${body}
<div class="ftr">
  <p>${e.name}</p>
  <p>${e.date} &nbsp;·&nbsp; ${e.venue}</p>
  <p><a href="mailto:${e.email}">${e.email}</a> &nbsp;·&nbsp; <a href="${e.url}">${e.url}</a></p>
</div>
</div>
</body>
</html>`;
};

const fmtMYR = (n) => `RM ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

// ── TEMPLATE 1: Registration Confirmation (sent to primary on submit) ──
function registrationConfirmation(reg, primary) {
  const e = E();
  const isBillplz = reg.paymentMethod === 'BILLPLZ';

  const payBlock = isBillplz
    ? (reg.billUrl
        ? `<p style="font-size:13px;color:#3d3528;line-height:1.7;margin-bottom:16px;">
             <strong>Complete payment to confirm your registration.</strong><br>
             Click below to pay via BillPlz (FPX / Online Banking / Credit Card):
           </p>
           <a class="btn" href="${reg.billUrl}">Pay ${fmtMYR(reg.totalAmount)} Now →</a>`
        : `<p style="font-size:13px;color:#8b6914;padding:12px 16px;background:#fdf8ed;border-radius:8px;border:1px solid #e4d49c;">
             Your payment link is being prepared. Reference: <strong>${reg.id}</strong>
           </p>`)
    : `<p style="font-size:13px;color:#3d3528;line-height:1.7;margin-bottom:16px;">
         <strong>Please complete a bank transfer and we'll verify it manually.</strong>
       </p>
       <div class="info-card">
         <div class="info-row"><span class="info-k">Bank</span><span class="info-v">${e.bank.bankName}</span></div>
         <div class="info-row"><span class="info-k">Account Name</span><span class="info-v">${e.bank.accountName}</span></div>
         <div class="info-row"><span class="info-k">Account No.</span><span class="info-v">${e.bank.accountNumber}</span></div>
         <div class="info-row"><span class="info-k">Amount</span><span class="info-v">${fmtMYR(reg.totalAmount)}</span></div>
       </div>
       <p style="font-size:12px;color:#8b6914;">Your uploaded receipt is under review — you'll receive your ticket(s) once approved.</p>`;

  return wrap(`
<div class="body">
  <div class="greeting">Dear ${primary.title || ''} ${primary.fullName},</div>
  <h2>Registration Received</h2>
  <p class="sub">Your registration for <strong>${e.name}</strong> has been received successfully.</p>

  <div class="id-box">
    <div class="id-lbl">Registration ID</div>
    <div class="id-val">${reg.id}</div>
    <div class="id-name">${reg.categoryLabel} &nbsp;·&nbsp; ${reg.paxCount} pax</div>
  </div>

  <div class="info-card">
    <div class="info-row"><span class="info-k">Package</span><span class="info-v">${reg.categoryLabel}</span></div>
    <div class="info-row"><span class="info-k">Total Amount</span><span class="info-v">${fmtMYR(reg.totalAmount)}</span></div>
    <div class="info-row"><span class="info-k">Payment Method</span><span class="info-v">${isBillplz ? 'Online (BillPlz)' : 'Bank Transfer'}</span></div>
  </div>

  ${payBlock}

  <div class="event-strip" style="margin-top:24px;">
    <div class="ev-row">📅 Date &nbsp;&nbsp;<span>${e.date}</span></div>
    <div class="ev-row">🕗 Time &nbsp;&nbsp;<span>${e.time}</span></div>
    <div class="ev-row">📍 Venue <span>${e.venue}</span></div>
  </div>
</div>`);
}

// ── TEMPLATE 2: Ticket with QR (sent per attendee once paid/approved) ──
function ticketWithQR(reg, attendee, qrDataUrl) {
  const e = E();
  return wrap(`
<div class="body">
  <div class="greeting">Dear ${attendee.title || ''} ${attendee.fullName},</div>
  <h2>✓ Ticket Confirmed</h2>
  <p class="sub">Your seat for <strong>${e.name}</strong> is secured.</p>

  <div class="id-box">
    <div class="id-lbl">Registration ID</div>
    <div class="id-val">${reg.id}</div>
    <div class="id-name">${reg.categoryLabel}</div>
  </div>

  <div class="info-card">
    <div class="info-row"><span class="info-k">Name</span><span class="info-v">${attendee.title || ''} ${attendee.fullName}</span></div>
    <div class="info-row"><span class="info-k">Package</span><span class="info-v">${reg.categoryLabel}</span></div>
    <div class="info-row"><span class="info-k">Food Preference</span><span class="info-v">${attendee.foodPreference}</span></div>
    <div class="info-row"><span class="info-k">Status</span><span class="info-v"><span class="badge badge-paid">✓ Paid</span></span></div>
  </div>

  <p style="font-size:13px;font-weight:600;color:#0f1e36;text-align:center;margin-bottom:12px;">
    Your QR Check-in Code
  </p>
  <div class="qr-wrap">
    ${qrDataUrl && qrDataUrl.startsWith('data:image')
      ? `<img src="${qrDataUrl}" width="200" height="200" alt="QR Code">`
      : `<p style="color:#c0392b;font-size:12px;">⚠️ QR code generation failed. Please contact ${e.email}</p>`}
    <p class="qr-note">
      📱 Show this code at the registration counter<br>
      🖨️ QR PNG is attached to this email
    </p>
  </div>

  <div class="event-strip" style="margin-top:20px;">
    <div class="ev-row">📅 Date &nbsp;&nbsp;<span>${e.date}</span></div>
    <div class="ev-row">🕗 Time &nbsp;&nbsp;<span>${e.time}</span></div>
    <div class="ev-row">📍 Venue <span>${e.venue}</span></div>
  </div>
</div>`);
}

// ── TEMPLATE 3: Payment Reminder ─────────────────────────────
function paymentReminder(reg, primary) {
  const e = E();
  return wrap(`
<div class="body">
  <div class="greeting">Dear ${primary.title || ''} ${primary.fullName},</div>
  <h2>⏳ Payment Reminder</h2>
  <p class="sub">Your registration for <strong>${e.name}</strong> is still pending payment.</p>

  <div class="id-box">
    <div class="id-lbl">Registration ID</div>
    <div class="id-val">${reg.id}</div>
    <div class="id-name"><span class="badge badge-pend">Payment Pending</span></div>
  </div>

  <div class="info-card">
    <div class="info-row"><span class="info-k">Package</span><span class="info-v">${reg.categoryLabel}</span></div>
    <div class="info-row"><span class="info-k">Amount Due</span><span class="info-v">${fmtMYR(reg.totalAmount)}</span></div>
  </div>

  <p style="font-size:13px;color:#3d3528;line-height:1.7;margin-bottom:16px;">
    Please complete payment to secure your seat. Unpaid registrations may be released closer to the event date.
  </p>

  ${reg.billUrl ? `<a class="btn" href="${reg.billUrl}">Complete Payment Now →</a>` : ''}
  <p style="font-size:11px;color:#7a6f60;margin-top:10px;text-align:center;">
    Questions? Email <a href="mailto:${e.email}">${e.email}</a>
  </p>
</div>`);
}

// ── TEMPLATE 4: Manual Receipt Rejected ──────────────────────
function receiptRejected(reg, primary) {
  const e = E();
  return wrap(`
<div class="body">
  <div class="greeting">Dear ${primary.title || ''} ${primary.fullName},</div>
  <h2>Payment Receipt Not Verified</h2>
  <p class="sub">We were unable to verify the payment receipt submitted for <strong>${e.name}</strong>.</p>

  <div class="id-box">
    <div class="id-lbl">Registration ID</div>
    <div class="id-val">${reg.id}</div>
    <div class="id-name"><span class="badge badge-rej">Receipt Rejected</span></div>
  </div>

  <p style="font-size:13px;color:#3d3528;line-height:1.7;">
    Please reply to this email with a clearer copy of your bank transfer receipt, or contact us at
    <a href="mailto:${e.email}">${e.email}</a> to resolve this.
  </p>
</div>`);
}

module.exports = { registrationConfirmation, ticketWithQR, paymentReminder, receiptRejected, fmtMYR };
