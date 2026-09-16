// server/services/qr.js
'use strict';

const QRCode = require('qrcode');

const QR_OPTS = {
  errorCorrectionLevel: 'H',
  margin: 2,
  width:  400,
  color:  { dark: '#0f1e36', light: '#ffffff' },
};

/** Build payload encoded inside the QR (verified at check-in kiosk) */
function buildPayload(attendee) {
  return JSON.stringify({
    qr:    attendee.qrHash,
    id:    attendee.registrationId,
    name:  attendee.fullName,
    event: 'MMID2027',
    v:     1,
  });
}

/** Returns base64 PNG string — for inline email embedding */
async function toBase64(attendee) {
  return QRCode.toDataURL(buildPayload(attendee), { ...QR_OPTS, type: 'image/png' });
}

/** Returns Buffer — for email attachment */
async function toBuffer(attendee) {
  return QRCode.toBuffer(buildPayload(attendee), { ...QR_OPTS, type: 'png' });
}

module.exports = { toBase64, toBuffer, buildPayload };
