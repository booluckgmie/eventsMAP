// server/templates/emails.js
'use strict';

const E = () => ({
  name:  process.env.EVENT_NAME  || 'MAAD × MAP 2025',
  date:  process.env.EVENT_DATE  || '30 April 2025, Wednesday',
  time:  process.env.EVENT_TIME  || '8:00 AM – 5:00 PM',
  venue: process.env.EVENT_VENUE || 'Dewan Muktamar, PWTC, Kuala Lumpur',
  reply: process.env.EMAIL_REPLY_TO || 'committee@maad.org.my',
});

// ── Shared wrapper ──────────────────────────────────────────
const wrap = (body) => {
  const ev = E();
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${ev.name}</title></head>
  <body style="margin:0;padding:0;background:#f5f3ed;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ed;padding:32px 16px;">
  <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- HEADER -->
  <tr><td style="background:#1c1814;border-radius:12px 12px 0 0;padding:28px 36px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><div style="font-family:Georgia,serif;font-size:24px;color:#fff;letter-spacing:-0.5px;">
        MAAD <span style="color:#d4a017;">×</span> MAP
        <span style="font-size:14px;color:rgba(255,255,255,0.4);font-family:Helvetica;font-weight:400;"> 2025</span>
      </div>
      <div style="font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:2px;margin-top:4px;text-transform:uppercase;">
        Muzakarah Ahli Akademi Dadah
      </div></td>
      <td align="right"><div style="background:#d4a017;border-radius:5px;padding:5px 12px;font-size:10px;font-weight:700;color:#000;letter-spacing:1px;">OFFICIAL</div></td>
    </tr></table>
  </td></tr>

  <!-- BODY -->
  <tr><td style="background:#fff;padding:36px;border-left:1px solid #e8e4dc;border-right:1px solid #e8e4dc;">
    ${body}
  </td></tr>

  <!-- EVENT STRIP -->
  <tr><td style="background:#f0ede7;border:1px solid #ddd7cb;border-top:none;padding:18px 36px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="width:33%;padding-right:10px;">
        <div style="font-size:9px;color:#9a948c;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:2px;">Date</div>
        <div style="font-size:11px;font-weight:600;color:#1c1814;">${ev.date}</div>
      </td>
      <td style="width:33%;padding-right:10px;">
        <div style="font-size:9px;color:#9a948c;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:2px;">Time</div>
        <div style="font-size:11px;font-weight:600;color:#1c1814;">${ev.time}</div>
      </td>
      <td style="width:33%;">
        <div style="font-size:9px;color:#9a948c;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:2px;">Venue</div>
        <div style="font-size:11px;font-weight:600;color:#1c1814;">${ev.venue}</div>
      </td>
    </tr></table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#1c1814;border-radius:0 0 12px 12px;padding:16px 36px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:10px;color:rgba(255,255,255,0.3);">© 2025 MAAD Committee · Automated email</td>
      <td align="right" style="font-size:10px;color:rgba(255,255,255,0.3);">MAAD System v1.0</td>
    </tr></table>
  </td></tr>

  </table></td></tr></table></body></html>`;
};

// ── Helper: detail table row ────────────────────────────────
const row = (k, v) =>
  `<tr><td style="padding:6px 0;border-bottom:1px solid #ede8e0;font-size:11px;color:#9a948c;width:38%;">${k}</td>
       <td style="padding:6px 0;border-bottom:1px solid #ede8e0;font-size:12px;color:#1c1814;font-weight:500;">${v}</td></tr>`;

// ── Helper: step item ───────────────────────────────────────
const step = (n, text) =>
  `<table cellpadding="0" cellspacing="0" style="margin-bottom:8px;width:100%;"><tr>
    <td style="width:26px;vertical-align:top;">
      <div style="width:22px;height:22px;background:#1c1814;border-radius:50%;text-align:center;line-height:22px;font-size:10px;font-weight:700;color:#fff;">${n}</div>
    </td>
    <td style="padding-left:10px;font-size:12px;color:#3d3830;line-height:1.5;">${text}</td>
  </tr></table>`;

// ════════════════════════════════════════════════════════════
// TEMPLATE 1 — Registration Received (no QR, sent on submit)
// ════════════════════════════════════════════════════════════
function registrationReceived(p) {
  const ev  = E();
  const fee = p.fee > 0 ? `RM ${p.fee}` : 'Complimentary';

  const payBlock = p.fee > 0
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
        <tr><td style="background:#fdf8ec;border:1px solid rgba(184,134,11,0.2);border-radius:10px;padding:18px 22px;">
          <div style="font-size:11px;color:#9a948c;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">Next — Complete Payment</div>
          <div style="font-size:13px;color:#1c1814;margin-bottom:14px;line-height:1.6;">
            Your seat is <strong>reserved for 48 hours</strong>. Pay via BillPlz to confirm and receive your QR code.
          </div>
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:#1c1814;border-radius:7px;padding:11px 22px;">
              <a href="${p.billUrl}" style="color:#d4a017;font-size:13px;font-weight:700;text-decoration:none;">💳 &nbsp;Pay RM ${p.fee} via BillPlz →</a>
            </td>
          </tr></table>
          <div style="font-size:10px;color:#9a948c;margin-top:10px;">FPX · Online Banking · Credit/Debit Card</div>
        </td></tr>
      </table>`
    : `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
        <tr><td style="background:#f0faf4;border:1px solid rgba(39,103,73,0.2);border-radius:8px;padding:14px 18px;">
          <div style="font-size:12px;color:#276749;font-weight:600;">✓ Complimentary — no payment required</div>
          <div style="font-size:11px;color:#4a7a5a;margin-top:3px;">Your QR code will be sent separately.</div>
        </td></tr>
      </table>`;

  const body = `
    <div style="font-size:12px;color:#6b6358;margin-bottom:5px;">Dear ${p.name.split(' ')[0]},</div>
    <div style="font-family:Georgia,serif;font-size:26px;color:#1c1814;margin-bottom:3px;letter-spacing:-0.5px;">
      Registration <em style="color:#b8860b;">Received</em>
    </div>
    <div style="font-size:12px;color:#6b6358;margin-bottom:22px;line-height:1.6;">
      We've received your registration for <strong>${ev.name}</strong>.
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ed;border-radius:8px;margin-bottom:22px;">
      <tr><td style="padding:18px 20px;"><table width="100%" cellpadding="0" cellspacing="0">
        ${row('Registration ID', `<strong style="font-family:Georgia,serif;font-size:15px;color:#b8860b;letter-spacing:1px;">${p.id}</strong>`)}
        ${row('Name', p.name)}
        ${row('Email', p.email)}
        ${row('Organisation', p.org)}
        ${row('Category', p.cat)}
        ${row('Fee', fee)}
      </table></td></tr>
    </table>

    ${payBlock}

    <div style="font-size:11px;color:#9a948c;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">What's Next</div>
    ${step(1, p.fee > 0 ? 'Click the BillPlz link above and complete payment' : 'Registration confirmed — no payment needed')}
    ${step(2, 'Receive your <strong>QR code</strong> via email once payment is confirmed')}
    ${step(3, 'Present your QR code at the check-in kiosk on event day')}

    <div style="margin-top:18px;font-size:11px;color:#9a948c;line-height:1.7;">
      Questions? Reply to this email or contact <a href="mailto:${ev.reply}" style="color:#b8860b;">${ev.reply}</a>
    </div>`;

  return {
    subject: `[${ev.name}] Registration Received — ${p.id}`,
    html:    wrap(body),
  };
}

