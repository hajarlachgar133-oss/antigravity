-- ==============================================================
-- NexusIT ITSM Platform — MySQL Database Schema
-- Version : 1.0
-- Created  : 2026-04-10
-- Charset  : utf8mb4 (full Unicode + emoji support)
-- ==============================================================

-- ────────────────────────────────────────────────────────────────
-- 0. CREATE & SELECT THE DATABASE
-- ────────────────────────────────────────────────────────────────
CREATE DATABASE IF NOT EXISTS nexusit_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE nexusit_db;

-- ────────────────────────────────────────────────────────────────
-- 1. USERS  (employees + admin accounts)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(180) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL, -- bcrypt / argon2 hash
    role ENUM('admin', 'employee') NOT NULL DEFAULT 'employee',
    department VARCHAR(80) DEFAULT NULL,
    avatar_initials CHAR(2) DEFAULT NULL, -- e.g. 'AB'
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_users_email (email),
    KEY idx_users_role (role)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Default admin account (password: admin123 — CHANGE IN PRODUCTION)
INSERT INTO
    users (
        full_name,
        email,
        password_hash,
        role,
        department,
        avatar_initials
    )
VALUES (
        'Admin User',
        'admin@nexusit.com',
        '$2y$10$D7VXXA4WQgAT8MdUFV9Vg.XTsQxH7CKpc6jhY16xeIvy5FYbfrjJ.', -- bcrypt of 'admin123' (fixed format)
        'admin',
        'IT Department',
        'AU'
    );

-- ────────────────────────────────────────────────────────────────
-- 2. INVENTORY  (equipment / asset registry)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    asset_name VARCHAR(120) NOT NULL,
    asset_type ENUM(
        'Desktop',
        'Laptop',
        'Server',
        'Printer',
        'Router',
        'Switch',
        'Monitor',
        'UPS',
        'Other'
    ) NOT NULL DEFAULT 'Other',
    serial_number VARCHAR(100) DEFAULT NULL UNIQUE,
    location VARCHAR(120) DEFAULT NULL,
    status ENUM(
        'active',
        'inactive',
        'maintenance',
        'retired'
    ) NOT NULL DEFAULT 'active',
    assigned_to INT UNSIGNED DEFAULT NULL, -- FK → users.id
    purchase_date DATE DEFAULT NULL,
    warranty_expiry DATE DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_inv_status (status),
    KEY idx_inv_type (asset_type),
    KEY idx_inv_assigned (assigned_to),
    CONSTRAINT fk_inv_user FOREIGN KEY (assigned_to) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Sample seed data
INSERT INTO
    inventory (
        asset_name,
        asset_type,
        serial_number,
        location,
        status,
        assigned_to
    )
VALUES (
        'Dell Latitude 5540',
        'Laptop',
        'DL-2024-001',
        'IT Department',
        'active',
        NULL
    ),
    (
        'HP ProBook 450',
        'Laptop',
        'HP-2023-045',
        'HR Office',
        'active',
        NULL
    ),
    (
        'Cisco ASA 5506',
        'Router',
        'CSC-FW-007',
        'Server Room',
        'active',
        NULL
    ),
    (
        'HP LaserJet Pro',
        'Printer',
        'HJ-2022-019',
        'Operations Floor',
        'maintenance',
        NULL
    ),
    (
        'PowerEdge R750',
        'Server',
        'PE-SRV-003',
        'Server Room',
        'active',
        NULL
    );

