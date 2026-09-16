// server/services/db-migrate.js
// Programmatic schema runner — reads same SQL, applies via Node.js.
// Use this OR sql/setup.sql via phpMyAdmin — not both.
//
// Usage:
//   npm run db:setup     — create table
//   npm run db:seed      — create table + demo rows
//   npm run db:reset     — drop + recreate + seed
//   npm run db:status    — show live counts
'use strict';

require('dotenv').config();
const mysql = require('mysql2/promise');

const CFG = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306', 10),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'maad_map',
};

const DDL = `
CREATE TABLE IF NOT EXISTS \`registrations\` (
  \`id\`            VARCHAR(10)  NOT NULL,
  \`title_prefix\`  VARCHAR(30)  NOT NULL DEFAULT '',
  \`name\`          VARCHAR(255) NOT NULL,
  \`gender\`        ENUM('Male','Female','Prefer not to say') DEFAULT NULL,
  \`dob\`           DATE         DEFAULT NULL,
  \`ic\`            VARCHAR(20)  DEFAULT NULL,
  \`passport\`      VARCHAR(30)  DEFAULT NULL,
  \`email\`         VARCHAR(255) NOT NULL,
  \`phone\`         VARCHAR(30)  NOT NULL,
  \`office_phone\`  VARCHAR(30)  DEFAULT NULL,
  \`org\`           VARCHAR(255) DEFAULT NULL,
  \`cat\`           ENUM('Member','NonMember','International','Workshop','Combo','ComboIntl','VIP','Committee','Speaker') NOT NULL,
  \`fee\`           DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  \`diet\`          VARCHAR(100) NOT NULL DEFAULT 'Standard',
  \`notes\`         TEXT         DEFAULT NULL,
  \`paid\`          TINYINT(1)   NOT NULL DEFAULT 0,
  \`paid_at\`       DATETIME     DEFAULT NULL,
  \`bill_id\`       VARCHAR(100) DEFAULT NULL,
  \`bill_url\`      VARCHAR(500) DEFAULT NULL,
  \`consent_tnc\`   TINYINT(1)   NOT NULL DEFAULT 0,
  \`consent_pdpa\`  TINYINT(1)   NOT NULL DEFAULT 0,
  \`checkin\`       TINYINT(1)   NOT NULL DEFAULT 0,
  \`ci_mode\`       VARCHAR(50)  DEFAULT NULL,
  \`ci_time\`       VARCHAR(20)  DEFAULT NULL,
  \`ci_at\`         DATETIME     DEFAULT NULL,
  \`registered_at\` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uq_email\` (\`email\`),
  INDEX \`idx_paid\`     (\`paid\`),
  INDEX \`idx_checkin\`  (\`checkin\`),
  INDEX \`idx_cat\`      (\`cat\`),
  INDEX \`idx_reg_date\` (\`registered_at\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const SEEDS = [
  // JSC 2026 demo seed rows — reflecting real fee categories
  { id:'NX-001', title_prefix:'Dr',   name:'Ahmad Najmi bin Ariffin', gender:'Male',   dob:'1988-01-01', ic:'880101-01-1234', email:'najmi@petronas.com',   phone:'012-3456789', org:'PETRONAS',   cat:'Member',        fee:550,  diet:'Halal',     paid:1, consent_tnc:1, consent_pdpa:1, bill_id:'BP-001', bill_url:'https://www.billplz.com/bills/nx-001' },
  { id:'NX-002', title_prefix:'Dr',   name:'Siti Rahmah binti Yusof', gender:'Female', dob:'1990-12-15', ic:'901215-03-5678', email:'siti@dosm.gov.my',     phone:'011-2345678', org:'Hospital KL', cat:'NonMember',     fee:650,  diet:'Standard',  paid:1, consent_tnc:1, consent_pdpa:1, bill_id:'BP-002', bill_url:'https://www.billplz.com/bills/nx-002' },
  { id:'NX-003', title_prefix:'Dr',   name:'Zahra Alia binti Zakaria',gender:'Female', dob:'1990-03-12', ic:'900312-06-9012', email:'zahra@ukm.edu.my',     phone:'013-9876543', org:'UKM',        cat:'Combo',         fee:800,  diet:'Vegetarian',paid:0, consent_tnc:1, consent_pdpa:1, bill_id:'BP-003', bill_url:'https://www.billplz.com/bills/nx-003' },
  { id:'NX-004', title_prefix:'Dr',   name:'Amirul Hakim bin Roslan', gender:'Male',   dob:'1992-04-05', ic:'920405-07-3456', email:'amirul@myketapang.com', phone:'017-1234567', org:'MyKetapang', cat:'Workshop',      fee:350,  diet:'Standard',  paid:1, consent_tnc:1, consent_pdpa:1, bill_id:'BP-004', bill_url:'https://www.billplz.com/bills/nx-004' },
  { id:'NX-005', title_prefix:'Prof', name:'Farouk bin Ramli',        gender:'Male',   dob:'1965-08-20', ic:'650820-11-7890', email:'farouk@uitm.edu.my',    phone:'016-8765432', org:'UiTM',       cat:'Speaker',       fee:0,    diet:'Standard',  paid:1, consent_tnc:1, consent_pdpa:1, bill_id:null,     bill_url:null },
  { id:'NX-006', title_prefix:'Dr',   name:'Sarah Mitchell',          gender:'Female', dob:'1985-07-22', ic:null,             email:'s.mitchell@imperial.ac.uk',phone:'016-0001234',org:'Imperial College', cat:'International', fee:800, diet:'Halal', paid:1, consent_tnc:1, consent_pdpa:1, bill_id:'BP-006', bill_url:'https://www.billplz.com/bills/nx-006' },
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
      const [[r]] = await conn.execute('SELECT COUNT(*) t, SUM(paid) p, SUM(checkin) c FROM registrations');
      console.log('Registrations :', Number(r.t));
      console.log('Paid          :', Number(r.p));
      console.log('Checked-in    :', Number(r.c));
      const [cats] = await conn.execute('SELECT cat, COUNT(*) n FROM registrations GROUP BY cat');
      cats.forEach(c => console.log(`  ${c.cat.padEnd(15)}`, Number(c.n)));
      return;
    }

    if (reset) {
      await conn.execute('DROP TABLE IF EXISTS `registrations`');
      console.log('[MIGRATE] Table dropped.\n');
    }

    await conn.execute(DDL);
    console.log('[MIGRATE] ✓ Table ready.');

    if (seed) {
      for (const s of SEEDS) {
        await conn.execute(`
          INSERT IGNORE INTO registrations
            (id,title_prefix,name,gender,dob,ic,email,phone,org,cat,fee,diet,paid,consent_tnc,consent_pdpa,bill_id,bill_url,registered_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
          [s.id,s.title_prefix,s.name,s.gender,s.dob,s.ic,s.email,s.phone,s.org,s.cat,s.fee,s.diet,s.paid,s.consent_tnc,s.consent_pdpa,s.bill_id,s.bill_url]
        );
        console.log(`  ✓ ${s.id} — ${s.title_prefix} ${s.name}`);
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
