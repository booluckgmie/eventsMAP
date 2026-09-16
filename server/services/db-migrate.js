// server/services/db-migrate.js
// Programmatic schema runner — reads same SQL, applies via Node.js.
//
// Usage:
//   npm run db:setup     — create tables
//   npm run db:seed      — create tables + demo rows
//   npm run db:reset     — drop + recreate + seed
//   npm run db:status    — show live counts
'use strict';

require('dotenv').config();
const mysql = require('mysql2/promise');
const crypto = require('crypto');

const CFG = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306', 10),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'maad_map',
};

const DDL_REGISTRATIONS = `
CREATE TABLE IF NOT EXISTS \`registrations\` (
  \`id\`              VARCHAR(16)  NOT NULL,
  \`reg_mode\`        ENUM('SINGLE','GROUP') NOT NULL DEFAULT 'SINGLE',
  \`package_type\`    ENUM('LECTURE_ONLY','COMBO') NOT NULL,
  \`membership\`      ENUM('MAP_MEMBER','NON_MEMBER') NOT NULL,
  \`tier_key\`        VARCHAR(30)  NOT NULL,
  \`category_label\`  VARCHAR(150) NOT NULL,
  \`pax_count\`       INT          NOT NULL DEFAULT 1,
  \`total_amount\`    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  \`payment_method\`  ENUM('BILLPLZ','MANUAL_RECEIPT') NOT NULL DEFAULT 'BILLPLZ',
  \`paid\`            TINYINT(1)   NOT NULL DEFAULT 0,
  \`paid_at\`         DATETIME     DEFAULT NULL,
  \`bill_id\`         VARCHAR(100) DEFAULT NULL,
  \`bill_url\`        VARCHAR(500) DEFAULT NULL,
  \`receipt_data\`     LONGTEXT     DEFAULT NULL,
  \`receipt_mime\`     VARCHAR(100) DEFAULT NULL,
  \`receipt_filename\` VARCHAR(255) DEFAULT NULL,
  \`receipt_status\`  ENUM('PENDING','APPROVED','REJECTED') DEFAULT NULL,
  \`consent_tnc\`     TINYINT(1)   NOT NULL DEFAULT 0,
  \`consent_pdpa\`    TINYINT(1)   NOT NULL DEFAULT 0,
  \`registered_at\`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  INDEX \`idx_paid\`       (\`paid\`),
  INDEX \`idx_package\`    (\`package_type\`),
  INDEX \`idx_receipt\`    (\`receipt_status\`),
  INDEX \`idx_reg_date\`   (\`registered_at\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const DDL_ATTENDEES = `