// ════════════════════════════════════════════════════════════
// TEMPLATE 2 — Payment Confirmed + QR (sent when paid)
// ════════════════════════════════════════════════════════════
function paymentConfirmed(p, qrBase64) {
  const ev = E();

  const body = `
    <div style="font-size:12px;color:#6b6358;margin-bottom:5px;">Dear ${p.name.split(' ')[0]},</div>
    <div style="font-family:Georgia,serif;font-size:26px;color:#1c1814;margin-bottom:3px;letter-spacing:-0.5px;">
      You're <em style="color:#276749;">Confirmed!</em>
    </div>
    <div style="font-size:12px;color:#6b6358;margin-bottom:22px;line-height:1.6;">
      ${p.fee > 0
        ? `Payment of <strong>RM ${p.fee}</strong> received. Your seat is confirmed.`
        : `Your complimentary registration is confirmed.`}
    </div>

    <table cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
      <tr><td style="background:#f0faf4;border:1px solid rgba(39,103,73,0.25);border-radius:20px;padding:5px 16px;">
        <span style="font-size:11px;font-weight:700;color:#276749;letter-spacing:0.5px;">
          ✓ &nbsp;PAYMENT CONFIRMED${p.fee > 0 ? ` — RM ${p.fee}` : ' — COMPLIMENTARY'}
        </span>
      </td></tr>
    </table>

    <!-- QR BOX -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1c1814;border-radius:12px;margin-bottom:22px;">
      <tr><td align="center" style="padding:24px;">
        <div style="font-size:9px;color:rgba(255,255,255,0.4);letter-spacing:3px;text-transform:uppercase;margin-bottom:14px;">Your Check-in QR Code</div>
        <div style="background:#fff;border-radius:8px;padding:14px;display:inline-block;margin-bottom:14px;">
          <img src="${qrBase64}" width="200" height="200" alt="QR — ${p.id}" style="display:block;">
        </div>
        <div style="font-family:Georgia,serif;font-size:18px;color:#d4a017;letter-spacing:3px;margin-bottom:3px;">${p.id}</div>
        <div style="font-size:12px;color:#fff;font-weight:600;margin-bottom:2px;">${p.name}</div>
        <div style="font-size:10px;color:rgba(255,255,255,0.4);">${p.cat} · ${p.org}</div>
        <div style="margin-top:14px;font-size:10px;color:rgba(255,255,255,0.3);line-height:1.6;">
          Screenshot or save this email. Present QR at check-in kiosk or counter.
        </div>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ed;border-radius:8px;margin-bottom:22px;">
      <tr><td style="padding:14px 18px;"><table width="100%" cellpadding="0" cellspacing="0">
        ${row('Registration ID', p.id)}
        ${row('Category', p.cat)}
        ${row('T-Shirt', p.tshirt || 'M')}
        ${row('Dietary', p.diet || 'Standard')}
      </table></td></tr>
    </table>

    <div style="font-size:11px;color:#9a948c;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">On Event Day</div>
    <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:6px;"><tr>
      <td style="width:22px;font-size:15px;">📱</td>
      <td style="padding-left:8px;font-size:12px;color:#3d3830;line-height:1.5;"><strong>Self Check-in:</strong> Open this email and scan QR at the kiosk</td>
    </tr></table>
    <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:6px;"><tr>
      <td style="width:22px;font-size:15px;">🖨️</td>
      <td style="padding-left:8px;font-size:12px;color:#3d3830;line-height:1.5;"><strong>Print:</strong> Print this email and present at the counter</td>
    </tr></table>
    <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:16px;"><tr>
      <td style="width:22px;font-size:15px;">🆔</td>
      <td style="padding-left:8px;font-size:12px;color:#3d3830;line-height:1.5;"><strong>Backup:</strong> If QR fails, give your ID — <strong>${p.id}</strong></td>
    </tr></table>

    <div style="padding:11px 14px;background:#fdf8ec;border-radius:7px;font-size:11px;color:#9a948c;line-height:1.6;">
      ⚠️ This QR code is personal and unique. Do not share it.
    </div>`;

  return {
    subject: `[${ev.name}] ✓ Confirmed — Your QR Code (${p.id})`,
    html:    wrap(body),
  };
}

