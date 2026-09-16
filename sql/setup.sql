-- ═══════════════════════════════════════════════════════════════
-- MAAD JSC 2026 — MySQL Setup
-- Paste this ENTIRE file into Plesk → phpMyAdmin → SQL → Go
--
-- ⚠️  If table already exists with old ENUM values (Professional,
--     Student…) it MUST be dropped first — MySQL cannot ALTER
--     an ENUM to remove values that have existing rows.
--     Run the DROP below, then the CREATE.
-- ═══════════════════════════════════════════════════════════════

-- Step 1: Drop old table if it exists (safe — no real data yet)
DROP TABLE IF EXISTS `registrations`;

-- Step 2: Create with correct JSC 2026 categories
CREATE TABLE `registrations` (

  -- Identity
  `id`            VARCHAR(10)   NOT NULL                    COMMENT 'NX-001, NX-002 …',
  `title_prefix`  VARCHAR(30)   NOT NULL DEFAULT ''         COMMENT 'Dr, Prof, Mr, Mrs, Ms …',
  `name`          VARCHAR(255)  NOT NULL                    COMMENT 'Full name as per IC / Passport',
  `gender`        ENUM('Male','Female','Prefer not to say') DEFAULT NULL,
  `dob`           DATE          DEFAULT NULL,

  -- Identification
  `ic`            VARCHAR(20)   DEFAULT NULL                COMMENT 'MyKad: 880101-01-1234',
  `passport`      VARCHAR(30)   DEFAULT NULL                COMMENT 'For non-Malaysians',

  -- Contact
  `email`         VARCHAR(255)  NOT NULL                    COMMENT 'Unique per event',
  `phone`         VARCHAR(30)   NOT NULL                    COMMENT 'Mobile (primary)',
  `office_phone`  VARCHAR(30)   DEFAULT NULL,

  -- Organisation
  `org`           VARCHAR(255)  DEFAULT NULL,

  -- Attendance — JSC 2026 categories
  `cat`           ENUM(
                    'Member',        -- MAAD/MAP member, conference only
                    'NonMember',     -- Non-member, conference only
                    'International', -- Overseas delegate, conference only
                    'Workshop',      -- Workshop only (1 session)
                    'Combo',         -- Conference + 1 workshop, local
                    'ComboIntl',     -- Conference + 1 workshop, international
                    'VIP',           -- Invited guest
                    'Committee',     -- Organising committee
                    'Speaker'        -- Speaker / facilitator
                  ) NOT NULL,
  `fee`           DECIMAL(8,2)  NOT NULL DEFAULT 0.00,

  -- Logistics
  `diet`          VARCHAR(100)  NOT NULL DEFAULT 'Standard' COMMENT 'Food preference',
  `notes`         TEXT          DEFAULT NULL                COMMENT 'Workshop selection + extra notes',

  -- Payment
  `paid`          TINYINT(1)    NOT NULL DEFAULT 0          COMMENT '0=pending 1=paid',
  `paid_at`       DATETIME      DEFAULT NULL,
  `bill_id`       VARCHAR(100)  DEFAULT NULL                COMMENT 'BillPlz bill ID',
  `bill_url`      VARCHAR(500)  DEFAULT NULL                COMMENT 'BillPlz payment URL',

  -- Consent
  `consent_tnc`   TINYINT(1)    NOT NULL DEFAULT 0,
  `consent_pdpa`  TINYINT(1)    NOT NULL DEFAULT 0,

  -- Check-in
  `checkin`       TINYINT(1)    NOT NULL DEFAULT 0,
  `ci_mode`       VARCHAR(50)   DEFAULT NULL                COMMENT 'QR / Counter / Admin Override',
  `ci_time`       VARCHAR(20)   DEFAULT NULL                COMMENT 'Display string: 09:14 AM',
  `ci_at`         DATETIME      DEFAULT NULL,

  -- Audit
  `registered_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Constraints
  PRIMARY KEY (`id`),
  UNIQUE KEY  `uq_email`    (`email`),

  -- Indexes
  INDEX `idx_paid`     (`paid`),
  INDEX `idx_checkin`  (`checkin`),
  INDEX `idx_cat`      (`cat`),
  INDEX `idx_reg_date` (`registered_at`)

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='MAAD JSC 2026 participant registrations';

-- Step 3: Verify
SELECT 'Table created OK' AS status, COUNT(*) AS rows_now FROM `registrations`;

-- Step 4: Check ENUM values are correct
SELECT COLUMN_NAME, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME   = 'registrations'
  AND COLUMN_NAME  = 'cat';