-- ────────────────────────────────────────────────────────────────
-- 3. TICKETS  (support / help-desk tickets)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tickets (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    ticket_ref VARCHAR(20) NOT NULL UNIQUE, -- e.g. TKT-20260001
    submitted_by INT UNSIGNED DEFAULT NULL, -- FK → users.id
    subject VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    category VARCHAR(80) DEFAULT NULL,
    priority ENUM(
        'low',
        'medium',
        'high',
        'critical'
    ) NOT NULL DEFAULT 'medium',
    status ENUM(
        'open',
        'in_progress',
        'resolved',
        'closed',
        'cancelled'
    ) NOT NULL DEFAULT 'open',
    assigned_agent INT UNSIGNED DEFAULT NULL, -- FK → users.id (admin)
    device_id INT UNSIGNED DEFAULT NULL, -- FK → inventory.id
    resolved_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_tkt_status (status),
    KEY idx_tkt_priority (priority),
    KEY idx_tkt_user (submitted_by),
    CONSTRAINT fk_tkt_user FOREIGN KEY (submitted_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_tkt_agent FOREIGN KEY (assigned_agent) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_tkt_device FOREIGN KEY (device_id) REFERENCES inventory (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Auto-generate ticket reference via trigger (Fixed to avoid Error 1442)
DELIMITER $$

CREATE TRIGGER trg_ticket_ref
BEFORE INSERT ON tickets
FOR EACH ROW
BEGIN
  DECLARE next_id INT;
  IF NEW.ticket_ref IS NULL OR NEW.ticket_ref = '' THEN
    SELECT AUTO_INCREMENT INTO next_id
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'tickets';
    
    SET NEW.ticket_ref = CONCAT('TKT-', YEAR(NOW()), LPAD(IFNULL(next_id, 1), 4, '0'));
  END IF;
END$$

DELIMITER;

-- ────────────────────────────────────────────────────────────────
-- 4. TICKET COMMENTS / ACTIVITY LOG
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_comments (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    ticket_id INT UNSIGNED NOT NULL,
    author_id INT UNSIGNED DEFAULT NULL,
    is_internal TINYINT(1) NOT NULL DEFAULT 0, -- 1 = admin-only note
    body TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_tc_ticket (ticket_id),
    CONSTRAINT fk_tc_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_tc_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────────
-- 5. REQUESTS & COMPLAINTS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS requests (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    ticket_id INT UNSIGNED DEFAULT NULL, -- FK → tickets.id
    submitted_by INT UNSIGNED DEFAULT NULL, -- FK → users.id
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(180) NOT NULL,
    request_type ENUM(
        'Request',
        'Complaint',
        'Incident',
        'Change Request'
    ) NOT NULL DEFAULT 'Request',
    department VARCHAR(80) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    details TEXT DEFAULT NULL,
    status ENUM(
        'pending',
        'in_review',
        'resolved',
        'rejected'
    ) NOT NULL DEFAULT 'pending',
    priority ENUM(
        'low',
        'medium',
        'high',
        'critical'
    ) NOT NULL DEFAULT 'medium',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_req_status (status),
    KEY idx_req_type (request_type),
    CONSTRAINT fk_req_tkt FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE,
    CONSTRAINT fk_req_user FOREIGN KEY (submitted_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────────
-- 6. TROUBLESHOOTING ISSUES  (issue tracker / Kanban)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS issues (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    status ENUM(
        'pending',
        'in-progress',
        'resolved',
        'critical'
    ) NOT NULL DEFAULT 'pending',
    response_notes TEXT DEFAULT NULL,
    assigned_to INT UNSIGNED DEFAULT NULL, -- FK → users.id
    reported_by INT UNSIGNED DEFAULT NULL, -- FK → users.id
    device_id INT UNSIGNED DEFAULT NULL, -- FK → inventory.id
    resolved_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_issue_status (status),
    CONSTRAINT fk_issue_assigned FOREIGN KEY (assigned_to) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_issue_reported FOREIGN KEY (reported_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_issue_device FOREIGN KEY (device_id) REFERENCES inventory (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Sample seed data (mirrors troubleshooting badges in sidebar)
INSERT INTO
    issues (
        title,
        description,
        status,
        response_notes
    )
VALUES (
        'WiFi drops on floor 2',
        'Users on floor 2 losing connectivity intermittently',
        'in-progress',
        'Checking AP firmware'
    ),
    (
        'Printer offline – HR',
        'HP LaserJet in HR not discoverable on network',
        'pending',
        NULL
    ),
    (
        'Blue screen on Dev PC #3',
        'BSOD with DRIVER_IRQL error, Windows 11',
        'critical',
        'Scheduled RAM replacement'
    ),
    (
        'Outlook sync failure',
        'Emails not syncing for multiple Finance users',
        'resolved',
        'Exchange server cache cleared'
    ),
    (
        'VPN authentication timeout',
        'Remote workers unable to connect after 5 PM',
        'in-progress',
        'AAA server config update pending'
    );

-- ────────────────────────────────────────────────────────────────
-- 7. DOCUMENTATION / KB ARTICLES
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documentation (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    category ENUM(
        'General',
        'Network',
        'Hardware',
        'Security',
        'Software'
    ) NOT NULL DEFAULT 'General',
    content LONGTEXT NOT NULL,
    author_id INT UNSIGNED DEFAULT NULL,
    is_published TINYINT(1) NOT NULL DEFAULT 1,
    views INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_doc_category (category),
    KEY idx_doc_published (is_published),
    FULLTEXT KEY ft_doc_search (title, content),
    CONSTRAINT fk_doc_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Sample seed data
INSERT INTO
    documentation (
        title,
        category,
        content,
        author_id
    )
VALUES (
        'How to connect to the company VPN',
        'Network',
        'Step 1: Open FortiClient...',
        1
    ),
    (
        'Password Reset Policy',
        'Security',
        'Passwords must be changed every 90 days...',
        1
    ),
    (
        'Requesting a New Device',
        'General',
        'Submit a ticket via the portal with...',
        1
    ),
    (
        'Fixing "No Internet" on Windows 11',
        'Software',
        'Run: netsh winsock reset...',
        1
    ),
    (
        'Printer Setup – Network Printers',
        'Hardware',
        'Go to Settings > Printers & Scanners...',
        1
    );

-- ────────────────────────────────────────────────────────────────
-- 8. ACTIVITY LOG  (recent-activity feed on dashboard)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED DEFAULT NULL,
    action_type VARCHAR(60) NOT NULL, -- e.g. 'ticket_created', 'asset_added'
    description VARCHAR(255) NOT NULL,
    entity_type VARCHAR(40) DEFAULT NULL, -- 'ticket','inventory','request'…
    entity_id INT UNSIGNED DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_act_user (user_id),
    KEY idx_act_type (action_type),
    KEY idx_act_time (created_at),
    CONSTRAINT fk_act_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────────
-- 9. SESSIONS  (server-side session store — optional but useful)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(128) NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    user_agent VARCHAR(255) DEFAULT NULL,
    payload TEXT DEFAULT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (session_id),
    KEY idx_sess_user (user_id),
    KEY idx_sess_expires (expires_at),
    CONSTRAINT fk_sess_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────────
-- 10. USEFUL VIEWS
-- ────────────────────────────────────────────────────────────────

-- Dashboard KPI counts (mirrors dashboard stat cards)
CREATE OR REPLACE VIEW vw_dashboard_kpis AS
SELECT (
        SELECT COUNT(*)
        FROM inventory
        WHERE
            status = 'active'
    ) AS active_assets,
    (
        SELECT COUNT(*)
        FROM inventory
    ) AS total_assets,
    (
        SELECT COUNT(*)
        FROM tickets
        WHERE
            status IN ('open', 'in_progress')
    ) AS open_tickets,
    (
        SELECT COUNT(*)
        FROM issues
        WHERE
            status = 'critical'
    ) AS critical_issues,
    (
        SELECT COUNT(*)
        FROM requests
        WHERE
            status = 'pending'
    ) AS pending_requests,
    (
        SELECT COUNT(*)
        FROM users
        WHERE
            role = 'employee'
            AND is_active = 1
    ) AS active_employees;

-- Open tickets with submitter name
CREATE OR REPLACE VIEW vw_open_tickets AS
SELECT
    t.id,
    t.ticket_ref,
    t.subject,
    t.priority,
    t.status,
    t.created_at,
    u.full_name AS submitted_by_name,
    u.email AS submitted_by_email,
    u.department
FROM tickets t
    LEFT JOIN users u ON u.id = t.submitted_by
WHERE
    t.status IN ('open', 'in_progress')
ORDER BY FIELD(
        t.priority, 'critical', 'high', 'medium', 'low'
    ), t.created_at;

-- ────────────────────────────────────────────────────────────────
-- 11. STORED PROCEDURE — register new employee
-- ────────────────────────────────────────────────────────────────
DELIMITER $$

CREATE PROCEDURE IF NOT EXISTS sp_register_employee (
  IN  p_full_name  VARCHAR(120),
  IN  p_email      VARCHAR(180),
  IN  p_pass_hash  VARCHAR(255),
  IN  p_department VARCHAR(80),
  OUT p_user_id    INT UNSIGNED,
  OUT p_message    VARCHAR(255)
)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    SET p_user_id = 0;
    SET p_message = 'Error: Could not register user.';
    ROLLBACK;
  END;

  START TRANSACTION;

  IF EXISTS (SELECT 1 FROM users WHERE email = p_email) THEN
    SET p_user_id = 0;
    SET p_message = 'Error: Email already registered.';
  ELSE
    INSERT INTO users (full_name, email, password_hash, role, department, avatar_initials)
    VALUES (
      p_full_name,
      p_email,
      p_pass_hash,
      'employee',
      p_department,
      UPPER(CONCAT(LEFT(p_full_name,1), SUBSTRING_INDEX(p_full_name,' ',-1) REGEXP '[A-Za-z]',
            IF(LOCATE(' ',p_full_name) > 0, SUBSTR(SUBSTRING_INDEX(p_full_name,' ',-1),1,1), '')))
    );
    SET p_user_id = LAST_INSERT_ID();
    SET p_message = 'OK: User registered successfully.';

    -- Log the activity
    INSERT INTO activity_log (user_id, action_type, description, entity_type, entity_id)
    VALUES (p_user_id, 'user_registered', CONCAT('New employee registered: ', p_full_name), 'user', p_user_id);
  END IF;

  COMMIT;
END$$

DELIMITER;

-- ────────────────────────────────────────────────────────────────
-- END OF SCHEMA
-- ────────────────────────────────────────────────────────────────
-- To import: mysql -u root -p < nexusit_db.sql
-- Or paste each section in your DB client (DBeaver, HeidiSQL, etc.)
-- ==============================================================