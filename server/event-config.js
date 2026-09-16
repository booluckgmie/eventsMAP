// server/event-config.js
// ─────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH — all event values live here.
// Change .env → restart → entire system updates.
// Never hardcode event data in routes, emails, or frontend.
// ─────────────────────────────────────────────────────────────
'use strict';

const config = {

  // ── Identity ────────────────────────────────────────────────
  name:      process.env.EVENT_NAME    || 'Mastering Modern Implant Dentistry',
  shortName: process.env.EVENT_SHORT   || 'MMID 2027',
  date:      process.env.EVENT_DATE    || '18 - 19 January 2027',
  time:      process.env.EVENT_TIME    || '09:00 - 17:00 Daily',
  venue:     process.env.EVENT_VENUE   || 'The Dental Academy, Kuala Lumpur, Malaysia',
  capacity:  parseInt(process.env.EVENT_CAPACITY || '150', 10),
  email:     process.env.EVENT_EMAIL   || 'maprostho@gmail.com',
  baseUrl:   process.env.FRONTEND_URL  || 'https://events.maprostho.com.my',

  // ── Pricing matrix (MYR) ──────────────────────────────────────
  // packageType -> tierKey -> { label, amount, pax, isGroup }
  pricing: {
    LECTURE_ONLY: {
      MAP_SINGLE:       { label: 'Lecture Only - MAP Member',             amount: parseInt(process.env.FEE_MEMBER        || '400',  10), pax: 1, isGroup: false },
      NON_MAP_SINGLE:   { label: 'Lecture Only - Non Member',             amount: parseInt(process.env.FEE_NON_MEMBER    || '500',  10), pax: 1, isGroup: false },
      MAP_GROUP_5:      { label: 'Lecture Only - Group of 5 (MAP)',       amount: parseInt(process.env.FEE_GROUP_MAP     || '1800', 10), pax: 5, isGroup: true },
      NON_MAP_GROUP_5:  { label: 'Lecture Only - Group of 5 (Non Member)',amount: parseInt(process.env.FEE_GROUP_NON_MAP || '2000', 10), pax: 5, isGroup: true },
    },
    COMBO: {
      MAP_SINGLE:       { label: 'Combo Lecture & Hands-On - MAP Member',              amount: parseInt(process.env.FEE_COMBO_MEMBER       || '1000', 10), pax: 1, isGroup: false },
      NON_MAP_SINGLE:   { label: 'Combo Lecture & Hands-On - Non Member',              amount: parseInt(process.env.FEE_COMBO_NON_MEMBER   || '1200', 10), pax: 1, isGroup: false },
      MAP_GROUP_5:      { label: 'Combo Lecture & Hands-On - Group of 5 (MAP)',        amount: parseInt(process.env.FEE_COMBO_GROUP_MAP     || '4500', 10), pax: 5, isGroup: true },
      NON_MAP_GROUP_5:  { label: 'Combo Lecture & Hands-On - Group of 5 (Non Member)', amount: parseInt(process.env.FEE_COMBO_GROUP_NON_MAP || '5000', 10), pax: 5, isGroup: true },
    },
  },

  // ── Bank details for manual transfer ──────────────────────────
  bank: {
    accountName:   process.env.BANK_ACCOUNT_NAME   || 'Malaysian Association for Prosthodontics',
    accountNumber: process.env.BANK_ACCOUNT_NUMBER || '3168508600',
    bankName:      process.env.BANK_NAME           || 'Public Bank Berhad',
    branch:        process.env.BANK_BRANCH         || 'Bukit Damansara',
    swiftCode:     process.env.BANK_SWIFT          || 'PBBEMYKL',
  },

  // ── BillPlz ───────────────────────────────────────────────────
  billplz: {
    collectionId: process.env.BILLPLZ_COLLECTION_ID || 'MMID2027',
    sandbox:      process.env.BILLPLZ_SANDBOX === 'true' || process.env.BILLPLZ_SANDBOX === '1',
    baseUrl:      process.env.BILLPLZ_SANDBOX === 'true' || process.env.BILLPLZ_SANDBOX === '1'
      ? 'https://www.billplz-sandbox.com/bills'
      : 'https://www.billplz.com/bills',
  },
};

/** Look up a pricing tier by packageType + membership + regMode. Throws if invalid. */
function getTier(packageType, membership, regMode) {
  const pkg = config.pricing[packageType];
  if (!pkg) throw new Error(`Invalid package type: ${packageType}`);
  const isGroup = regMode === 'GROUP';
  const tierKey = isGroup
    ? (membership === 'MAP_MEMBER' ? 'MAP_GROUP_5' : 'NON_MAP_GROUP_5')
    : (membership === 'MAP_MEMBER' ? 'MAP_SINGLE'  : 'NON_MAP_SINGLE');
  const tier = pkg[tierKey];
  if (!tier) throw new Error(`Invalid pricing tier: ${packageType}/${tierKey}`);
  return { tierKey, ...tier };
}

module.exports = { ...config, getTier };
