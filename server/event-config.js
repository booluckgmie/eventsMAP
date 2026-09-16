// server/event-config.js
// ─────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH — all event values live here.
// Change .env in Plesk → restart → entire system updates.
// Never hardcode event data in routes, emails, or frontend.
// ─────────────────────────────────────────────────────────────
'use strict';

const config = {

  // ── Identity ────────────────────────────────────────────────
  name:      process.env.EVENT_NAME    || 'MAAD × MAP Joint Scientific Conference 2026',
  shortName: process.env.EVENT_SHORT   || 'JSC 2026',
  date:      process.env.EVENT_DATE    || 'July 2026',
  time:      process.env.EVENT_TIME    || '8:00 AM – 5:00 PM',
  venue:     process.env.EVENT_VENUE   || 'Kuala Lumpur, Malaysia',
  capacity:  parseInt(process.env.EVENT_CAPACITY || '500', 10),
  email:     process.env.EVENT_EMAIL   || 'maadkl@yahoo.com',
  baseUrl:   process.env.FRONTEND_URL  || 'https://events.maad.com.my',

  // ── Fee schedule (MYR) ───────────────────────────────────────
  fees: {
    // Conference only
    Member:        parseInt(process.env.FEE_MEMBER        || '550',  10),
    NonMember:     parseInt(process.env.FEE_NON_MEMBER    || '650',  10),
    International: parseInt(process.env.FEE_INTERNATIONAL || '800',  10),
    // Group: RM 500 per person (min 5) — total computed at registration time
    Group:         parseInt(process.env.FEE_GROUP         || '500',  10),
    // Workshop only (no conference)
    Workshop:      parseInt(process.env.FEE_WORKSHOP      || '350',  10),  // 1 workshop
    Workshop2:     parseInt(process.env.FEE_WORKSHOP2     || '600',  10),  // 2 workshops
    // Combo: Conference + workshops — local
    Combo:         parseInt(process.env.FEE_COMBO         || '800',  10),  // conf + 1ws
    Combo2:        parseInt(process.env.FEE_COMBO2        || '1000', 10),  // conf + 2ws
    // Combo: Conference + workshops — international
    ComboIntl:     parseInt(process.env.FEE_COMBO_INTL    || '1000', 10),  // conf + 1ws intl
    Combo2Intl:    parseInt(process.env.FEE_COMBO2_INTL   || '1200', 10),  // conf + 2ws intl
    // Complimentary
    VIP:           0,
    Committee:     0,
    Speaker:       0,
  },

  // ── Workshops ─────────────────────────────────────────────────
  workshops: [
    { id: 'WS01', speaker: 'Dr Suzuki',   topic: 'Endodontics',      slot: 'A' },
    { id: 'WS02', speaker: 'Dr Joan Lim', topic: 'Composite',        slot: 'B' },
    { id: 'WS03', speaker: 'Prof Haikal', topic: 'Semi-Direct',      slot: 'A' },
    { id: 'WS04', speaker: 'Dr Ilyani',   topic: 'Endodontics',      slot: 'B' },
    { id: 'WS05', speaker: 'Dr Ian Ho',   topic: 'Implant Digital',  slot: 'B' },
  ],

  // ── BillPlz ───────────────────────────────────────────────────
  billplz: {
    collectionId: process.env.BILLPLZ_COLLECTION_ID || 'JSCMAP2026',
    sandbox:      process.env.BILLPLZ_SANDBOX === 'true' || process.env.BILLPLZ_SANDBOX === '1',
    baseUrl:      process.env.BILLPLZ_SANDBOX === 'true' || process.env.BILLPLZ_SANDBOX === '1'
      ? 'https://www.billplz-sandbox.com/bills'
      : 'https://www.billplz.com/bills',
  },
};

module.exports = config;