// ════════════════════════════════════════════════════════════
// TEMPLATE 3 — Payment Reminder (manual batch or cron)
// ════════════════════════════════════════════════════════════
function paymentReminder(p) {
  const ev = E();

  const body = `
    <div style="font-size:12px;color:#6b6358;margin-bottom:5px;">Dear ${p.name.split(' ')[0]},</div>
    <div style="font-family:Georgia,serif;font-size:26px;color:#1c1814;margin-bottom:3px;letter-spacing:-0.5px;">
      Payment <em style="color:#b8860b;">Reminder</em>
    </div>
    <div style="font-size:12px;color:#6b6358;margin-bottom:22px;line-height:1.6;">
      Your registration for <strong>${ev.name}</strong> is still pending payment.
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
      <tr><td style="background:#fff8ec;border-left:4px solid #d4a017;border-radius:0 8px 8px 0;padding:12px 16px;">
        <div style="font-size:12px;color:#7a5c00;font-weight:600;">⏳ &nbsp;${p.id} — Payment Pending</div>
        <div style="font-size:11px;color:#9a7020;margin-top:3px;">Amount due: <strong>RM ${p.fee}</strong></div>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
      <tr><td align="center" style="background:#1c1814;border-radius:10px;padding:22px;">
        <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:12px;letter-spacing:1px;">COMPLETE PAYMENT VIA BILLPLZ</div>
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="background:#d4a017;border-radius:7px;padding:12px 26px;">
            <a href="${p.billUrl}" style="color:#000;font-size:14px;font-weight:700;text-decoration:none;">💳 &nbsp;Pay RM ${p.fee} Now →</a>
          </td>
        </tr></table>
        <div style="font-size:10px;color:rgba(255,255,255,0.3);margin-top:10px;">FPX · Online Banking · Credit/Debit Card</div>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
      <tr><td style="background:#fff5f5;border:1px solid rgba(155,44,44,0.15);border-radius:7px;padding:12px 16px;font-size:11px;color:#7a2020;line-height:1.6;">
        If payment is not completed before the event, your seat may be released.
      </td></tr>
    </table>

    <div style="font-size:11px;color:#9a948c;line-height:1.7;">
      Already paid? Ignore this — system may take a few minutes to update.<br>
      Issues? Contact <a href="mailto:${ev.reply}" style="color:#b8860b;">${ev.reply}</a>
    </div>`;

  return {
    subject: `[${ev.name}] ⏳ Payment Reminder — ${p.id} (RM ${p.fee} due)`,
    html:    wrap(body),
  };
}

module.exports = { registrationReceived, paymentConfirmed, paymentReminder };
