/**
 * mysql.js — MySQL Database Manager for Leonex SSMS
 * Implements normalized schemas for:
 * 1. societies
 * 2. users (Clerk User ID identity reference, zero passwords/secrets stored)
 * 3. login_history (non-destructive audit trail)
 * Supports live MySQL connection and resilient fallback store.
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'super-admin-db.json');

// Initial seed data generator
function getInitialSeedData() {
  const superAdminId = (process.env.SUPER_ADMIN_CLERK_USER_ID || 'user_2superadminowner').trim();

  const societies = [
    {
      id: 1,
      society_id: 'LNX-001',
      society_name: 'Royal Residency',
      address: 'Jamnagar, Gujarat',
      admin_clerk_user_id: 'user_sec_001',
      status: 'ACTIVE',
      created_at: '2026-09-10 09:30:00',
      updated_at: '2026-09-10 09:30:00'
    },
    {
      id: 2,
      society_id: 'LNX-002',
      society_name: 'Silver Oak Enclave',
      address: 'SG Highway, Ahmedabad, Gujarat',
      admin_clerk_user_id: 'user_sec_002',
      status: 'ACTIVE',
      created_at: '2026-09-12 11:15:00',
      updated_at: '2026-09-12 11:15:00'
    },
    {
      id: 3,
      society_id: 'LNX-003',
      society_name: 'Harmony Gardens',
      address: 'Bandra Kurla Complex, Mumbai, Maharashtra',
      admin_clerk_user_id: 'user_sec_003',
      status: 'ACTIVE',
      created_at: '2026-09-18 14:00:00',
      updated_at: '2026-09-18 14:00:00'
    },
    {
      id: 4,
      society_id: 'LNX-004',
      society_name: 'Emerald Crest Society',
      address: 'Whitefield, Bengaluru, Karnataka',
      admin_clerk_user_id: 'user_sec_004',
      status: 'INACTIVE',
      created_at: '2026-09-22 16:30:00',
      updated_at: '2026-09-22 16:30:00'
    },
    {
      id: 5,
      society_id: 'LNX-005',
      society_name: 'Skyline Urban Homes',
      address: 'Hinjawadi, Pune, Maharashtra',
      admin_clerk_user_id: 'user_sec_005',
      status: 'SUSPENDED',
      created_at: '2026-09-25 10:20:00',
      updated_at: '2026-09-25 10:20:00'
    }
  ];

  const users = [
    {
      id: 1,
      clerk_user_id: superAdminId,
      name: 'Leonex System Owner',
      email: 'superadmin@leonex.io',
      role: 'SUPER_ADMIN',
      society_id: null,
      status: 'ACTIVE',
      registered_at: '2026-09-01 08:00:00',
      last_login_at: '2026-10-02 12:45:00',
      updated_at: '2026-10-02 12:45:00'
    },
    {
      id: 2,
      clerk_user_id: 'user_sec_001',
      name: 'Rahul Sharma',
      email: 'rahul.sharma@royalresidency.com',
      role: 'SECRETARY',
      society_id: 'LNX-001',
      status: 'ACTIVE',
      registered_at: '2026-09-10 09:35:00',
      last_login_at: '2026-10-02 13:15:00',
      updated_at: '2026-10-02 13:15:00'
    },
    {
      id: 3,
      clerk_user_id: 'user_sec_002',
      name: 'Vikram Desai',
      email: 'vikram.desai@silveroak.com',
      role: 'SECRETARY',
      society_id: 'LNX-002',
      status: 'ACTIVE',
      registered_at: '2026-09-12 11:20:00',
      last_login_at: '2026-10-02 11:30:00',
      updated_at: '2026-10-02 11:30:00'
    },
    {
      id: 4,
      clerk_user_id: 'user_sec_003',
      name: 'Pooja Mehta',
      email: 'pooja.mehta@harmonygardens.org',
      role: 'SECRETARY',
      society_id: 'LNX-003',
      status: 'ACTIVE',
      registered_at: '2026-09-18 14:10:00',
      last_login_at: '2026-10-02 09:40:00',
      updated_at: '2026-10-02 09:40:00'
    },
    {
      id: 5,
      clerk_user_id: 'user_sec_004',
      name: 'Suresh Nair',
      email: 'suresh.nair@emeraldcrest.com',
      role: 'SECRETARY',
      society_id: 'LNX-004',
      status: 'INACTIVE',
      registered_at: '2026-09-22 16:35:00',
      last_login_at: '2026-09-24 15:10:00',
      updated_at: '2026-09-24 15:10:00'
    },
    {
      id: 6,
      clerk_user_id: 'user_sec_005',
      name: 'Anand Kulkarni',
      email: 'anand.k@skylinehomes.in',
      role: 'SECRETARY',
      society_id: 'LNX-005',
      status: 'SUSPENDED',
      registered_at: '2026-09-25 10:25:00',
      last_login_at: '2026-09-28 17:00:00',
      updated_at: '2026-09-28 17:00:00'
    },
    {
      id: 7,
      clerk_user_id: 'user_res_001',
      name: 'Amit Patel',
      email: 'amit.patel@gmail.com',
      role: 'RESIDENT',
      society_id: 'LNX-001',
      status: 'ACTIVE',
      registered_at: '2026-09-11 10:00:00',
      last_login_at: '2026-10-02 13:10:00',
      updated_at: '2026-10-02 13:10:00'
    },
    {
      id: 8,
      clerk_user_id: 'user_res_002',
      name: 'Priya Verma',
      email: 'priya.verma@outlook.com',
      role: 'RESIDENT',
      society_id: 'LNX-001',
      status: 'ACTIVE',
      registered_at: '2026-09-11 11:30:00',
      last_login_at: '2026-09-30 16:45:00',
      updated_at: '2026-09-30 16:45:00'
    },
    {
      id: 9,
      clerk_user_id: 'user_res_003',
      name: 'Rajesh Iyer',
      email: 'rajesh.iyer@yahoo.com',
      role: 'RESIDENT',
      society_id: 'LNX-001',
      status: 'ACTIVE',
      registered_at: '2026-09-12 14:00:00',
      last_login_at: '2026-09-29 18:20:00',
      updated_at: '2026-09-29 18:20:00'
    },
    {
      id: 10,
      clerk_user_id: 'user_res_004',
      name: 'Sunita Rao',
      email: 'sunita.rao@gmail.com',
      role: 'RESIDENT',
      society_id: 'LNX-002',
      status: 'ACTIVE',
      registered_at: '2026-09-14 16:00:00',
      last_login_at: '2026-10-02 10:15:00',
      updated_at: '2026-10-02 10:15:00'
    },
    {
      id: 11,
      clerk_user_id: 'user_res_005',
      name: 'Neha Gupta',
      email: 'neha.gupta@gmail.com',
      role: 'RESIDENT',
      society_id: 'LNX-002',
      status: 'ACTIVE',
      registered_at: '2026-09-15 09:30:00',
      last_login_at: '2026-10-01 12:10:00',
      updated_at: '2026-10-01 12:10:00'
    },
    {
      id: 12,
      clerk_user_id: 'user_res_006',
      name: 'Manish Joshi',
      email: 'manish.joshi@gmail.com',
      role: 'RESIDENT',
      society_id: 'LNX-003',
      status: 'ACTIVE',
      registered_at: '2026-09-19 11:00:00',
      last_login_at: '2026-10-01 15:40:00',
      updated_at: '2026-10-01 15:40:00'
    },
    {
      id: 13,
      clerk_user_id: 'user_res_007',
      name: 'Deepak Shah',
      email: 'deepak.shah@gmail.com',
      role: 'RESIDENT',
      society_id: 'LNX-003',
      status: 'INACTIVE',
      registered_at: '2026-09-20 12:15:00',
      last_login_at: '2026-09-26 14:00:00',
      updated_at: '2026-09-26 14:00:00'
    },
    {
      id: 14,
      clerk_user_id: 'user_res_008',
      name: 'Kavita Chawla',
      email: 'kavita.c@gmail.com',
      role: 'RESIDENT',
      society_id: 'LNX-005',
      status: 'SUSPENDED',
      registered_at: '2026-09-26 09:00:00',
      last_login_at: '2026-09-27 11:00:00',
      updated_at: '2026-09-27 11:00:00'
    },
    {
      id: 15,
      clerk_user_id: 'user_grd_001',
      name: 'Jay Singh',
      email: 'jay.singh@security.leonex.io',
      role: 'GUARD',
      society_id: 'LNX-001',
      status: 'ACTIVE',
      registered_at: '2026-09-10 12:00:00',
      last_login_at: '2026-10-02 12:55:00',
      updated_at: '2026-10-02 12:55:00'
    },
    {
      id: 16,
      clerk_user_id: 'user_grd_002',
      name: 'Bahadur Thapa',
      email: 'bahadur.t@security.leonex.io',
      role: 'GUARD',
      society_id: 'LNX-002',
      status: 'ACTIVE',
      registered_at: '2026-09-12 13:00:00',
      last_login_at: '2026-10-01 19:00:00',
      updated_at: '2026-10-01 19:00:00'
    },
    {
      id: 17,
      clerk_user_id: 'user_grd_003',
      name: 'Ramesh Yadav',
      email: 'ramesh.y@security.leonex.io',
      role: 'GUARD',
      society_id: 'LNX-003',
      status: 'ACTIVE',
      registered_at: '2026-09-18 15:30:00',
      last_login_at: '2026-10-01 20:30:00',
      updated_at: '2026-10-01 20:30:00'
    },
    {
      id: 18,
      clerk_user_id: 'user_cmt_001',
      name: 'Dr. Sanjay Mehra',
      email: 'sanjay.mehra@royalresidency.com',
      role: 'COMMITTEE',
      society_id: 'LNX-001',
      status: 'ACTIVE',
      registered_at: '2026-09-10 14:00:00',
      last_login_at: '2026-10-01 18:20:00',
      updated_at: '2026-10-01 18:20:00'
    },
    {
      id: 19,
      clerk_user_id: 'user_cmt_002',
      name: 'Anjali Trivedi',
      email: 'anjali.trivedi@silveroak.com',
      role: 'COMMITTEE',
      society_id: 'LNX-002',
      status: 'ACTIVE',
      registered_at: '2026-09-12 15:00:00',
      last_login_at: '2026-09-30 19:15:00',
      updated_at: '2026-09-30 19:15:00'
    },
    {
      id: 20,
      clerk_user_id: 'user_cmt_003',
      name: 'Kunal Kapoor',
      email: 'kunal.kapoor@harmonygardens.org',
      role: 'COMMITTEE',
      society_id: 'LNX-003',
      status: 'ACTIVE',
      registered_at: '2026-09-18 16:00:00',
      last_login_at: '2026-09-29 20:00:00',
      updated_at: '2026-09-29 20:00:00'
    }
  ];

  const login_history = [
    {
      id: 101,
      clerk_user_id: 'user_sec_001',
      society_id: 'LNX-001',
      login_at: '2026-10-02 13:15:00',
      logout_at: '2026-10-02 14:05:00'
    },
    {
      id: 102,
      clerk_user_id: 'user_res_001',
      society_id: 'LNX-001',
      login_at: '2026-10-02 13:10:00',
      logout_at: null
    },
    {
      id: 103,
      clerk_user_id: 'user_grd_001',
      society_id: 'LNX-001',
      login_at: '2026-10-02 12:55:00',
      logout_at: null
    },
    {
      id: 104,
      clerk_user_id: superAdminId,
      society_id: null,
      login_at: '2026-10-02 12:45:00',
      logout_at: null
    },
    {
      id: 105,
      clerk_user_id: 'user_sec_002',
      society_id: 'LNX-002',
      login_at: '2026-10-02 11:30:00',
      logout_at: '2026-10-02 12:30:00'
    },
    {
      id: 106,
      clerk_user_id: 'user_res_004',
      society_id: 'LNX-002',
      login_at: '2026-10-02 10:15:00',
      logout_at: '2026-10-02 10:45:00'
    },
    {
      id: 107,
      clerk_user_id: 'user_sec_003',
      society_id: 'LNX-003',
      login_at: '2026-10-02 09:40:00',
      logout_at: '2026-10-02 10:15:00'
    },
    {
      id: 108,
      clerk_user_id: 'user_grd_002',
      society_id: 'LNX-002',
      login_at: '2026-10-01 19:00:00',
      logout_at: '2026-10-02 07:00:00'
    },
    {
      id: 109,
      clerk_user_id: 'user_cmt_001',
      society_id: 'LNX-001',
      login_at: '2026-10-01 18:20:00',
      logout_at: '2026-10-01 19:00:00'
    },
    {
      id: 110,
      clerk_user_id: 'user_res_002',
      society_id: 'LNX-001',
      login_at: '2026-09-30 16:45:00',
      logout_at: '2026-09-30 17:30:00'
    }
  ];

  return { societies, users, login_history };
}

class DatabaseManager {
  constructor() {
    this.pool = null;
    this.isOnline = false;
    this.fallbackStore = {
      otps: new Map(),
      societies: [],
      users: [],
      login_history: [],
      contacts: [],
      subscribers: []
    };
    this.initFallbackStore();
  }

  initFallbackStore() {
    if (!fs.existsSync(DATA_DIR)) {
      try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
    }
    if (fs.existsSync(STORE_PATH)) {
      try {
        const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
        this.fallbackStore.societies = data.societies || [];
        this.fallbackStore.users = data.users || [];
        this.fallbackStore.login_history = data.login_history || [];
        this.fallbackStore.contacts = data.contacts || [];
        this.fallbackStore.subscribers = data.subscribers || [];
      } catch (e) {
        console.warn('[Store load warning]', e.message);
      }
    }
    if (!this.fallbackStore.societies.length || !this.fallbackStore.users.length) {
      const initial = getInitialSeedData();
      this.fallbackStore.societies = initial.societies;
      this.fallbackStore.users = initial.users;
      this.fallbackStore.login_history = initial.login_history;
      if (!this.fallbackStore.contacts || !this.fallbackStore.contacts.length) {
        this.fallbackStore.contacts = [
          {
            id: 1,
            name: 'Ramesh Patel',
            society_name: 'Sunrise Residency, Surat',
            email: 'ramesh.patel@gmail.com',
            phone: '+91 98250 12345',
            message: 'We have 120 flats and want to automate our maintenance billing and digital gate passes.',
            created_at: '2026-10-24 10:15:00'
          },
          {
            id: 2,
            name: 'Vikram Mehta',
            society_name: 'Palm Grove Enclave, Ahmedabad',
            email: 'vikram.mehta@palmgrove.in',
            phone: '+91 98980 67890',
            message: 'Interested in on-site onboarding demonstration for our management committee.',
            created_at: '2026-10-24 11:30:00'
          }
        ];
      }
      if (!this.fallbackStore.subscribers || !this.fallbackStore.subscribers.length) {
        this.fallbackStore.subscribers = [
          {
            id: 1,
            email: 'secretary@sunriseresidency.org',
            status: 'ACTIVE',
            created_at: '2026-10-24 09:00:00'
          },
          {
            id: 2,
            email: 'info@housingfederation.in',
            status: 'ACTIVE',
            created_at: '2026-10-24 10:00:00'
          }
        ];
      }
      this.saveFallbackStore();
    }
  }

  saveFallbackStore() {
    try {
      const data = {
        societies: this.fallbackStore.societies,
        users: this.fallbackStore.users,
        login_history: this.fallbackStore.login_history,
        contacts: this.fallbackStore.contacts || [],
        subscribers: this.fallbackStore.subscribers || [],
        updatedAt: new Date().toISOString()
      };
      fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.warn('[Store save warning]', e.message);
    }
  }

  async init() {
    const host = process.env.DB_HOST || 'localhost';
    const port = parseInt(process.env.DB_PORT || '3306', 10);
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const database = process.env.DB_NAME || 'society_hub';

    try {
      // Connect to MySQL server and ensure target database exists
      const initialConn = await mysql.createConnection({
        host,
        port,
        user,
        password,
        connectTimeout: 2500
      });

      await initialConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
      await initialConn.end();

      // Create pool with target database
      this.pool = mysql.createPool({
        host,
        port,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
      });

      await this.pool.query('SELECT 1 + 1 AS test');
      this.isOnline = true;
      console.log(`\x1b[32m✔ [MySQL] Connected to database: ${database} at ${host}:${port}\x1b[0m`);

      // Initialize normalized tables
      await this.initTables();
      // Seed default data if tables are empty
      await this.seedTables();

    } catch (err) {
      this.isOnline = false;
      this.pool = null;
      console.log(`\x1b[33m⚠ [MySQL] Service offline or unreachable (${err.message}).`);
      console.log(`  Operating with resilient local fallback store for Super Admin & auth APIs.\x1b[0m`);
    }
  }

  async initTables() {
    if (!this.isOnline || !this.pool) return;

    // 1. societies table
    const societiesTableSql = `
      CREATE TABLE IF NOT EXISTS societies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        society_id VARCHAR(64) UNIQUE NOT NULL,
        society_name VARCHAR(255) NOT NULL,
        address VARCHAR(500) NOT NULL,
        admin_clerk_user_id VARCHAR(255) NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_society_status (status),
        INDEX idx_admin_clerk (admin_clerk_user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    // 2. users table (zero passwords stored; clerk_user_id is the identity reference)
    const usersTableSql = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        clerk_user_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(32) NOT NULL,
        society_id VARCHAR(64) NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login_at DATETIME NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_clerk_user (clerk_user_id),
        INDEX idx_user_society (society_id),
        INDEX idx_user_role (role),
        INDEX idx_user_status (status),
        INDEX idx_user_email (email),
        CONSTRAINT fk_users_society FOREIGN KEY (society_id) REFERENCES societies(society_id) ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    // 3. login_history table (non-destructive audit trail)
    const loginHistoryTableSql = `
      CREATE TABLE IF NOT EXISTS login_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        clerk_user_id VARCHAR(255) NOT NULL,
        society_id VARCHAR(64) NULL,
        login_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        logout_at DATETIME NULL,
        INDEX idx_login_clerk (clerk_user_id),
        INDEX idx_login_society (society_id),
        INDEX idx_login_at (login_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    // Legacy OTP codes support
    const otpTableSql = `
      CREATE TABLE IF NOT EXISTS otp_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        identifier VARCHAR(255) NOT NULL,
        otp_code VARCHAR(10) NOT NULL,
        expires_at DATETIME NOT NULL,
        is_used TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_identifier (identifier),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    // Contact messages table
    const contactMessagesTableSql = `
      CREATE TABLE IF NOT EXISTS contact_messages (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        society_name VARCHAR(255) NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(64) NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_contact_created (created_at),
        INDEX idx_contact_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    // Newsletter subscribers table
    const subscribersTableSql = `
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_subscriber_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await this.pool.query(societiesTableSql);
    await this.pool.query(usersTableSql);
    await this.pool.query(loginHistoryTableSql);
    await this.pool.query(otpTableSql);
    await this.pool.query(contactMessagesTableSql);
    await this.pool.query(subscribersTableSql);

    console.log('\x1b[32m✔ [MySQL] Verified core tables including `contact_messages` and `newsletter_subscribers`\x1b[0m');
  }

  async seedTables() {
    if (!this.isOnline || !this.pool) return;
    try {
      const [socCount] = await this.pool.query('SELECT COUNT(*) as count FROM societies');
      if (socCount[0].count === 0) {
        const seed = getInitialSeedData();

        for (const s of seed.societies) {
          await this.pool.query(
            `INSERT IGNORE INTO societies (id, society_id, society_name, address, admin_clerk_user_id, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [s.id, s.society_id, s.society_name, s.address, s.admin_clerk_user_id, s.status, s.created_at, s.updated_at]
          );
        }

        for (const u of seed.users) {
          await this.pool.query(
            `INSERT IGNORE INTO users (id, clerk_user_id, name, email, role, society_id, status, registered_at, last_login_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [u.id, u.clerk_user_id, u.name, u.email, u.role, u.society_id, u.status, u.registered_at, u.last_login_at, u.updated_at]
          );
        }

        for (const l of seed.login_history) {
          await this.pool.query(
            `INSERT IGNORE INTO login_history (id, clerk_user_id, society_id, login_at, logout_at)
             VALUES (?, ?, ?, ?, ?)`,
            [l.id, l.clerk_user_id, l.society_id, l.login_at, l.logout_at]
          );
        }

        console.log(`\x1b[32m✔ [MySQL] Seeded ${seed.societies.length} societies, ${seed.users.length} users, and ${seed.login_history.length} login records.\x1b[0m`);
      }
    } catch (err) {
      console.warn('[MySQL Seed Warning]', err.message);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // SOCIETIES METHODS (DYNAMIC METRICS FROM USERS TABLE)
  // ══════════════════════════════════════════════════════════════

  async getSocieties({ status = '', search = '' } = {}) {
    if (this.isOnline && this.pool) {
      try {
        let sql = `
          SELECT 
            s.*,
            u_admin.name AS secretary_name,
            u_admin.email AS secretary_email,
            COUNT(DISTINCT CASE WHEN u.role = 'RESIDENT' THEN u.id END) AS residents_count,
            COUNT(DISTINCT CASE WHEN u.role = 'GUARD' THEN u.id END) AS guards_count,
            COUNT(DISTINCT CASE WHEN u.role = 'COMMITTEE' THEN u.id END) AS committee_count,
            COUNT(DISTINCT u.id) AS total_users_count
          FROM societies s
          LEFT JOIN users u_admin ON s.admin_clerk_user_id = u_admin.clerk_user_id
          LEFT JOIN users u ON s.society_id = u.society_id
          WHERE 1=1
        `;
        const params = [];

        if (status && status !== 'ALL') {
          sql += ` AND s.status = ?`;
          params.push(status.toUpperCase());
        }
        if (search) {
          sql += ` AND (s.society_id LIKE ? OR s.society_name LIKE ? OR u_admin.email LIKE ?)`;
          const term = `%${search}%`;
          params.push(term, term, term);
        }

        sql += ` GROUP BY s.id ORDER BY s.id ASC`;
        const [rows] = await this.pool.query(sql, params);
        return rows;
      } catch (err) {
        console.warn('[MySQL getSocieties error]', err.message);
      }
    }

    // Fallback in-memory
    let list = this.fallbackStore.societies.map(s => {
      const secUser = this.fallbackStore.users.find(u => u.clerk_user_id === s.admin_clerk_user_id);
      const socUsers = this.fallbackStore.users.filter(u => u.society_id === s.society_id);

      return {
        ...s,
        secretary_name: secUser ? secUser.name : 'Unassigned',
        secretary_email: secUser ? secUser.email : 'N/A',
        residents_count: socUsers.filter(u => u.role === 'RESIDENT').length,
        guards_count: socUsers.filter(u => u.role === 'GUARD').length,
        committee_count: socUsers.filter(u => u.role === 'COMMITTEE').length,
        total_users_count: socUsers.length
      };
    });

    if (status && status !== 'ALL') {
      const st = status.toUpperCase();
      list = list.filter(s => s.status === st);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        (s.society_id && s.society_id.toLowerCase().includes(q)) ||
        (s.society_name && s.society_name.toLowerCase().includes(q)) ||
        (s.secretary_email && s.secretary_email.toLowerCase().includes(q))
      );
    }

    return list;
  }

  async getSocietyById(societyId) {
    const list = await this.getSocieties();
    return list.find(s => s.society_id === societyId) || null;
  }

  async createSociety({ society_name, address, admin_clerk_user_id = null }) {
    // Generate next society_id
    let maxNum = 0;
    if (this.isOnline && this.pool) {
      try {
        const [rows] = await this.pool.query(`SELECT society_id FROM societies WHERE society_id LIKE 'LNX-%'`);
        for (const r of rows) {
          const num = parseInt(r.society_id.replace('LNX-', ''), 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      } catch (e) {}
    } else {
      for (const s of this.fallbackStore.societies) {
        const num = parseInt(s.society_id.replace('LNX-', ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }

    const nextId = `LNX-${String(maxNum + 1).padStart(3, '0')}`;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const newRecord = {
      society_id: nextId,
      society_name,
      address,
      admin_clerk_user_id,
      status: 'ACTIVE',
      created_at: now,
      updated_at: now
    };

    if (this.isOnline && this.pool) {
      try {
        const [result] = await this.pool.query(
          `INSERT INTO societies (society_id, society_name, address, admin_clerk_user_id, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'ACTIVE', NOW(), NOW())`,
          [nextId, society_name, address, admin_clerk_user_id]
        );
        newRecord.id = result.insertId;
      } catch (err) {
        console.warn('[MySQL createSociety error]', err.message);
      }
    }

    newRecord.id = newRecord.id || Date.now();
    this.fallbackStore.societies.push(newRecord);
    this.saveFallbackStore();
    return newRecord;
  }

  async updateSocietyStatus(societyId, status) {
    const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
    const cleanStatus = status.toUpperCase();
    if (!validStatuses.includes(cleanStatus)) {
      throw new Error(`Invalid status: ${status}. Must be ACTIVE, INACTIVE, or SUSPENDED.`);
    }

    if (this.isOnline && this.pool) {
      try {
        await this.pool.query(
          `UPDATE societies SET status = ?, updated_at = NOW() WHERE society_id = ?`,
          [cleanStatus, societyId]
        );
      } catch (err) {
        console.warn('[MySQL updateSocietyStatus error]', err.message);
      }
    }

    const soc = this.fallbackStore.societies.find(s => s.society_id === societyId);
    if (soc) {
      soc.status = cleanStatus;
      soc.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
      this.saveFallbackStore();
    }

    return { society_id: societyId, status: cleanStatus };
  }

  // ══════════════════════════════════════════════════════════════
  // USERS METHODS
  // ══════════════════════════════════════════════════════════════

  async getUsers({ role = '', status = '', society_id = '', search = '' } = {}) {
    if (this.isOnline && this.pool) {
      try {
        let sql = `
          SELECT u.*, s.society_name 
          FROM users u
          LEFT JOIN societies s ON u.society_id = s.society_id
          WHERE 1=1
        `;
        const params = [];

        if (role && role !== 'ALL') {
          sql += ` AND u.role = ?`;
          params.push(role.toUpperCase());
        }
        if (status && status !== 'ALL') {
          sql += ` AND u.status = ?`;
          params.push(status.toUpperCase());
        }
        if (society_id && society_id !== 'ALL') {
          sql += ` AND u.society_id = ?`;
          params.push(society_id);
        }
        if (search) {
          sql += ` AND (u.name LIKE ? OR u.email LIKE ? OR u.society_id LIKE ?)`;
          const term = `%${search}%`;
          params.push(term, term, term);
        }

        sql += ` ORDER BY u.registered_at DESC`;
        const [rows] = await this.pool.query(sql, params);
        return rows;
      } catch (err) {
        console.warn('[MySQL getUsers error]', err.message);
      }
    }

    // In-memory fallback
    let list = this.fallbackStore.users.map(u => {
      const soc = this.fallbackStore.societies.find(s => s.society_id === u.society_id);
      return {
        ...u,
        society_name: soc ? soc.society_name : (u.role === 'SUPER_ADMIN' ? 'Platform (All)' : 'Unassigned')
      };
    });

    if (role && role !== 'ALL') {
      const r = role.toUpperCase();
      list = list.filter(u => u.role === r);
    }
    if (status && status !== 'ALL') {
      const s = status.toUpperCase();
      list = list.filter(u => u.status === s);
    }
    if (society_id && society_id !== 'ALL') {
      list = list.filter(u => u.society_id === society_id);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.society_id && u.society_id.toLowerCase().includes(q))
      );
    }

    return list;
  }

  async getUserByClerkId(clerkUserId) {
    if (!clerkUserId) return null;

    if (this.isOnline && this.pool) {
      try {
        const [rows] = await this.pool.query(
          `SELECT u.*, s.society_name FROM users u
           LEFT JOIN societies s ON u.society_id = s.society_id
           WHERE u.clerk_user_id = ? LIMIT 1`,
          [clerkUserId]
        );
        if (rows.length > 0) return rows[0];
      } catch (err) {
        console.warn('[MySQL getUserByClerkId error]', err.message);
      }
    }

    const u = this.fallbackStore.users.find(usr => usr.clerk_user_id === clerkUserId);
    if (!u) return null;
    const soc = this.fallbackStore.societies.find(s => s.society_id === u.society_id);
    return {
      ...u,
      society_name: soc ? soc.society_name : (u.role === 'SUPER_ADMIN' ? 'Platform (All)' : 'Unassigned')
    };
  }

  async updateUserStatus(clerkUserId, status) {
    const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
    const cleanStatus = status.toUpperCase();
    if (!validStatuses.includes(cleanStatus)) {
      throw new Error(`Invalid status: ${status}`);
    }

    if (this.isOnline && this.pool) {
      try {
        await this.pool.query(
          `UPDATE users SET status = ?, updated_at = NOW() WHERE clerk_user_id = ?`,
          [cleanStatus, clerkUserId]
        );
      } catch (err) {
        console.warn('[MySQL updateUserStatus error]', err.message);
      }
    }

    const u = this.fallbackStore.users.find(usr => usr.clerk_user_id === clerkUserId);
    if (u) {
      u.status = cleanStatus;
      u.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
      this.saveFallbackStore();
    }

    return { clerk_user_id: clerkUserId, status: cleanStatus };
  }

  // ══════════════════════════════════════════════════════════════
  // CLERK AUTH & LOGIN HANDLING
  // ══════════════════════════════════════════════════════════════

  async syncClerkUser({ clerkUserId, name, email, role = null, societyId = null, isLogin = true }) {
    if (!clerkUserId) throw new Error('Clerk User ID is required.');

    const superAdminId = (process.env.SUPER_ADMIN_CLERK_USER_ID || '').trim();
    const isSuperAdmin = superAdminId && clerkUserId === superAdminId;

    let finalRole = isSuperAdmin ? 'SUPER_ADMIN' : (role || 'RESIDENT');
    let finalSocietyId = isSuperAdmin ? null : societyId;

    const existingUser = await this.getUserByClerkId(clerkUserId);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    let userRecord = null;

    if (existingUser) {
      // Preserve existing role & society if not explicitly super admin
      if (!isSuperAdmin) {
        finalRole = existingUser.role;
        finalSocietyId = existingUser.society_id;
      }

      if (this.isOnline && this.pool) {
        try {
          await this.pool.query(
            `UPDATE users 
             SET name = ?, email = ?, role = ?, society_id = ?, last_login_at = ${isLogin ? 'NOW()' : 'last_login_at'}, updated_at = NOW()
             WHERE clerk_user_id = ?`,
            [name || existingUser.name, email || existingUser.email, finalRole, finalSocietyId, clerkUserId]
          );
        } catch (err) {
          console.warn('[MySQL syncClerkUser update error]', err.message);
        }
      }

      const idx = this.fallbackStore.users.findIndex(u => u.clerk_user_id === clerkUserId);
      if (idx >= 0) {
        this.fallbackStore.users[idx] = {
          ...this.fallbackStore.users[idx],
          name: name || existingUser.name,
          email: email || existingUser.email,
          role: finalRole,
          society_id: finalSocietyId,
          last_login_at: isLogin ? now : this.fallbackStore.users[idx].last_login_at,
          updated_at: now
        };
        userRecord = this.fallbackStore.users[idx];
      }
    } else {
      // Create new user in MySQL
      if (this.isOnline && this.pool) {
        try {
          const [result] = await this.pool.query(
            `INSERT INTO users (clerk_user_id, name, email, role, society_id, status, registered_at, last_login_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'ACTIVE', NOW(), NOW(), NOW())`,
            [clerkUserId, name || 'Member', email || '', finalRole, finalSocietyId]
          );
          userRecord = { id: result.insertId };
        } catch (err) {
          console.warn('[MySQL syncClerkUser insert error]', err.message);
        }
      }

      const newId = userRecord?.id || Date.now();
      userRecord = {
        id: newId,
        clerk_user_id: clerkUserId,
        name: name || 'Member',
        email: email || '',
        role: finalRole,
        society_id: finalSocietyId,
        status: 'ACTIVE',
        registered_at: now,
        last_login_at: now,
        updated_at: now
      };
      this.fallbackStore.users.push(userRecord);
    }

    // Insert login history record (never overwrite previous logs)
    if (isLogin) {
      await this.recordLogin(clerkUserId, finalSocietyId);
    }

    this.saveFallbackStore();
    return await this.getUserByClerkId(clerkUserId);
  }

  async recordLogin(clerkUserId, societyId = null) {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (this.isOnline && this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO login_history (clerk_user_id, society_id, login_at)
           VALUES (?, ?, NOW())`,
          [clerkUserId, societyId]
        );
      } catch (err) {
        console.warn('[MySQL recordLogin error]', err.message);
      }
    }

    this.fallbackStore.login_history.unshift({
      id: Date.now() + Math.floor(Math.random() * 1000),
      clerk_user_id: clerkUserId,
      society_id: societyId,
      login_at: now,
      logout_at: null
    });

    this.saveFallbackStore();
  }

  async recordLogout(clerkUserId) {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (this.isOnline && this.pool) {
      try {
        await this.pool.query(
          `UPDATE login_history 
           SET logout_at = NOW() 
           WHERE clerk_user_id = ? AND logout_at IS NULL 
           ORDER BY login_at DESC LIMIT 1`,
          [clerkUserId]
        );
      } catch (err) {
        console.warn('[MySQL recordLogout error]', err.message);
      }
    }

    const log = this.fallbackStore.login_history.find(l => l.clerk_user_id === clerkUserId && !l.logout_at);
    if (log) {
      log.logout_at = now;
      this.saveFallbackStore();
    }
  }

  // ══════════════════════════════════════════════════════════════
  // LOGIN HISTORY METHODS
  // ══════════════════════════════════════════════════════════════

  async getLoginHistory({ timeframe = '', society_id = '', role = '', search = '', limit = 100 } = {}) {
    if (this.isOnline && this.pool) {
      try {
        let sql = `
          SELECT 
            lh.id,
            lh.clerk_user_id,
            lh.society_id,
            lh.login_at,
            lh.logout_at,
            u.name AS user_name,
            u.email,
            u.role,
            s.society_name
          FROM login_history lh
          LEFT JOIN users u ON lh.clerk_user_id = u.clerk_user_id
          LEFT JOIN societies s ON lh.society_id = s.society_id
          WHERE 1=1
        `;
        const params = [];

        if (society_id && society_id !== 'ALL') {
          sql += ` AND lh.society_id = ?`;
          params.push(society_id);
        }
        if (role && role !== 'ALL') {
          sql += ` AND u.role = ?`;
          params.push(role.toUpperCase());
        }
        if (search) {
          sql += ` AND (u.name LIKE ? OR u.email LIKE ? OR lh.society_id LIKE ?)`;
          const term = `%${search}%`;
          params.push(term, term, term);
        }

        // Timeframe filters
        if (timeframe === 'today') {
          sql += ` AND DATE(lh.login_at) = CURDATE()`;
        } else if (timeframe === 'yesterday') {
          sql += ` AND DATE(lh.login_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`;
        } else if (timeframe === '7days') {
          sql += ` AND lh.login_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
        } else if (timeframe === '30days') {
          sql += ` AND lh.login_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
        }

        sql += ` ORDER BY lh.login_at DESC LIMIT ?`;
        params.push(parseInt(limit, 10) || 100);

        const [rows] = await this.pool.query(sql, params);
        return rows;
      } catch (err) {
        console.warn('[MySQL getLoginHistory error]', err.message);
      }
    }

    // In-memory fallback
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    let list = this.fallbackStore.login_history.map(lh => {
      const u = this.fallbackStore.users.find(usr => usr.clerk_user_id === lh.clerk_user_id);
      const s = this.fallbackStore.societies.find(soc => soc.society_id === lh.society_id);

      return {
        id: lh.id,
        clerk_user_id: lh.clerk_user_id,
        society_id: lh.society_id,
        login_at: lh.login_at,
        logout_at: lh.logout_at,
        user_name: u ? u.name : 'Unknown User',
        email: u ? u.email : 'N/A',
        role: u ? u.role : 'RESIDENT',
        society_name: s ? s.society_name : (lh.society_id ? lh.society_id : 'Leonex Platform')
      };
    });

    if (society_id && society_id !== 'ALL') {
      list = list.filter(l => l.society_id === society_id);
    }
    if (role && role !== 'ALL') {
      const r = role.toUpperCase();
      list = list.filter(l => l.role === r);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        (l.user_name && l.user_name.toLowerCase().includes(q)) ||
        (l.email && l.email.toLowerCase().includes(q)) ||
        (l.society_id && l.society_id.toLowerCase().includes(q))
      );
    }

    if (timeframe) {
      list = list.filter(l => {
        const loginTime = new Date(l.login_at).getTime();
        const diffMs = now - loginTime;
        if (timeframe === 'today') return diffMs <= oneDayMs;
        if (timeframe === 'yesterday') return diffMs > oneDayMs && diffMs <= 2 * oneDayMs;
        if (timeframe === '7days') return diffMs <= 7 * oneDayMs;
        if (timeframe === '30days') return diffMs <= 30 * oneDayMs;
        return true;
      });
    }

    list.sort((a, b) => new Date(b.login_at) - new Date(a.login_at));
    return list.slice(0, parseInt(limit, 10) || 100);
  }

  // ══════════════════════════════════════════════════════════════
  // DYNAMIC DASHBOARD METRICS CALCULATION (ZERO STATIC FIELDS)
  // ══════════════════════════════════════════════════════════════

  async getDashboardMetrics() {
    let metrics = {
      totalSocieties: 0,
      activeSocieties: 0,
      inactiveSocieties: 0,
      suspendedSocieties: 0,
      totalUsers: 0,
      totalResidents: 0,
      totalSecretaries: 0,
      totalGuards: 0,
      totalCommittee: 0
    };

    if (this.isOnline && this.pool) {
      try {
        const [socRows] = await this.pool.query(`
          SELECT 
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN status = 'INACTIVE' THEN 1 ELSE 0 END) AS inactive,
            SUM(CASE WHEN status = 'SUSPENDED' THEN 1 ELSE 0 END) AS suspended
          FROM societies
        `);

        const [userRows] = await this.pool.query(`
          SELECT 
            COUNT(*) AS total,
            SUM(CASE WHEN role = 'RESIDENT' THEN 1 ELSE 0 END) AS residents,
            SUM(CASE WHEN role = 'SECRETARY' THEN 1 ELSE 0 END) AS secretaries,
            SUM(CASE WHEN role = 'GUARD' THEN 1 ELSE 0 END) AS guards,
            SUM(CASE WHEN role = 'COMMITTEE' THEN 1 ELSE 0 END) AS committee
          FROM users
        `);

        if (socRows.length > 0) {
          metrics.totalSocieties = parseInt(socRows[0].total, 10) || 0;
          metrics.activeSocieties = parseInt(socRows[0].active, 10) || 0;
          metrics.inactiveSocieties = parseInt(socRows[0].inactive, 10) || 0;
          metrics.suspendedSocieties = parseInt(socRows[0].suspended, 10) || 0;
        }

        if (userRows.length > 0) {
          metrics.totalUsers = parseInt(userRows[0].total, 10) || 0;
          metrics.totalResidents = parseInt(userRows[0].residents, 10) || 0;
          metrics.totalSecretaries = parseInt(userRows[0].secretaries, 10) || 0;
          metrics.totalGuards = parseInt(userRows[0].guards, 10) || 0;
          metrics.totalCommittee = parseInt(userRows[0].committee, 10) || 0;
        }
      } catch (err) {
        console.warn('[MySQL getDashboardMetrics error]', err.message);
      }
    } else {
      const socs = this.fallbackStore.societies;
      const usrs = this.fallbackStore.users;

      metrics.totalSocieties = socs.length;
      metrics.activeSocieties = socs.filter(s => s.status === 'ACTIVE').length;
      metrics.inactiveSocieties = socs.filter(s => s.status === 'INACTIVE').length;
      metrics.suspendedSocieties = socs.filter(s => s.status === 'SUSPENDED').length;

      metrics.totalUsers = usrs.length;
      metrics.totalResidents = usrs.filter(u => u.role === 'RESIDENT').length;
      metrics.totalSecretaries = usrs.filter(u => u.role === 'SECRETARY').length;
      metrics.totalGuards = usrs.filter(u => u.role === 'GUARD').length;
      metrics.totalCommittee = usrs.filter(u => u.role === 'COMMITTEE').length;
    }

    const recentLogins = await this.getLoginHistory({ limit: 10 });
    const recentSocieties = (await this.getSocieties()).slice(0, 6);

    return {
      metrics,
      recentLogins,
      recentSocieties
    };
  }

  // ══════════════════════════════════════════════════════════════
  // LEGACY OTP OPERATIONS (PRESERVES EXISTING CODE INTEGRITY)
  // ══════════════════════════════════════════════════════════════

  async saveOTP(identifier, code, expiresInMinutes = 5) {
    const cleanId = String(identifier).trim().toLowerCase();
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    this.fallbackStore.otps.set(cleanId, {
      code,
      expiresAt: expiresAt.getTime(),
      isUsed: false
    });

    if (this.isOnline && this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO otp_codes (identifier, otp_code, expires_at, is_used) VALUES (?, ?, ?, 0)`,
          [cleanId, code, expiresAt]
        );
      } catch (e) {}
    }

    return { identifier: cleanId, code, expiresAt };
  }

  async verifyOTP(identifier, code) {
    const cleanId = String(identifier).trim().toLowerCase();
    const cleanCode = String(code).trim();
    const now = Date.now();

    const record = this.fallbackStore.otps.get(cleanId);
    let valid = false;

    if (record && !record.isUsed && record.code === cleanCode && record.expiresAt > now) {
      record.isUsed = true;
      valid = true;
    }

    if (this.isOnline && this.pool) {
      try {
        const [rows] = await this.pool.query(
          `SELECT id, expires_at, is_used FROM otp_codes
           WHERE identifier = ? AND otp_code = ? AND is_used = 0 AND expires_at > NOW()
           ORDER BY id DESC LIMIT 1`,
          [cleanId, cleanCode]
        );
        if (rows.length > 0) {
          valid = true;
          await this.pool.query(`UPDATE otp_codes SET is_used = 1 WHERE id = ?`, [rows[0].id]);
        }
      } catch (e) {}
    }

    return valid;
  }

  // ══════════════════════════════════════════════════════════════
  // CONTACT INQUIRIES & MESSAGES
  // ══════════════════════════════════════════════════════════════

  async saveContactMessage({ name, society_name, email, phone, message }) {
    const contact = {
      id: Date.now(),
      name: (name || '').trim(),
      society_name: (society_name || '').trim(),
      email: (email || '').trim(),
      phone: (phone || '').trim(),
      message: (message || '').trim(),
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };

    if (!this.fallbackStore.contacts) this.fallbackStore.contacts = [];
    this.fallbackStore.contacts.unshift(contact);
    this.saveFallbackStore();

    if (this.isOnline && this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO contact_messages (name, society_name, email, phone, message, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [contact.name, contact.society_name, contact.email, contact.phone, contact.message, contact.created_at]
        );
      } catch (e) {
        console.warn('[MySQL saveContactMessage error]', e.message);
      }
    }

    return contact;
  }

  async getContactMessages() {
    if (this.isOnline && this.pool) {
      try {
        const [rows] = await this.pool.query(
          `SELECT * FROM contact_messages ORDER BY created_at DESC`
        );
        return rows;
      } catch (e) {
        console.warn('[MySQL getContactMessages error]', e.message);
      }
    }
    if (!this.fallbackStore.contacts) this.fallbackStore.contacts = [];
    return this.fallbackStore.contacts;
  }

  async deleteContactMessage(id) {
    if (!this.fallbackStore.contacts) this.fallbackStore.contacts = [];
    this.fallbackStore.contacts = this.fallbackStore.contacts.filter(c => String(c.id) !== String(id));
    this.saveFallbackStore();

    if (this.isOnline && this.pool) {
      try {
        await this.pool.query(`DELETE FROM contact_messages WHERE id = ?`, [id]);
      } catch (e) {}
    }
    return true;
  }

  // ══════════════════════════════════════════════════════════════
  // NEWSLETTER SUBSCRIBERS
  // ══════════════════════════════════════════════════════════════

  async saveSubscriber(email) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const subscriber = {
      id: Date.now(),
      email: cleanEmail,
      status: 'ACTIVE',
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };

    if (!this.fallbackStore.subscribers) this.fallbackStore.subscribers = [];
    const exists = this.fallbackStore.subscribers.find(s => s.email.toLowerCase() === cleanEmail);
    if (!exists) {
      this.fallbackStore.subscribers.unshift(subscriber);
      this.saveFallbackStore();
    }

    if (this.isOnline && this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO newsletter_subscribers (email, status, created_at)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE status = 'ACTIVE'`,
          [subscriber.email, subscriber.status, subscriber.created_at]
        );
      } catch (e) {
        console.warn('[MySQL saveSubscriber error]', e.message);
      }
    }

    return exists || subscriber;
  }

  async getSubscribers() {
    if (this.isOnline && this.pool) {
      try {
        const [rows] = await this.pool.query(
          `SELECT * FROM newsletter_subscribers ORDER BY created_at DESC`
        );
        return rows;
      } catch (e) {
        console.warn('[MySQL getSubscribers error]', e.message);
      }
    }
    if (!this.fallbackStore.subscribers) this.fallbackStore.subscribers = [];
    return this.fallbackStore.subscribers;
  }

  async deleteSubscriber(id) {
    if (!this.fallbackStore.subscribers) this.fallbackStore.subscribers = [];
    this.fallbackStore.subscribers = this.fallbackStore.subscribers.filter(s => String(s.id) !== String(id));
    this.saveFallbackStore();

    if (this.isOnline && this.pool) {
      try {
        await this.pool.query(`DELETE FROM newsletter_subscribers WHERE id = ?`, [id]);
      } catch (e) {}
    }
    return true;
  }
}

const db = new DatabaseManager();
module.exports = db;