CREATE TABLE IF NOT EXISTS \`attendees\` (
  \`id\`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`registration_id\`  VARCHAR(16)  NOT NULL,
  \`is_primary\`       TINYINT(1)   NOT NULL DEFAULT 0,
  \`title\`            VARCHAR(30)  NOT NULL DEFAULT '',
  \`full_name\`        VARCHAR(255) NOT NULL,
  \`nric_passport\`    VARCHAR(30)  NOT NULL,
  \`email\`            VARCHAR(255) NOT NULL,
  \`phone_mobile\`     VARCHAR(30)  DEFAULT NULL,
  \`phone_office\`     VARCHAR(30)  DEFAULT NULL,
  \`institution\`      VARCHAR(255) DEFAULT NULL,
  \`address_practice\` TEXT         DEFAULT NULL,
  \`mdc_no\`           VARCHAR(50)  DEFAULT NULL,
  \`food_preference\`  VARCHAR(100) NOT NULL DEFAULT 'Non-vegetarian',
  \`qr_hash\`          VARCHAR(64)  NOT NULL,
  \`checked_in\`       TINYINT(1)   NOT NULL DEFAULT 0,
  \`ci_mode\`          VARCHAR(50)  DEFAULT NULL,
  \`ci_at\`            DATETIME     DEFAULT NULL,
  \`created_at\`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uq_qr_hash\` (\`qr_hash\`),
  INDEX \`idx_registration\` (\`registration_id\`),
  INDEX \`idx_checked_in\`   (\`checked_in\`),
  CONSTRAINT \`fk_attendees_registration\` FOREIGN KEY (\`registration_id\`)
    REFERENCES \`registrations\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

function qrHash(regId, idx) {
  return crypto.createHash('sha256').update(`${regId}-${idx}-${Date.now()}-${Math.random()}`).digest('hex').slice(0, 24);
}

const SEEDS = [
  {
    reg: {
      id: 'MMID27-1001', reg_mode: 'SINGLE', package_type: 'COMBO', membership: 'MAP_MEMBER',
      tier_key: 'MAP_SINGLE', category_label: 'Combo Lecture & Hands-On - MAP Member',
      pax_count: 1, total_amount: 1000.00, payment_method: 'BILLPLZ',
      paid: 1, bill_id: 'BILL-883210', bill_url: 'https://www.billplz.com/bills/883210',
      consent_tnc: 1, consent_pdpa: 1,
    },
    attendees: [
      { is_primary: 1, title: 'Dr', full_name: 'LIM WEI JIE', nric_passport: '890412-10-5431', email: 'limwj@dentistry.com', phone_mobile: '+60123456789', phone_office: '+60379561122', institution: 'Gleneagles KL', address_practice: 'Suite 4-1, Gleneagles Medical Centre, Jalan Ampang, KL', mdc_no: 'MDC-88421', food_preference: 'Non-vegetarian' },
    ],
  },
  {
    reg: {
      id: 'MMID27-1002', reg_mode: 'GROUP', package_type: 'LECTURE_ONLY', membership: 'NON_MEMBER',
      tier_key: 'NON_MAP_GROUP_5', category_label: 'Lecture Only - Group of 5 (Non Member)',
      pax_count: 5, total_amount: 2000.00, payment_method: 'MANUAL_RECEIPT',
      paid: 0, receipt_status: 'PENDING',
      consent_tnc: 1, consent_pdpa: 1,
    },
    attendees: [
      { is_primary: 1, title: 'Dato', full_name: 'DATO DR SITI AMINAH BINTI ZAIN', nric_passport: '780101-14-6020', email: 'siti.aminah@kualalumpurdental.com', phone_mobile: '+60198882345', phone_office: '+60321458899', institution: 'Bangsar Dental Specialist', address_practice: 'Bangsar Dental Specialist, Jalan Telawi 3, Bangsar', mdc_no: 'MDC-44210', food_preference: 'Vegetarian' },
      { is_primary: 0, title: 'Dr', full_name: 'DR TAN KIAN HENG', nric_passport: '920304-07-5511', email: 'tan.kh@kualalumpurdental.com', phone_mobile: '+60173322110', phone_office: null, institution: 'Bangsar Dental Specialist', address_practice: null, mdc_no: 'MDC-90112', food_preference: 'Non-vegetarian' },
    ],
  },
];

async function main() {
  const [reset, seed, status] = [
    process.argv.includes('--reset'),
    process.argv.includes('--seed') || process.argv.includes('--reset'),
    process.argv.includes('--status'),
  ];

  let conn;
  try {
    conn = await mysql.createConnection(CFG);
    console.log(`\n[MIGRATE] Connected → ${CFG.host}/${CFG.database}\n`);

    if (status) {
      const [[r]] = await conn.execute('SELECT COUNT(*) t, SUM(paid) p FROM registrations');
      const [[a]] = await conn.execute('SELECT COUNT(*) t, SUM(checked_in) c FROM attendees');
      console.log('Registrations :', Number(r.t));
      console.log('Paid          :', Number(r.p) || 0);
      console.log('Attendees     :', Number(a.t));
      console.log('Checked-in    :', Number(a.c) || 0);
      const [pkgs] = await conn.execute('SELECT package_type, COUNT(*) n FROM registrations GROUP BY package_type');
      pkgs.forEach(p => console.log(`  ${p.package_type.padEnd(15)}`, Number(p.n)));
      return;
    }

    if (reset) {
      await conn.execute('DROP TABLE IF EXISTS `attendees`');
      await conn.execute('DROP TABLE IF EXISTS `registrations`');
      console.log('[MIGRATE] Tables dropped.\n');
    }

    await conn.execute(DDL_REGISTRATIONS);
    await conn.execute(DDL_ATTENDEES);
    console.log('[MIGRATE] ✓ Tables ready.');

    if (seed) {
      for (const s of SEEDS) {
        const r = s.reg;
        await conn.execute(`
          INSERT IGNORE INTO registrations
            (id,reg_mode,package_type,membership,tier_key,category_label,pax_count,total_amount,
             payment_method,paid,bill_id,bill_url,receipt_status,consent_tnc,consent_pdpa,
             registered_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?, ?,?,?,?,?,?,?, NOW(),NOW())`,
          [r.id, r.reg_mode, r.package_type, r.membership, r.tier_key, r.category_label, r.pax_count, r.total_amount,
           r.payment_method, r.paid || 0, r.bill_id || null, r.bill_url || null,
           r.receipt_status || null, r.consent_tnc, r.consent_pdpa]
        );
        for (const a of s.attendees) {
          await conn.execute(`
            INSERT INTO attendees
              (registration_id,is_primary,title,full_name,nric_passport,email,phone_mobile,phone_office,
               institution,address_practice,mdc_no,food_preference,qr_hash,checked_in,created_at)
            VALUES (?,?,?,?,?,?,?,?, ?,?,?,?,?,?, NOW())`,
            [r.id, a.is_primary, a.title, a.full_name, a.nric_passport, a.email, a.phone_mobile, a.phone_office,
             a.institution, a.address_practice, a.mdc_no, a.food_preference, qrHash(r.id, a.full_name), 0]
          );
        }
        console.log(`  ✓ ${r.id} — ${s.attendees.length} attendee(s)`);
      }
    }

    console.log('\n[MIGRATE] ✅ Done. Run: npm run dev\n');

  } catch (e) {
    console.error('\n[MIGRATE] ✗', e.message);
    if (e.code === 'ER_ACCESS_DENIED_ERROR') console.error('  → Wrong DB_USER or DB_PASSWORD');
    if (e.code === 'ECONNREFUSED')           console.error('  → MySQL is not running');
    if (e.code === 'ER_BAD_DB_ERROR')        console.error(`  → Database "${CFG.database}" does not exist yet`);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

main();
