// server/services/qr.js
'use strict';

const QRCode = require('qrcode');

const QR_OPTS = {
  errorCorrectionLevel: 'H',
  margin: 2,
  width:  400,
  color:  { dark: '#1c1814', light: '#ffffff' },
};

/** Build payload encoded inside the QR (verified at check-in kiosk) */
function buildPayload(p) {
  return JSON.stringify({
    id:    p.id,
    name:  p.name,
    event: 'MAADMAP2026',
    cat:   p.cat,
    ts:    Date.now(),
    v:     1,
  });
}

/** Returns base64 PNG string — for inline email embedding */
async function toBase64(participant) {
  return QRCode.toDataURL(buildPayload(participant), { ...QR_OPTS, type: 'image/png' });
}

/** Returns Buffer — for email attachment */
async function toBuffer(participant) {
  return QRCode.toBuffer(buildPayload(participant), { ...QR_OPTS, type: 'png' });
}

module.exports = { toBase64, toBuffer, buildPayload };
