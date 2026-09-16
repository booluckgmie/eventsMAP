// server/templates/emails.js — JSC 2026
// All event values read from process.env via event-config
'use strict';

// Live event details — always fresh from env
const E = () => ({
  name:  process.env.EVENT_NAME    || 'MAAD × MAP Joint Scientific Conference 2026',
  short: process.env.EVENT_SHORT   || 'JSC 2026',
  date:  process.env.EVENT_DATE    || 'July 2026',
  time:  process.env.EVENT_TIME    || '8:00 AM – 5:00 PM',
  venue: process.env.EVENT_VENUE   || 'Kuala Lumpur, Malaysia',
  email: process.env.EVENT_EMAIL   || 'maadkl@yahoo.com',
  url:   process.env.FRONTEND_URL  || 'https://events.maad.com.my',
});

// ── Shared HTML wrapper ──────────────────────────────────────
const wrap = (body) => {
  const ev = E();
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
  .hdr-logo span{color:#e0c068;}
  .hdr-tag{display:inline-block;margin-top:8px;background:rgba(200,168,75,0.2);border:1px solid rgba(200,168,75,0.35);border-radius:20px;padding:4px 16px;font-size:11px;font-weight:600;color:#e0c068;letter-spacing:1.5px;text-transform:uppercase;}
  .body{padding:36px;}
  .greeting{font-size:15px;color:#3d3528;margin-bottom:20px;line-height:1.6;}
  h2{font-size:22px;font-weight:700;color:#0f1e36;margin:0 0 6px;}
  .sub{font-size:13px;color:#7a6f60;margin-bottom:24px;}
  .id-box{background:#0f1e36;border-radius:10px;padding:20px;text-align:center;margin-bottom:24px;}
  .id-lbl{font-size:10px;color:rgba(255,255,255,0.4);letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;}
  .id-val{font-size:32px;font-weight:700;color:#e0c068;letter-spacing:4px;font-family:monospace;}
  .id-name{font-size:13px;color:rgba(255,255,255,0.6);margin-top:6px;}
  .info-card{background:#faf8f4;border:1px solid #e4ddd0;border-radius:8px;padding:18px 20px;margin-bottom:20px;}
  .info-row{display:flex;gap:12px;padding:7px 0;border-bottom:1px solid #f0ebe3;font-size:13px;}
  .info-row:last-child{border:none;}
  .info-k{color:#7a6f60;flex-shrink:0;width:110px;font-weight:500;}
  .info-v{color:#1a1612;font-weight:600;}
  .badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:0.5px;}
  .badge-paid{background:#f0f8f3;color:#1a5c35;border:1px solid rgba(26,92,53,0.2);}
  .badge-pend{background:#fdf8ed;color:#8b6914;border:1px solid rgba(139,105,20,0.2);}
  .btn{display:block;text-align:center;background:#c8a84b;color:#0f1e36;text-decoration:none;font-weight:700;font-size:14px;padding:14px 28px;border-radius:8px;margin:24px 0 0;}
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
  <div class="hdr-logo">MAAD <span>×</span> MAP</div>
  <div class="hdr-tag">${ev.short}</div>
</div>
${body}
<div class="ftr">
  <p>${ev.name}</p>
  <p>${ev.date} &nbsp;·&nbsp; ${ev.venue}</p>
  <p><a href="mailto:${ev.email}">${ev.email}</a> &nbsp;·&nbsp; <a href="${ev.url}">${ev.url}</a></p>
</div>
</div>
</body>
</html>`;
};

// ── Helpers ──────────────────────────────────────────────────
const catLabel = (cat) => ({
  Member:        'MAAD/MAP Member (Conference)',
  NonMember:     'Non-Member (Conference)',
  International: 'International Delegate (Conference)',
  Workshop:      'Workshop Only',
  Combo:         'Conference + Workshop (Local)',
  ComboIntl:     'Conference + Workshop (International)',
  VIP:           'Invited Guest / VIP',
  Committee:     'Organising Committee',
  Speaker:       'Speaker / Facilitator',
}[cat] || cat);

const fmtFee = (fee) =>
  fee > 0 ? `RM ${fee.toLocaleString()}` : 'Complimentary';

// ── TEMPLATE 1: Registration Confirmation ────────────────────
function registrationConfirmation(p) {
  const ev  = E();
  const isPaid = p.fee === 0;
  return wrap(`
<div class="body">
  <div class="greeting">Dear ${p.titlePrefix || ''} ${p.name},</div>
  <h2>Registration Received</h2>
  <p class="sub">Your registration for <strong>${ev.name}</strong> has been received successfully.</p>

  <div class="id-box">
    <div class="id-lbl">Registration ID</div>
    <div class="id-val">${p.id}</div>
    <div class="id-name">${p.titlePrefix || ''} ${p.name} &nbsp;·&nbsp; ${p.email}</div>
  </div>

  <div class="info-card">
    <div class="info-row"><span class="info-k">Category</span><span class="info-v">${catLabel(p.cat)}</span></div>
    ${p.notes && p.notes.includes('Workshop:') ? `<div class="info-row"><span class="info-k">Workshop</span><span class="info-v">${p.notes.split('Workshop:')[1].split('|')[0].trim()}</span></div>` : ''}
    <div class="info-row"><span class="info-k">Fee</span><span class="info-v">${fmtFee(p.fee)}</span></div>
    <div class="info-row"><span class="info-k">Status</span><span class="info-v"><span class="badge ${isPaid ? 'badge-paid' : 'badge-pend'}">${isPaid ? '✓ Confirmed' : '⏳ Payment Pending'}</span></span></div>
    <div class="info-row"><span class="info-k">Organisation</span><span class="info-v">${p.org || '—'}</span></div>
  </div>

  ${!isPaid ? `
  <p style="font-size:13px;color:#3d3528;line-height:1.7;margin-bottom:16px;">
    <strong>Complete payment to confirm your seat.</strong><br>
    Click the button below to proceed with BillPlz payment (FPX / Online Banking / Credit Card):
  </p>
  ${p.billUrl
    ? `<a class="btn" href="${p.billUrl}" style="background:#c8a84b;color:#0f1e36;">Pay Now — ${fmtFee(p.fee)} →</a>
       <p style="font-size:11px;color:#7a6f60;margin-top:10px;text-align:center;">
         Direct link: <a href="${p.billUrl}">${p.billUrl}</a>
       </p>`
    : `<p style="font-size:13px;color:#8b6914;padding:12px 16px;background:#fdf8ed;border-radius:8px;border:1px solid #e4d49c;">
         Your payment link is being prepared. The committee will send it shortly.<br>
         Reference: <strong>${p.id}</strong>
       </p>`
  }
  ` : `
  <p style="font-size:13px;color:#1a5c35;line-height:1.7;">
    ✅ Your registration is confirmed. Your QR check-in code will be emailed separately.
  </p>
  `}

  <div class="event-strip" style="margin-top:24px;">
    <div class="ev-row">📅 Date &nbsp;&nbsp;<span>${ev.date}</span></div>
    <div class="ev-row">🕗 Time &nbsp;&nbsp;<span>${ev.time}</span></div>
    <div class="ev-row">📍 Venue <span>${ev.venue}</span></div>
  </div>
</div>`);
}

// ── TEMPLATE 2: Payment Confirmed + QR ───────────────────────
function paymentConfirmedWithQR(p, qrDataUrl, qrBuffer) {
  const ev = E();
  return wrap(`
<div class="body">
  <div class="greeting">Dear ${p.titlePrefix || ''} ${p.name},</div>
  <h2>✓ Payment Confirmed</h2>
  <p class="sub">Your seat for <strong>${ev.name}</strong> is secured.</p>

  <div class="id-box">
    <div class="id-lbl">Registration ID</div>
    <div class="id-val">${p.id}</div>
    <div class="id-name">${catLabel(p.cat)}</div>
  </div>

  <div class="info-card">
    <div class="info-row"><span class="info-k">Name</span><span class="info-v">${p.titlePrefix || ''} ${p.name}</span></div>
    <div class="info-row"><span class="info-k">Category</span><span class="info-v">${catLabel(p.cat)}</span></div>
    ${p.notes && p.notes.includes('Workshop:') ? `<div class="info-row"><span class="info-k">Workshop</span><span class="info-v">${p.notes.split('Workshop:')[1].split('|')[0].trim()}</span></div>` : ''}
    <div class="info-row"><span class="info-k">Amount Paid</span><span class="info-v">${fmtFee(p.fee)}</span></div>
    <div class="info-row"><span class="info-k">Status</span><span class="info-v"><span class="badge badge-paid">✓ Paid</span></span></div>
  </div>

  <p style="font-size:13px;font-weight:600;color:#0f1e36;text-align:center;margin-bottom:12px;">
    Your QR Check-in Code
  </p>
	<div class="qr-wrap">
	  ${qrDataUrl && qrDataUrl.startsWith('data:image') ? 
		`<img src="${qrDataUrl}" width="200" height="200" alt="QR Code" style="border:2px solid #0f1e36; border-radius:12px; padding:8px; background:#ffffff;">` : 
		'<p style="color:#c0392b; font-size:12px;">⚠️ QR code generation failed. Please contact registration@maad.com.my</p>'
	  }
	  <p class="qr-note" style="font-size:11px; color:#7a6f60; margin-top:12px;">
		📱 Show this code at the registration counter<br>
		🖨️ QR PNG is attached to this email
	  </p>
	</div>

  <div class="event-strip" style="margin-top:20px;">
    <div class="ev-row">📅 Date &nbsp;&nbsp;<span>${ev.date}</span></div>
    <div class="ev-row">🕗 Time &nbsp;&nbsp;<span>${ev.time}</span></div>
    <div class="ev-row">📍 Venue <span>${ev.venue}</span></div>
  </div>
</div>`);
}

// ── TEMPLATE 3: Payment Reminder ─────────────────────────────
function paymentReminder(p) {
  const ev = E();
  return wrap(`
<div class="body">
  <div class="greeting">Dear ${p.titlePrefix || ''} ${p.name},</div>
  <h2>⏳ Payment Reminder</h2>
  <p class="sub">Your registration for <strong>${ev.name}</strong> is still pending payment.</p>

  <div class="id-box">
    <div class="id-lbl">Registration ID</div>
    <div class="id-val">${p.id}</div>
    <div class="id-name"><span class="badge badge-pend">Payment Pending</span></div>
  </div>

  <div class="info-card">
    <div class="info-row"><span class="info-k">Category</span><span class="info-v">${catLabel(p.cat)}</span></div>
    <div class="info-row"><span class="info-k">Amount Due</span><span class="info-v">${fmtFee(p.fee)}</span></div>
  </div>

  <p style="font-size:13px;color:#3d3528;line-height:1.7;margin-bottom:16px;">
    Please complete payment to secure your seat. Unpaid registrations may be released closer to the event date.
  </p>

  <a class="btn" href="${p.billUrl}">Complete Payment Now →</a>
  <p style="font-size:11px;color:#7a6f60;margin-top:10px;text-align:center;">
    Questions? Email <a href="mailto:${ev.email}">${ev.email}</a>
  </p>
</div>`);
}

module.exports = { registrationConfirmation, paymentConfirmedWithQR, paymentReminder, catLabel, fmtFee };