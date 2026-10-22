/**
 * Leonex — Smart Housing Society Management System
 * Database Engine & State Manager (SystemDB)
 *
 * Foundation phase (SEED_VERSION 4.0):
 *  - All legacy methods preserved (pages depend on them).
 *  - New generic helpers: nextId / getCollection / addDoc / updateDoc / deleteDoc.
 *  - New domain collections: expenses, events, documents, notifications,
 *    emergencyAlerts, familyMembers, parkingSlots.
 *  - Complaint, visitor, poll, billing, notification and search APIs added.
 *  - Duplicate updateUserAllocation merged into a single method.
 */

const STORAGE_KEY = 'ssm_database_v1';
const DEMO_STORAGE_KEY = 'ssm_database_demo_v1';
const SEED_VERSION_KEY = 'ssm_seed_version';
const SEED_VERSION = '4.3'; // bump this to force fresh seed load
const SESSION_KEY = 'ssm_current_user';
const TOKEN_KEY = 'ssm_auth_token';

// Complaint status vocabulary. Legacy 'Pending' renders as 'Open'.
const COMPLAINT_STATUSES = ['Open', 'Assigned', 'In Progress', 'Resolved', 'Closed'];
// Visitor type + status flow: Pending → Approved → Checked In → Checked Out | Rejected
const VISITOR_TYPES = ['Guest', 'Delivery', 'Cab', 'Service Provider', 'Staff', 'Other'];
const VISITOR_STATUSES = ['Pending', 'Approved', 'Checked In', 'Checked Out', 'Rejected'];
// Expense categories
const EXPENSE_CATEGORIES = ['Electricity', 'Security', 'Cleaning', 'Repairs', 'Gardening', 'Water', 'Lift Maintenance', 'Staff Salary', 'Other'];

const SystemDB = {
  data: null,

  isDemoMode() {
    const urlParams = (typeof window !== 'undefined' && window.location) ? new URLSearchParams(window.location.search) : null;
    const urlCode = urlParams ? (urlParams.get('code') || urlParams.get('societyCode') || urlParams.get('society')) : null;
    if (urlCode) {
      if (urlCode === 'DEMO01' || urlCode.toLowerCase() === 'demo') return true;
      return false;
    }
    if (urlParams && (urlParams.get('demo') || urlParams.get('mode') === 'demo')) return true;

    if (sessionStorage.getItem('ssm_demo_mode') === 'true') return true;
    const user = this.getCurrentUser();
    if (!user) {
      return true; // Default fallback to demo if no session exists
    }
    if (user.authProvider === 'demo' || user.societyCode === 'DEMO01' || (user.id && String(user.id).startsWith('demo_'))) {
      return true;
    }
    if (user.societyCode && user.societyCode !== 'DEMO01') {
      return false;
    }
    const storedCode = sessionStorage.getItem('ssm_society_code');
    if (storedCode && storedCode !== 'DEMO01') {
      return false;
    }
    return false;
  },

  getSocietyCode() {
    const urlParams = (typeof window !== 'undefined' && window.location) ? new URLSearchParams(window.location.search) : null;
    const urlCode = urlParams ? (urlParams.get('code') || urlParams.get('societyCode') || urlParams.get('society')) : null;
    if (urlCode) return urlCode;

    const user = this.getCurrentUser();
    if (user && user.societyCode) return user.societyCode;
    const stored = sessionStorage.getItem('ssm_society_code');
    if (stored) return stored;
    if (this.isDemoMode()) return 'DEMO01';
    return 'DEMO01';
  },

  getStorageKey() {
    if (this.isDemoMode()) {
      return DEMO_STORAGE_KEY;
    }
    const code = this.getSocietyCode();
    return 'ssm_society_' + code + '_v1';
  },

  async init() {
    const isDemo = this.isDemoMode();
    const activeCode = this.getSocietyCode();
    const activeKey = this.getStorageKey();

    // If a specific society code is requested and not demo, ensure session matches that society
    if (!isDemo && activeCode && activeCode !== 'DEMO01') {
      let cur = this.getCurrentUser();
      if (!cur || cur.societyCode !== activeCode) {
        try {
          const rawSoc = localStorage.getItem('ssm_society_' + activeCode + '_v1');
          if (rawSoc) {
            const parsedSoc = JSON.parse(rawSoc);
            const adminInSoc = (parsedSoc.users || []).find(u => u.role === 'Admin') || (parsedSoc.users || [])[0];
            if (adminInSoc) {
              sessionStorage.setItem(SESSION_KEY, JSON.stringify(adminInSoc));
              sessionStorage.setItem('ssm_society_code', activeCode);
              sessionStorage.setItem('ssm_society_name', parsedSoc.societySettings?.name || `Society ${activeCode}`);
              sessionStorage.removeItem('ssm_demo_mode');
            }
          }
        } catch(e) {}
      }
    }

    // If seed version changed in demo mode, clear demo cache to reload fresh data
    if (isDemo) {
      const storedVersion = localStorage.getItem(SEED_VERSION_KEY);
      if (storedVersion !== SEED_VERSION) {
        localStorage.removeItem(DEMO_STORAGE_KEY);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.setItem(SEED_VERSION_KEY, SEED_VERSION);
      }
    }

    const cached = localStorage.getItem(activeKey);
    if (cached) {
      try {
        this.data = JSON.parse(cached);
      } catch (e) {
        console.error("Failed to parse local DB cache, re-initializing", e);
        localStorage.removeItem(activeKey);
        this.data = null;
      }
    }

    if (!this.data) {
      if (isDemo) {
        try {
          const res = await fetch('../data/seed.json');
          if (res.ok) {
            this.data = await res.json();
          } else {
            this.data = this.getDefaultData();
          }
        } catch (err) {
          this.data = this.getDefaultData();
        }

        // Ensure all default seed members are merged into users array for demo
        const defaults = this.getDefaultData().users;
        if (this.data && this.data.users) {
          defaults.forEach(defUser => {
            if (!this.data.users.some(u => u.id === defUser.id || u.email === defUser.email)) {
              this.data.users.push(defUser);
            }
          });
        }
      } else {
        // ACTUAL REAL SOCIETY: initialize clean empty society data
        const currentUser = this.getCurrentUser();
        const code = this.getSocietyCode();
        this.data = this.createFreshSocietyData(code, currentUser);
      }
    }

    this.save();
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ssm:db-ready'));
        window.dispatchEvent(new CustomEvent('ssm:notification-update'));
      }
    } catch (e) {}
  },

  save() {
    if (this.data) {
      const activeKey = this.getStorageKey();
      localStorage.setItem(activeKey, JSON.stringify(this.data));
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ssm:notification-update'));
        }
      } catch (e) {}
    }
  },

  resetToSeed() {
    localStorage.removeItem(this.getStorageKey());
    return this.init();
  },

  createFreshSocietyData(code, currentUser) {
    let societyInfo = {};
    try {
      const societies = JSON.parse(localStorage.getItem('ssm_societies') || '{}');
      societyInfo = societies[code] || {};
    } catch (e) {}

    const now = new Date().toISOString().split('T')[0];
    const socName = societyInfo.name || currentUser?.societyName || sessionStorage.getItem('ssm_society_name') || `Society ${code}`;

    const users = [];
    if (currentUser) {
      users.push({
        id: currentUser.id || ('admin_' + code),
        username: (currentUser.email ? currentUser.email.split('@')[0] : 'admin'),
        name: currentUser.name || societyInfo.secName || 'Society Administrator',
        role: currentUser.role || 'Admin',
        status: 'Approved',
        flat: currentUser.flat || currentUser.flat_no || (currentUser.role === 'Admin' ? (societyInfo.secFlat || 'Office') : 'A-101'),
        tower: 'Tower A',
        residentType: 'Owner',
        maintenanceDues: '₹0/month',
        parkingSlot: '',
        email: currentUser.email || societyInfo.secEmail || '',
        phone: currentUser.phone || societyInfo.secPhone || '',
        avatar: currentUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser.name || 'Admin')}`,
        registeredAt: now,
        approvedAt: now,
        approvedBy: 'System',
        designation: currentUser.role === 'Admin' ? 'Society Secretary' : 'Resident',
        society: socName,
        societyCode: code
      });
    }

    return {
      societySettings: {
        name: socName,
        code: code,
        address: societyInfo.address || '',
        city: societyInfo.city || '',
        state: societyInfo.state || '',
        pincode: societyInfo.pincode || '',
        towers: societyInfo.towers || 1,
        enableCommitteePortal: true,
        createdAt: now
      },
      users: users,
      maintenance: [],
      complaints: [],
      notices: [],
      visitors: [],
      emergencyAlerts: [],
      documents: [],
      events: [],
      expenses: [],
      parkingSlots: [],
      familyMembers: [],
      auditLogs: [
        {
          id: 'LOG-1001',
          timestamp: new Date().toLocaleString(),
          user: currentUser ? currentUser.name : 'System',
          role: currentUser ? currentUser.role : 'Admin',
          action: 'Society Initialized',
          module: 'System',
          details: `Society '${socName}' initialized with code ${code}`
        }
      ]
    };
  },

  initSociety(code, societyInfo, adminUser) {
    if (!code) return;
    const key = 'ssm_society_' + code + '_v1';
    const data = this.createFreshSocietyData(code, adminUser);
    localStorage.setItem(key, JSON.stringify(data));
    if (this.getSocietyCode() === code) {
      this.data = data;
    }
    return data;
  },

  registerResidentToSociety(code, residentUser) {
    if (!code || !residentUser) return;
    const key = 'ssm_society_' + code + '_v1';
    let data = null;
    try {
      const stored = localStorage.getItem(key);
      if (stored) data = JSON.parse(stored);
    } catch(e) {}

    if (!data) {
      data = this.createFreshSocietyData(code, residentUser);
    } else {
      if (!Array.isArray(data.users)) data.users = [];
      const exists = data.users.some(u => u.id === residentUser.id || (u.email && u.email === residentUser.email));
      if (!exists) {
        data.users.push({
          id: residentUser.id || ('USR-' + Date.now()),
          username: residentUser.email ? residentUser.email.split('@')[0] : ('res_' + Date.now()),
          name: residentUser.name,
          role: 'Resident',
          status: 'Approved',
          flat: residentUser.flat || residentUser.flat_no || '',
          flatNo: residentUser.flat || residentUser.flat_no || '',
          tower: residentUser.tower || 'Tower A',
          residentType: 'Owner',
          maintenanceDues: '₹0/month',
          parkingSlot: '',
          email: residentUser.email || '',
          phone: residentUser.phone || '',
          avatar: residentUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(residentUser.name)}`,
          registeredAt: new Date().toISOString().split('T')[0],
          approvedAt: new Date().toISOString().split('T')[0],
          approvedBy: 'Auto',
          societyCode: code
        });
      }
    }
    localStorage.setItem(key, JSON.stringify(data));
    if (this.getSocietyCode() === code) {
      this.data = data;
    }
    return data;
  },

  // ──────────────────────────────────────────────
  // Generic collection helpers (Foundation)
  // ──────────────────────────────────────────────

  // Numeric, collision-safe id generator: "<prefix>-<n>".
  // Scans every collection for existing ids with this prefix and returns max+1.
  nextId(prefix) {
    const safe = String(prefix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('^' + safe + '-(\\d+)$');
    let max = 0;
    if (this.data) {
      Object.keys(this.data).forEach(key => {
        const col = this.data[key];
        if (Array.isArray(col)) {
          col.forEach(item => {
            if (item && item.id) {
              const m = String(item.id).match(re);
              if (m) {
                const n = parseInt(m[1], 10);
                if (!isNaN(n) && n > max) max = n;
              }
            }
          });
        }
      });
    }
    return prefix + '-' + (max + 1);
  },

  // Returns the named collection, lazily initializing it to [] so stale
  // localStorage caches never crash on missing keys.
  getCollection(name) {
    if (!this.data) this.data = {};
    if (!Array.isArray(this.data[name])) this.data[name] = [];
    return this.data[name];
  },

  // Insert a document with an auto id + createdAt, unshift (newest first), save.
  addDoc(collection, doc, idPrefix) {
    const col = this.getCollection(collection);
    const record = Object.assign({}, doc);
    if (!record.id) record.id = this.nextId(idPrefix || collection.slice(0, 3).toUpperCase());
    if (!record.createdAt) record.createdAt = new Date().toISOString();
    col.unshift(record);
    this.save();
    return { success: true, doc: record };
  },

  // Patch a document by id.
  updateDoc(collection, id, patch) {
    const col = this.getCollection(collection);
    const doc = col.find(d => d.id === id);
    if (!doc) return { success: false, message: 'Record not found' };
    Object.assign(doc, patch || {});
    this.save();
    return { success: true, doc };
  },

  // Remove a document by id.
  deleteDoc(collection, id) {
    const col = this.getCollection(collection);
    const idx = col.findIndex(d => d.id === id);
    if (idx === -1) return { success: false, message: 'Record not found' };
    const removed = col.splice(idx, 1)[0];
    this.save();
    return { success: true, doc: removed };
  },

  // ──────────────────────────────────────────────
  // Date / formatting utilities
  // ──────────────────────────────────────────────
  _nowStamp() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  },

  _parseStamp(s) {
    if (!s || s === 'Still In Society') return null;
    const d = new Date(String(s).replace(' ', 'T'));
    return isNaN(d.getTime()) ? null : d;
  },

  _monthNames() {
    return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  },

  _currentMonthLabel() {
    const d = new Date();
    return this._monthNames()[d.getMonth()] + ' ' + d.getFullYear();
  },

  // 'August 2026' -> '2026-08'
  _monthSlug(monthLabel) {
    const parts = String(monthLabel || '').split(/\s+/);
    const mi = this._monthNames().indexOf(parts[0]);
    const year = parts[1] || String(new Date().getFullYear());
    if (mi === -1) return year;
    return year + '-' + String(mi + 1).padStart(2, '0');
  },

  // Last day of the month for a label like 'August 2026' -> '2026-08-31'
  _monthDueDate(monthLabel) {
    const parts = String(monthLabel || '').split(/\s+/);
    const mi = this._monthNames().indexOf(parts[0]);
    const year = parseInt(parts[1], 10) || new Date().getFullYear();
    if (mi === -1) return new Date().toISOString().split('T')[0];
    const last = new Date(year, mi + 1, 0).getDate();
    return year + '-' + String(mi + 1).padStart(2, '0') + '-' + String(last).padStart(2, '0');
  },

  // Resolve a resident's monthly maintenance amount from numeric or ₹-string fields.
  _resolveMaintenanceAmount(u) {
    const candidates = [u.maintenanceAmount, u.maintenanceDues];
    for (const c of candidates) {
      if (c === undefined || c === null || c === '') continue;
      const n = parseInt(String(c).replace(/[^0-9]/g, ''), 10);
      if (!isNaN(n) && n > 0) return n;
    }
    return 3500;
  },

  // ──────────────────────────────────────────────
  // JWT Token Management
  // ──────────────────────────────────────────────

  setToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    }
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  },

  authHeaders() {
    const token = this.getToken();
    return token ? { 'Authorization': 'Bearer ' + token } : {};
  },

  // Auth Operations
  login(username, password) {
    // Auth now handled server-side via firebase-auth.js -> /api/auth/login
    // This method is kept as a synchronous fallback for the local data layer
    // but no longer performs password comparison (passwords are hashed server-side).
    return { success: false, message: 'Authentication is handled server-side. Please use the login form.' };
  },

  getCurrentUser() {
    const sess = sessionStorage.getItem(SESSION_KEY);
    return sess ? JSON.parse(sess) : null;
  },

  logout() {
    this.clearToken();
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem('ssm_demo_mode');
    sessionStorage.removeItem('ssm_society_code');
    sessionStorage.removeItem('ssm_society_name');
    sessionStorage.removeItem('ssm_clerk_user');
  },

  // Users
  getUsers() {
    return (this.data && this.data.users) ? this.data.users : [];
  },

  getUserById(id) {
    return this.getUsers().find(u => u.id === id || u.email === id) || null;
  },

  saveUsers(users) {
    if (!this.data) this.data = {};
    this.data.users = users;
    this.save();
    return { success: true };
  },

  // Residents Operations
  getResidents() {
    return this.data.users.filter(u => u.role === 'Resident' || u.role === 'Admin');
  },

  addResident(residentData) {
    // Note: password hashing is handled server-side via /api/auth/register
    // The password field is not stored in localStorage for security
    const newId = 'USR-' + Math.floor(100 + Math.random() * 900);
    const newResident = {
      id: newId,
      username: residentData.username || residentData.email.split('@')[0],
      name: residentData.name,
      role: 'Resident',
      flat: residentData.flat,
      email: residentData.email,
      phone: residentData.phone,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(residentData.name)}`
    };
    this.data.users.push(newResident);

    // Also auto-generate July maintenance bill for new resident
    this.data.maintenance.push({
      id: 'INV-2026-07-' + Math.floor(100 + Math.random() * 900),
      residentName: newResident.name,
      flat: newResident.flat,
      month: 'July 2026',
      amount: 3500,
      status: 'Unpaid',
      dueDate: '2026-07-31',
      txnId: null,
      paymentDate: null,
      receiptNo: null
    });

    this.save();
    return { success: true, resident: newResident };
  },

  updateUserRole(userId, newRole) {
    const user = this.data.users.find(u => u.id === userId || u.email === userId);
    if (user) {
      user.role = newRole;
      this.save();
      // If current logged in user changed their own role, update session
      const curr = this.getCurrentUser();
      if (curr && (curr.id === userId || curr.email === userId)) {
        curr.role = newRole;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(curr));
      }
      return { success: true, user };
    }
    return { success: false, message: 'User not found' };
  },

  isCommitteeEnabled() {
    if (!this.data || !this.data.societySettings) return true;
    return this.data.societySettings.enableCommitteePortal !== false;
  },

  setCommitteeEnabled(enabled) {
    if (!this.data) return { success: false, message: 'Database not initialized' };
    if (!this.data.societySettings) this.data.societySettings = {};
    const state = !!enabled;
    this.data.societySettings.enableCommitteePortal = state;
    this.save();
    this.logAudit(
      state ? 'Committee Portal Enabled' : 'Committee Portal Disabled',
      'Society Governance',
      `Society Secretary ${state ? 'activated' : 'deactivated'} the Committee Member portal & governance module.`
    );
    return { success: true, enabled: state };
  },

  // MERGED: single allocation method handling both Resident and Security Guard
  // paths, plus maintenance-bill generation for the allotted flat.
  updateUserAllocation(userId, allocData) {
    const user = this.data.users.find(u => u.id === userId || u.email === userId);
    if (!user) return { success: false, message: 'User not found' };

    user.status = 'Approved';

    if (allocData.role === 'Security Guard') {
      // ── Security Guard allocation path ──
      user.role = 'Security Guard';
      user.empId = allocData.empId || user.empId || 'EMP-' + Math.floor(100 + Math.random() * 900);
      user.shift = allocData.shift || user.shift || 'Morning (06:00 - 14:00)';
      user.gateAssigned = allocData.gateAssigned || user.gateAssigned || 'Gate 1';
      user.salary = allocData.salary || user.salary || '₹18,000/month';
      user.permissions = allocData.permissions || user.permissions || 'Gate Pass Logging & Visitor Verification';
      user.flat = user.gateAssigned;
    } else {
      // ── Resident allocation path ──
      user.role = allocData.role || 'Resident';
      user.tower = allocData.tower || user.tower || 'Tower A';
      user.floor = allocData.floor || user.floor;
      user.flat = allocData.flat || allocData.flatNo || user.flat;
      user.flatNo = user.flat;
      user.residentType = allocData.type || allocData.residentType || user.residentType || 'Owner';
      user.rentAmount = allocData.rentAmount || user.rentAmount || '₹15,000/month';
      user.maintenanceAmount = allocData.maintenance || user.maintenanceAmount;
      user.maintenanceDues = allocData.maintenanceDues || user.maintenanceDues || '₹3,500/month';
      user.parkingSlot = allocData.parking || allocData.parkingSlot || user.parkingSlot || 'P-14';
      user.block = allocData.block || user.block || 'Phase 1';
      user.moveInDate = allocData.moveInDate || user.moveInDate || '2024-01-15';
      user.familyCount = allocData.familyCount || user.familyCount || '4 Members';
      if (allocData.vehicles) user.vehicles = allocData.vehicles;
      if (allocData.familyMembers) user.familyMembers = allocData.familyMembers;

      // Auto-generate a maintenance bill for the allotted flat if not existing
      if (user.flat) {
        const monthLabel = allocData.monthLabel || this._currentMonthLabel();
        const dueDate = allocData.dueDate || this._monthDueDate(monthLabel);
        if (!Array.isArray(this.data.maintenance)) this.data.maintenance = [];
        const exists = this.data.maintenance.some(b => b.flat === user.flat && b.month === monthLabel);
        if (!exists) {
          this.data.maintenance.push({
            id: this.nextId('INV-' + this._monthSlug(monthLabel)),
            residentName: user.name,
            flat: user.flat,
            month: monthLabel,
            amount: this._resolveMaintenanceAmount(user),
            status: 'Unpaid',
            dueDate: dueDate,
            txnId: null,
            paymentDate: null,
            receiptNo: null
          });
        }
      }
    }

    this.save();

    // If current logged in user, sync session
    const curr = this.getCurrentUser();
    if (curr && (curr.id === userId || curr.email === userId)) {
      Object.assign(curr, user);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(curr));
    }
    this.logAudit('User Allocation Updated', 'Admin', `${user.name} allotted as ${user.role} (${user.flat || 'N/A'})`);
    return { success: true, user: user };
  },

  deleteResident(userId) {
    this.data.users = this.data.users.filter(u => u.id !== userId);
    this.save();
    return { success: true };
  },

  // ──────────────────────────────────────────────
  // Towers & Flats Infrastructure
  // ──────────────────────────────────────────────
  getTowers() {
    const defaultTowers = [
      { id: 'TOW-A', name: 'Tower A', wing: 'Emerald Block', prefix: 'A', totalFlats: 20, floors: 5 },
      { id: 'TOW-B', name: 'Tower B', wing: 'Sapphire Block', prefix: 'B', totalFlats: 20, floors: 5 },
      { id: 'TOW-C', name: 'Tower C', wing: 'Diamond Block', prefix: 'C', totalFlats: 20, floors: 5 }
    ];
    if (this.data && Array.isArray(this.data.towers) && this.data.towers.length > 0) {
      return this.data.towers.map(t => {
        const parts = t.name.split(' - ');
        const shortName = parts[0].trim();
        const wingName = parts[1] ? parts[1].trim() : (t.wing || (shortName + ' Wing'));
        const prefix = shortName.replace(/[^A-Z]/gi, '').slice(-1) || 'A';
        return {
          id: t.id || ('TOW-' + prefix),
          name: shortName,
          fullName: t.name,
          wing: wingName,
          prefix: prefix,
          floors: t.floors || 5,
          totalFlats: t.totalFlats || 20
        };
      });
    }
    return defaultTowers;
  },

  getFlats() {
    if (!this.data) return [];
    if (!Array.isArray(this.data.flats) || this.data.flats.length < 20) {
      this.data.flats = this._generateDefaultFlats();
      this.save();
    }
    const users = this.data.users || [];
    return this.data.flats.map(flat => {
      // Normalize tower name
      const towerNorm = (flat.tower || 'Tower A').split(' - ')[0].trim();
      const floorNum = parseInt(flat.floor, 10) || (flat.floorLabel ? parseInt(flat.floorLabel, 10) : 1) || 1;
      const floorLabel = flat.floorLabel || `${floorNum}${floorNum === 1 ? 'st' : floorNum === 2 ? 'nd' : floorNum === 3 ? 'rd' : 'th'} Floor`;

      const occupant = users.find(u => (u.flat === flat.flatNo || u.flatNo === flat.flatNo) && u.role !== 'Security Guard' && u.status !== 'Rejected');
      if (occupant) {
        return {
          ...flat,
          tower: towerNorm,
          floor: floorNum,
          floorLabel: floorLabel,
          status: 'Occupied',
          occupantId: occupant.id,
          occupantName: occupant.name,
          occupantEmail: occupant.email,
          occupantPhone: occupant.phone,
          occupantAvatar: occupant.avatar,
          occupantType: occupant.residentType || 'Owner',
          parkingSlot: occupant.parkingSlot || flat.parkingSlot || flat.parking
        };
      } else if (flat.occupancy === 'Owner Occupied' || flat.occupancy === 'Rented' || flat.owner || flat.tenant) {
        const isRented = flat.occupancy === 'Rented' || flat.residentType === 'Tenant';
        const name = isRented ? (flat.tenant || flat.owner) : (flat.owner || flat.tenant);
        return {
          ...flat,
          tower: towerNorm,
          floor: floorNum,
          floorLabel: floorLabel,
          status: 'Occupied',
          occupantId: null,
          occupantName: name,
          occupantEmail: null,
          occupantPhone: null,
          occupantAvatar: null,
          occupantType: isRented ? 'Tenant' : 'Owner',
          parkingSlot: flat.parkingSlot || flat.parking
        };
      } else {
        return {
          ...flat,
          tower: towerNorm,
          floor: floorNum,
          floorLabel: floorLabel,
          status: 'Vacant',
          occupantId: null,
          occupantName: null,
          occupantEmail: null,
          occupantPhone: null,
          occupantAvatar: null,
          occupantType: null
        };
      }
    });
  },

  _generateDefaultFlats() {
    const existing = Array.isArray(this.data && this.data.flats) ? this.data.flats : [];
    const flats = [];
    const towers = [
      { name: 'Tower A', wing: 'Emerald Block', prefix: 'A' },
      { name: 'Tower B', wing: 'Sapphire Block', prefix: 'B' },
      { name: 'Tower C', wing: 'Diamond Block', prefix: 'C' }
    ];

    towers.forEach(t => {
      for (let floor = 1; floor <= 5; floor++) {
        for (let unit = 1; unit <= 4; unit++) {
          const flatNo = `${t.prefix}-${floor}0${unit}`;
          const is3BHK = unit >= 3;
          const prev = existing.find(f => f.flatNo === flatNo);
          flats.push({
            id: 'FLAT-' + flatNo,
            flatNo: flatNo,
            tower: t.name,
            wing: t.wing,
            floor: floor,
            floorLabel: `${floor}${floor === 1 ? 'st' : floor === 2 ? 'nd' : floor === 3 ? 'rd' : 'th'} Floor`,
            bhk: prev?.bhk || (is3BHK ? '3 BHK' : '2 BHK'),
            areaSqFt: prev?.areaSqFt || (is3BHK ? 1450 : 1080),
            parkingSlot: prev?.parkingSlot || prev?.parking || `P-${t.prefix}${floor}0${unit}`,
            maintenanceAmount: prev?.dues || prev?.maintenanceAmount || (is3BHK ? 4200 : 3500),
            owner: prev?.owner || null,
            tenant: prev?.tenant || null,
            residentType: prev?.residentType || null,
            occupancy: prev?.occupancy || null
          });
        }
      }
    });

    // Also include any user flat from this.data.users that wasn't in standard grid
    if (this.data && Array.isArray(this.data.users)) {
      this.data.users.forEach(u => {
        if (!u.flat || u.role === 'Security Guard') return;
        const exists = flats.some(f => f.flatNo === u.flat);
        if (!exists) {
          const towerName = (u.tower || (u.flat.startsWith('B') ? 'Tower B' : u.flat.startsWith('C') ? 'Tower C' : 'Tower A')).split(' - ')[0].trim();
          const floorMatch = u.flat.match(/\d+/);
          const floorNum = floorMatch ? Math.floor(parseInt(floorMatch[0], 10) / 100) : 1;
          flats.push({
            id: 'FLAT-' + u.flat,
            flatNo: u.flat,
            tower: towerName,
            wing: towerName === 'Tower B' ? 'Sapphire Block' : towerName === 'Tower C' ? 'Diamond Block' : 'Emerald Block',
            floor: floorNum || 1,
            floorLabel: `${floorNum || 1}st Floor`,
            bhk: '2 BHK',
            areaSqFt: 1100,
            parkingSlot: u.parkingSlot || `P-${u.flat}`,
            maintenanceAmount: 3500
          });
        }
      });
    }

    // Also preserve any custom flats from existing
    existing.forEach(f => {
      if (!flats.some(x => x.flatNo === f.flatNo)) {
        const floorNum = parseInt(f.floor, 10) || 1;
        flats.push({
          ...f,
          floor: floorNum,
          floorLabel: `${floorNum}th Floor`
        });
      }
    });

    return flats;
  },

  addFlat(flatData) {
    if (!this.data) return { success: false, message: 'DB not ready' };
    if (!Array.isArray(this.data.flats)) this.data.flats = this._generateDefaultFlats();

    const flatNo = (flatData.flatNo || '').trim().toUpperCase();
    if (!flatNo) return { success: false, message: 'Flat number is required' };

    const exists = this.data.flats.some(f => f.flatNo.toUpperCase() === flatNo);
    if (exists) return { success: false, message: `Flat ${flatNo} already exists!` };

    const floorNum = parseInt(flatData.floor, 10) || 1;
    const newFlat = {
      id: 'FLAT-' + flatNo,
      flatNo: flatNo,
      tower: flatData.tower || 'Tower A',
      wing: flatData.wing || (flatData.tower === 'Tower B' ? 'Meadows Wing' : flatData.tower === 'Tower C' ? 'Greenview Wing' : 'Sunrise Wing'),
      floor: floorNum,
      floorLabel: `${floorNum}${floorNum === 1 ? 'st' : floorNum === 2 ? 'nd' : floorNum === 3 ? 'rd' : 'th'} Floor`,
      bhk: flatData.bhk || '2 BHK',
      areaSqFt: parseInt(flatData.areaSqFt, 10) || 1100,
      parkingSlot: flatData.parkingSlot || `P-${flatNo}`,
      maintenanceAmount: parseInt(flatData.maintenanceAmount, 10) || 3500
    };

    this.data.flats.push(newFlat);
    this.save();
    this.logAudit('Flat Created', 'Towers & Flats', `Added unit ${flatNo} in ${newFlat.tower}`);
    return { success: true, flat: newFlat };
  },

  deleteFlat(flatNo) {
    if (!this.data || !Array.isArray(this.data.flats)) return { success: false, message: 'DB not ready' };
    this.data.flats = this.data.flats.filter(f => f.flatNo !== flatNo);
    this.save();
    this.logAudit('Flat Deleted', 'Towers & Flats', `Removed flat ${flatNo}`);
    return { success: true };
  },

  // ──────────────────────────────────────────────
  // Complaints
  // ──────────────────────────────────────────────
  getComplaints() {
    return this.data.complaints || [];
  },

  // Map legacy statuses onto the current vocabulary ('Pending' -> 'Open').
  normalizeComplaintStatus(status) {
    if (status === 'Pending') return 'Open';
    return status || 'Open';
  },

  _complaintTimeline(cmp, action, note) {
    if (!Array.isArray(cmp.timeline)) cmp.timeline = [];
    const user = this.getCurrentUser();
    cmp.timeline.push({
      at: new Date().toISOString(),
      by: user ? user.name : 'System',
      action: action,
      note: note || ''
    });
  },

  addComplaint(complaint) {
    const user = this.getCurrentUser();
    const newComplaint = {
      id: 'CMP-' + Math.floor(100 + Math.random() * 900),
      residentId: user ? user.id : '',
      residentName: user ? user.name : complaint.residentName,
      flat: user ? user.flat : complaint.flat,
      category: complaint.category,
      title: complaint.title,
      description: complaint.description,
      status: 'Open',
      assignedTo: '',
      priority: complaint.priority || 'Medium',
      date: new Date().toISOString().split('T')[0],
      notes: 'Complaint submitted by resident.',
      timeline: []
    };
    this._complaintTimeline(newComplaint, 'Submitted', 'Complaint submitted by resident.');
    this.data.complaints.unshift(newComplaint);
    this.save();
    this.logAudit('Complaint Submitted', 'Complaints', `${newComplaint.id}: ${newComplaint.title}`);
    this.notify({
      target: 'Admin', type: 'complaint',
      title: 'New Complaint: ' + newComplaint.title,
      message: `${newComplaint.residentName} (${newComplaint.flat}) reported a ${newComplaint.category} issue.`,
      link: 'admin.html'
    });
    return { success: true, complaint: newComplaint };
  },

  updateComplaintStatus(id, status, notes) {
    const cmp = this.data.complaints.find(c => c.id === id);
    if (cmp) {
      cmp.status = status;
      if (notes) cmp.notes = notes;
      this._complaintTimeline(cmp, 'Status → ' + status, notes || ('Status changed to ' + status));
      this.save();
      this.logAudit('Complaint Status Updated', 'Complaints', `${id} → ${status}`);
      return { success: true, complaint: cmp };
    }
    return { success: false, message: 'Complaint not found' };
  },

  // Assign a complaint to a staff member; appends a timeline entry.
  assignComplaint(id, staffName, note) {
    const cmp = (this.data.complaints || []).find(c => c.id === id);
    if (!cmp) return { success: false, message: 'Complaint not found' };
    cmp.assignedTo = staffName || '';
    if (cmp.status === 'Pending' || cmp.status === 'Open') cmp.status = 'Assigned';
    this._complaintTimeline(cmp, 'Assigned', note || ('Assigned to ' + (staffName || 'staff') + '.'));
    this.save();
    this.logAudit('Complaint Assigned', 'Complaints', `${id} assigned to ${staffName || 'staff'}`);
    return { success: true, complaint: cmp };
  },

  // Append a free-form note to a complaint timeline.
  addComplaintNote(id, note) {
    const cmp = (this.data.complaints || []).find(c => c.id === id);
    if (!cmp) return { success: false, message: 'Complaint not found' };
    this._complaintTimeline(cmp, 'Note', note || '');
    if (note) cmp.notes = note;
    this.save();
    return { success: true, complaint: cmp };
  },

  // ──────────────────────────────────────────────
  // Maintenance / Billing
  // ──────────────────────────────────────────────
  getMaintenance() {
    return this.data.maintenance || [];
  },

  payMaintenance(billId, paymentMethod) {
    const bill = this.data.maintenance.find(m => m.id === billId);
    if (!bill) return { success: false, message: 'Bill not found' };
    if (bill.status === 'Paid') return { success: false, message: 'Bill is already paid' };

    bill.status = 'Paid';
    bill.paymentDate = new Date().toISOString().split('T')[0];
    bill.txnId = 'TXN' + Math.floor(100000000 + Math.random() * 900000000);
    bill.receiptNo = 'REC-2026-' + Math.floor(100 + Math.random() * 900);
    bill.paymentMethod = paymentMethod || 'UPI / Online Card';

    this.save();
    this.logAudit('Maintenance Bill Payment', 'Billing', `Paid ${bill.id} ₹${bill.amount} (${bill.paymentMethod})`);
    return { success: true, bill: bill };
  },

  // Generate an Unpaid bill for every Resident/Admin with a flat who has no bill
  // for the given month yet. Amount from maintenanceAmount / maintenanceDues / 3500.
  generateMonthlyBills(monthLabel, dueDate) {
    if (!this.data) return { success: false, message: 'DB not initialized' };
    if (!Array.isArray(this.data.maintenance)) this.data.maintenance = [];
    const label = monthLabel || this._currentMonthLabel();
    const due = dueDate || this._monthDueDate(label);
    const candidates = this.data.users.filter(u =>
      (u.role === 'Resident' || u.role === 'Admin') && u.flat && u.status !== 'Pending'
    );
    let created = 0;
    candidates.forEach(u => {
      const exists = this.data.maintenance.some(b => b.flat === u.flat && b.month === label);
      if (exists) return;
      this.data.maintenance.push({
        id: this.nextId('INV-' + this._monthSlug(label)),
        residentName: u.name,
        flat: u.flat,
        month: label,
        amount: this._resolveMaintenanceAmount(u),
        status: 'Unpaid',
        dueDate: due,
        txnId: null,
        paymentDate: null,
        receiptNo: null
      });
      created++;
    });
    this.save();
    this.logAudit('Monthly Bills Generated', 'Billing', `${created} bill(s) created for ${label}`);
    if (created > 0) {
      this.notify({
        target: 'Resident', type: 'bill',
        title: 'Maintenance Bill Generated',
        message: `Your ${label} maintenance bill is now available. Due by ${due}.`,
        link: 'resident.html'
      });
    }
    return { success: true, created: created, month: label };
  },

  // Collection stats for a month: {billed, collected, pending, pct}
  getCollectionStats(monthLabel) {
    const bills = this.getCollection('maintenance');
    const inMonth = monthLabel ? bills.filter(b => b.month === monthLabel) : bills;
    const billed = inMonth.reduce((s, b) => s + (Number(b.amount) || 0), 0);
    const collected = inMonth.filter(b => b.status === 'Paid').reduce((s, b) => s + (Number(b.amount) || 0), 0);
    const pending = billed - collected;
    const pct = billed > 0 ? Math.round((collected / billed) * 100) : 0;
    return { billed, collected, pending, pct };
  },

  // ──────────────────────────────────────────────
  // Visitor Operations
  // ──────────────────────────────────────────────
  getVisitors() {
    return this.data.visitors || [];
  },

  _deriveVisitorType(purpose, explicit) {
    if (explicit && VISITOR_TYPES.includes(explicit)) return explicit;
    const p = String(purpose || '').toLowerCase();
    if (/(deliver|courier|amazon|swiggy|zomato|parcel|food)/.test(p)) return 'Delivery';
    if (/(cab|taxi|uber|ola|rapido)/.test(p)) return 'Cab';
    if (/(plumb|electric|repair|mistry|service|mainten|paint|carpent|clean)/.test(p)) return 'Service Provider';
    if (/(staff|guard|housekeep|security)/.test(p)) return 'Staff';
    if (/(guest|friend|family|visit|relative)/.test(p)) return 'Guest';
    return 'Other';
  },

  _visitorTimeline(vis, action, note) {
    if (!Array.isArray(vis.timeline)) vis.timeline = [];
    const user = this.getCurrentUser();
    vis.timeline.push({
      at: this._nowStamp(),
      by: user ? user.name : 'Security Gate',
      action: action,
      note: note || ''
    });
  },

  addVisitor(visitorData) {
    const type = this._deriveVisitorType(visitorData.purpose, visitorData.type);
    const newVisitor = {
      id: 'VIS-' + Math.floor(100 + Math.random() * 900),
      name: visitorData.name,
      phone: visitorData.phone,
      flat: visitorData.flat,
      residentName: visitorData.residentName || 'Resident of ' + visitorData.flat,
      purpose: visitorData.purpose,
      type: type,
      vehicleNo: visitorData.vehicleNo || 'N/A',
      entryTime: new Date().toISOString().replace('T', ' ').substring(0, 16),
      exitTime: 'Still In Society',
      status: 'Pending',
      durationMins: null,
      gatePassCode: 'GP-' + Math.floor(1000 + Math.random() * 9000),
      preApproved: !!visitorData.preApproved,
      timeline: []
    };
    this._visitorTimeline(newVisitor, 'Created', newVisitor.preApproved ? 'Pre-approved visitor entry logged.' : 'Visitor entry logged at gate.');
    this.data.visitors.unshift(newVisitor);
    this.save();
    this.logAudit('Visitor Entry Created', 'Gate Security', `${newVisitor.name} (${type}) → Flat ${newVisitor.flat}`);
    return { success: true, visitor: newVisitor };
  },

  updateVisitorStatus(id, status) {
    const vis = this.data.visitors.find(v => v.id === id);
    if (vis) {
      vis.status = status;
      this._visitorTimeline(vis, 'Status → ' + status, 'Status updated to ' + status + '.');
      this.save();
      return { success: true, visitor: vis };
    }
    return { success: false };
  },

  markVisitorExit(id) {
    const vis = this.data.visitors.find(v => v.id === id);
    if (vis) {
      vis.exitTime = new Date().toISOString().replace('T', ' ').substring(0, 16);
      this.save();
      return { success: true, visitor: vis };
    }
    return { success: false };
  },

  // Visitor lifecycle: Pending → Approved → Checked In → Checked Out | Rejected
  approveVisitor(id) {
    const vis = (this.data.visitors || []).find(v => v.id === id);
    if (!vis) return { success: false, message: 'Visitor not found' };
    vis.status = 'Approved';
    this._visitorTimeline(vis, 'Approved', 'Entry approved for Flat ' + (vis.flat || '') + '.');
    this.save();
    this.logAudit('Visitor Approved', 'Gate Security', `${vis.name} approved → Flat ${vis.flat}`);
    return { success: true, visitor: vis };
  },

  rejectVisitor(id) {
    const vis = (this.data.visitors || []).find(v => v.id === id);
    if (!vis) return { success: false, message: 'Visitor not found' };
    vis.status = 'Rejected';
    this._visitorTimeline(vis, 'Rejected', 'Entry denied at gate.');
    this.save();
    this.logAudit('Visitor Rejected', 'Gate Security', `${vis.name} denied entry → Flat ${vis.flat}`);
    return { success: true, visitor: vis };
  },

  checkInVisitor(id) {
    const vis = (this.data.visitors || []).find(v => v.id === id);
    if (!vis) return { success: false, message: 'Visitor not found' };
    vis.status = 'Checked In';
    vis.entryTime = this._nowStamp();
    this._visitorTimeline(vis, 'Checked In', 'Visitor entered the society.');
    this.save();
    this.logAudit('Visitor Checked In', 'Gate Security', `${vis.name} checked in → Flat ${vis.flat}`);
    return { success: true, visitor: vis };
  },

  checkOutVisitor(id) {
    const vis = (this.data.visitors || []).find(v => v.id === id);
    if (!vis) return { success: false, message: 'Visitor not found' };
    vis.status = 'Checked Out';
    vis.exitTime = this._nowStamp();
    const entry = this._parseStamp(vis.entryTime);
    const exit = this._parseStamp(vis.exitTime);
    if (entry && exit) vis.durationMins = Math.max(0, Math.round((exit - entry) / 60000));
    this._visitorTimeline(vis, 'Checked Out', vis.durationMins != null ? ('Visit duration ' + vis.durationMins + ' min.') : 'Visitor left the society.');
    this.save();
    this.logAudit('Visitor Checked Out', 'Gate Security', `${vis.name} checked out from Flat ${vis.flat}`);
    return { success: true, visitor: vis };
  },

  // ──────────────────────────────────────────────
  // Notices
  // ──────────────────────────────────────────────
  getNotices() {
    return this.data.notices || [];
  },

  addNotice(notice) {
    const user = this.getCurrentUser();
    const newNotice = {
      id: 'NOT-' + Math.floor(100 + Math.random() * 900),
      title: notice.title,
      category: notice.category || 'General',
      postedBy: user ? user.name : 'Admin',
      date: new Date().toISOString().split('T')[0],
      content: notice.content
    };
    this.data.notices.unshift(newNotice);
    this.save();
    this.logAudit('Notice Published', 'Notices', newNotice.title);
    this.notify({
      target: 'all', type: 'notice',
      title: 'New Notice: ' + newNotice.title,
      message: newNotice.content,
      link: 'resident.html'
    });
    return { success: true, notice: newNotice };
  },

  deleteNotice(id) {
    this.data.notices = this.data.notices.filter(n => n.id !== id);
    this.save();
    return { success: true };
  },

  // ──────────────────────────────────────────────
  // Amenities & Booking
  // ──────────────────────────────────────────────
  getAmenities() {
    return this.data.amenities || [];
  },

  getBookings() {
    return this.data.bookings || [];
  },

  bookAmenity(bookingData) {
    const user = this.getCurrentUser();

    // Check for double booking conflict
    const existing = this.data.bookings.find(
      b => b.amenityId === bookingData.amenityId &&
           b.date === bookingData.date &&
           b.timeSlot === bookingData.timeSlot &&
           b.status !== 'Cancelled'
    );

    if (existing) {
      return {
        success: false,
        message: `Conflict: This amenity is already booked by ${existing.residentName} (${existing.flat}) for ${bookingData.date} [${bookingData.timeSlot}]!`
      };
    }

    const amenity = this.data.amenities.find(a => a.id === bookingData.amenityId);
    const newBooking = {
      id: 'BK-' + Math.floor(100 + Math.random() * 900),
      amenityId: bookingData.amenityId,
      amenityName: amenity ? amenity.name : bookingData.amenityName,
      residentName: bookingData.residentName || (user ? user.name : 'Resident'),
      flat: bookingData.flat || (user ? user.flat : ''),
      date: bookingData.date,
      timeSlot: bookingData.timeSlot,
      purpose: bookingData.purpose,
      amount: amenity ? amenity.rate : 1000,
      status: 'Confirmed'
    };

    this.data.bookings.unshift(newBooking);
    this.save();
    this.logAudit('Amenity Booked', 'Amenities', `${newBooking.amenityName} on ${newBooking.date} [${newBooking.timeSlot}]`);
    return { success: true, booking: newBooking };
  },

  cancelBooking(bookingId) {
    const booking = (this.data.bookings || []).find(b => b.id === bookingId);
    if (!booking) return { success: false, message: 'Booking not found' };
    booking.status = 'Cancelled';
    this.save();
    this.logAudit('Amenity Booking Cancelled', 'Amenities', `${booking.amenityName} on ${booking.date}`);
    return { success: true, booking };
  },

  addAmenity(amenityData) {
    if (!this.data) return { success: false, message: 'DB not ready' };
    if (!Array.isArray(this.data.amenities)) this.data.amenities = [];
    const newAmenity = {
      id: 'AMN-' + Math.floor(100 + Math.random() * 900),
      name: amenityData.name,
      capacity: parseInt(amenityData.capacity, 10) || 50,
      rate: parseInt(amenityData.rate, 10) || 0,
      icon: amenityData.icon || 'fa-building',
      description: amenityData.description || 'Community facility.',
      status: amenityData.status || 'Active',
      slots: amenityData.slots || ['Morning (09:00 AM - 02:00 PM)', 'Evening (05:00 PM - 11:00 PM)']
    };
    this.data.amenities.push(newAmenity);
    this.save();
    this.logAudit('Amenity Created', 'Amenities', `Added facility ${newAmenity.name}`);
    return { success: true, amenity: newAmenity };
  },

  deleteAmenity(amenityId) {
    if (!this.data || !Array.isArray(this.data.amenities)) return { success: false };
    this.data.amenities = this.data.amenities.filter(a => a.id !== amenityId);
    this.save();
    this.logAudit('Amenity Deleted', 'Amenities', `Removed facility ${amenityId}`);
    return { success: true };
  },

  updateBookingStatus(bookingId, newStatus) {
    if (!this.data || !Array.isArray(this.data.bookings)) return { success: false };
    const booking = this.data.bookings.find(b => b.id === bookingId);
    if (!booking) return { success: false, message: 'Booking not found' };
    booking.status = newStatus;
    this.save();
    this.logAudit('Amenity Booking Updated', 'Amenities', `${booking.id} → ${newStatus}`);
    return { success: true, booking };
  },

  getAuditLogs() {
    return (this.data && this.data.auditLogs) ? this.data.auditLogs : [];
  },

  // ──────────────────────────────────────────────
  // Polls
  // ──────────────────────────────────────────────
  getPolls() {
    return (this.data && this.data.polls) ? this.data.polls : [];
  },

  addPoll(pollData) {
    if (!this.data) return;
    if (!this.data.polls) this.data.polls = [];
    const curUser = this.getCurrentUser();
    const userName = curUser ? curUser.name : 'Committee Member';

    const newPoll = {
      id: 'POL-' + Math.floor(100 + Math.random() * 900),
      title: pollData.title,
      category: pollData.category || 'General',
      description: pollData.description || '',
      options: pollData.options.map((opt, i) => ({ id: 'opt' + (i + 1), text: opt, votes: 0 })),
      voters: [],
      totalVotes: 0,
      status: 'Active',
      createdDate: new Date().toISOString().split('T')[0],
      endDate: pollData.endDate || '2026-08-31',
      createdBy: userName
    };

    this.data.polls.unshift(newPoll);
    this.logAudit('Created Society Voting Poll', 'Committee Governance', `Published poll: "${newPoll.title}"`);
    this.save();
    return { success: true, poll: newPoll };
  },

  // Vote on a poll; blocks double voting via poll.voters[]
  votePoll(pollId, optionId) {
    if (!this.data || !this.data.polls) return { success: false };
    const poll = this.data.polls.find(p => p.id === pollId);
    if (!poll) return { success: false, message: 'Poll not found' };
    if (!Array.isArray(poll.voters)) poll.voters = [];

    const user = this.getCurrentUser();
    const voterKey = user ? (user.id || user.email) : null;
    if (voterKey && poll.voters.includes(voterKey)) {
      return { success: false, message: 'You have already voted in this poll.' };
    }

    const opt = poll.options.find(o => o.id === optionId);
    if (opt) {
      opt.votes += 1;
      poll.totalVotes += 1;
      if (voterKey) poll.voters.push(voterKey);
      this.logAudit('Voted in Society Poll', 'Committee Governance', `Voted on "${poll.title}" for "${opt.text}"`);
      this.save();
      return { success: true, poll: poll };
    }
    return { success: false, message: 'Invalid option' };
  },

  // ──────────────────────────────────────────────
  // Vehicle Registration
  // ──────────────────────────────────────────────
  getVehicles(userId) {
    const all = (this.data && this.data.vehicles) ? this.data.vehicles : [];
    if (userId) return all.filter(v => v.userId === userId);
    return all;
  },

  addVehicle(vehicleData) {
    if (!this.data.vehicles) this.data.vehicles = [];
    const user = this.getCurrentUser();
    const newVehicle = {
      id: 'VEH-' + Math.floor(100 + Math.random() * 900),
      userId: user ? user.id : vehicleData.userId,
      ownerName: user ? user.name : vehicleData.ownerName,
      flat: user ? user.flat : vehicleData.flat,
      plateNo: vehicleData.plateNo,
      type: vehicleData.type || 'Car',
      brand: vehicleData.brand || '',
      colour: vehicleData.colour || '',
      registeredAt: new Date().toISOString().split('T')[0]
    };
    this.data.vehicles.unshift(newVehicle);
    this.save();
    return { success: true, vehicle: newVehicle };
  },

  deleteVehicle(id) {
    if (!this.data.vehicles) return { success: false };
    this.data.vehicles = this.data.vehicles.filter(v => v.id !== id);
    this.save();
    return { success: true };
  },

  // ──────────────────────────────────────────────
  // Pre-Approved Visitors (resident registers in advance)
  // ──────────────────────────────────────────────
  getPreApprovedVisitors() {
    return (this.data && this.data.preApprovedVisitors) ? this.data.preApprovedVisitors : [];
  },

  addPreApprovedVisitor(data) {
    if (!this.data.preApprovedVisitors) this.data.preApprovedVisitors = [];
    const user = this.getCurrentUser();
    const entry = {
      id: 'PAV-' + Math.floor(100 + Math.random() * 900),
      residentId: user ? user.id : '',
      residentName: user ? user.name : data.residentName,
      flat: user ? user.flat : data.flat,
      visitorName: data.visitorName,
      visitorPhone: data.visitorPhone,
      purpose: data.purpose,
      expectedDate: data.expectedDate,
      expectedTimeFrom: data.expectedTimeFrom,
      expectedTimeTo: data.expectedTimeTo,
      status: 'Pending',
      createdAt: new Date().toISOString().split('T')[0]
    };
    this.data.preApprovedVisitors.unshift(entry);
    this.save();
    return { success: true, entry };
  },

  deletePreApprovedVisitor(id) {
    if (!this.data.preApprovedVisitors) return;
    this.data.preApprovedVisitors = this.data.preApprovedVisitors.filter(v => v.id !== id);
    this.save();
    return { success: true };
  },

  // ──────────────────────────────────────────────
  // Expenses (Finance module)
  // ──────────────────────────────────────────────
  getExpenses() {
    return this.getCollection('expenses');
  },

  addExpense(expense) {
    const user = this.getCurrentUser();
    const record = {
      title: expense.title || (expense.category || 'Other') + ' Expense',
      category: EXPENSE_CATEGORIES.includes(expense.category) ? expense.category : (expense.category || 'Other'),
      vendor: expense.vendor || '',
      amount: Number(expense.amount) || 0,
      date: expense.date || new Date().toISOString().split('T')[0],
      paymentMethod: expense.paymentMethod || 'Cash',
      status: expense.status || 'Paid',
      notes: expense.notes || '',
      addedBy: user ? user.name : 'Admin'
    };
    const res = this.addDoc('expenses', record, 'EXP');
    this.logAudit('Expense Recorded', 'Finance', `${record.category} ₹${record.amount} to ${record.vendor || 'vendor'}`);
    return res;
  },

  deleteExpense(id) {
    const res = this.deleteDoc('expenses', id);
    if (res.success) this.logAudit('Expense Deleted', 'Finance', `Removed expense ${id}`);
    return res;
  },

  // ──────────────────────────────────────────────
  // Society Events
  // ──────────────────────────────────────────────
  getEvents() {
    return this.getCollection('events');
  },

  addEvent(event) {
    const user = this.getCurrentUser();
    const record = {
      title: event.title,
      description: event.description || '',
      date: event.date,
      startTime: event.startTime || '',
      endTime: event.endTime || '',
      location: event.location || '',
      category: event.category || 'General',
      status: event.status || 'Upcoming',
      createdBy: user ? user.name : 'Committee'
    };
    const res = this.addDoc('events', record, 'EVT');
    this.logAudit('Event Created', 'Events', `Scheduled "${record.title}" on ${record.date}`);
    this.notify({
      target: 'all', type: 'event',
      title: 'New Society Event: ' + record.title,
      message: `${record.title} on ${record.date} at ${record.location}.`,
      link: 'resident.html'
    });
    return res;
  },

  deleteEvent(id) {
    const res = this.deleteDoc('events', id);
    if (res.success) this.logAudit('Event Deleted', 'Events', `Removed event ${id}`);
    return res;
  },

  // ──────────────────────────────────────────────
  // Society Documents
  // ──────────────────────────────────────────────
  getDocuments() {
    return this.getCollection('documents');
  },

  addDocument(doc) {
    const user = this.getCurrentUser();
    const record = {
      title: doc.title || doc.fileName || 'Untitled Document',
      category: doc.category || 'General',
      fileName: doc.fileName || '',
      fileType: doc.fileType || 'PDF',
      sizeKB: Number(doc.sizeKB) || 0,
      uploadedBy: user ? user.name : 'Admin',
      uploadedAt: new Date().toISOString().split('T')[0],
      access: doc.access || 'All'
    };
    const res = this.addDoc('documents', record, 'DOC');
    this.logAudit('Document Uploaded', 'Documents', `Uploaded "${record.title}" (${record.fileType})`);
    return res;
  },

  deleteDocument(id) {
    const res = this.deleteDoc('documents', id);
    if (res.success) this.logAudit('Document Deleted', 'Documents', `Removed document ${id}`);
    return res;
  },

  // ──────────────────────────────────────────────
  // Notification Center
  // ──────────────────────────────────────────────
  getNotifications() {
    return this.getCollection('notifications');
  },

  // Push a notification. target: 'all' | role | userId.
  notify(payload) {
    const record = {
      target: (payload && payload.target) || 'all',
      type: (payload && payload.type) || 'general',
      title: (payload && payload.title) || '',
      message: (payload && payload.message) || '',
      link: (payload && payload.link) || '',
      read: false
    };
    return this.addDoc('notifications', record, 'NTF');
  },

  // Notifications visible to a user: target 'all', their role, or their id — newest first.
  getNotificationsFor(user) {
    if (!user) return [];
    const role = user.role || '';
    const id = user.id || '';
    return this.getCollection('notifications')
      .filter(n => {
        if (!n) return false;
        if (n.target === 'all') return true;
        if (n.target === role || n.target === id) return true;
        if (role === 'Security Guard' && (n.target === 'Guard' || n.target === 'Security Guard')) return true;
        if (role === 'Committee Member' && (n.target === 'Committee' || n.target === 'Committee Member')) return true;
        if (role === 'Admin' && (n.target === 'Secretary' || n.target === 'Admin')) return true;
        if (role === 'Super Admin' && (n.target === 'Platform Owner' || n.target === 'Super Admin')) return true;
        return false;
      })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  },

  markNotificationRead(id) {
    return this.updateDoc('notifications', id, { read: true });
  },

  markAllNotificationsRead(user) {
    const list = this.getNotificationsFor(user);
    list.forEach(n => { n.read = true; });
    this.save();
    return { success: true, updated: list.length };
  },

  getUnreadCount(user) {
    return this.getNotificationsFor(user).filter(n => !n.read).length;
  },

  // ──────────────────────────────────────────────
  // Emergency Alerts (SOS)
  // ──────────────────────────────────────────────
  getEmergencyAlerts() {
    return this.getCollection('emergencyAlerts');
  },

  raiseEmergency(payload) {
    const user = this.getCurrentUser();
    const record = {
      type: (payload && payload.type) || 'General',
      message: (payload && payload.message) || '',
      status: 'Active',
      raisedBy: user ? user.name : 'Unknown',
      raisedByFlat: user ? (user.flat || '') : '',
      raisedAt: new Date().toISOString(),
      resolvedAt: null
    };
    const res = this.addDoc('emergencyAlerts', record, 'EMG');
    this.logAudit('Emergency Raised', 'Emergency', `${record.type}: ${record.message}`);
    this.notify({
      target: 'all', type: 'emergency',
      title: 'EMERGENCY: ' + record.type,
      message: record.message || 'An emergency has been reported in the society.',
      link: 'guard.html'
    });
    return res;
  },

  resolveEmergency(id) {
    const res = this.updateDoc('emergencyAlerts', id, {
      status: 'Resolved',
      resolvedAt: new Date().toISOString()
    });
    if (res.success) this.logAudit('Emergency Resolved', 'Emergency', `Alert ${id} marked resolved`);
    return res;
  },

  // ──────────────────────────────────────────────
  // Family Members
  // ──────────────────────────────────────────────
  getFamilyMembers(userId) {
    return this.getCollection('familyMembers').filter(f => f.userId === userId);
  },

  addFamilyMember(member) {
    const user = this.getCurrentUser();
    const record = {
      userId: member.userId || (user ? user.id : ''),
      name: member.name,
      relationship: member.relationship || 'Other',
      age: Number(member.age) || 0,
      phone: member.phone || '',
      emergencyContact: !!member.emergencyContact
    };
    const res = this.addDoc('familyMembers', record, 'FAM');
    this.logAudit('Family Member Added', 'Profile', `Added ${record.name} (${record.relationship})`);
    return res;
  },

  deleteFamilyMember(id) {
    const res = this.deleteDoc('familyMembers', id);
    if (res.success) this.logAudit('Family Member Removed', 'Profile', `Removed family member ${id}`);
    return res;
  },

  // ──────────────────────────────────────────────
  // Parking Slots
  // ──────────────────────────────────────────────
  getParkingSlots() {
    return this.getCollection('parkingSlots');
  },

  assignParking(slotId, details) {
    const slot = this.getCollection('parkingSlots').find(s => s.id === slotId);
    if (!slot) return { success: false, message: 'Parking slot not found' };
    if (slot.status === 'Occupied') return { success: false, message: 'Slot ' + slotId + ' is already occupied.' };
    slot.status = 'Occupied';
    slot.vehicleNo = (details && details.vehicleNo) || '';
    slot.ownerName = (details && details.ownerName) || '';
    slot.flat = (details && details.flat) || '';
    this.save();
    this.logAudit('Parking Slot Assigned', 'Parking', `${slotId} → ${slot.ownerName || 'resident'} (${slot.vehicleNo || 'vehicle'})`);
    return { success: true, slot };
  },

  releaseParking(slotId) {
    const slot = this.getCollection('parkingSlots').find(s => s.id === slotId);
    if (!slot) return { success: false, message: 'Parking slot not found' };
    slot.status = 'Available';
    slot.vehicleNo = '';
    slot.ownerName = '';
    slot.flat = '';
    this.save();
    this.logAudit('Parking Slot Released', 'Parking', `${slotId} is now available`);
    return { success: true, slot };
  },

  // ──────────────────────────────────────────────
  // Global Search
  // ──────────────────────────────────────────────
  globalSearch(q) {
    const needle = String(q || '').trim().toLowerCase();
    const result = { residents: [], flats: [], vehicles: [], complaints: [], visitors: [], payments: [], notices: [], amenities: [] };
    if (!needle) return result;
    const match = (...vals) => vals.some(v => v != null && String(v).toLowerCase().includes(needle));
    const cap = arr => arr.slice(0, 8);

    result.residents = cap(this.getUsers().filter(u =>
      (u.role === 'Resident' || u.role === 'Admin') && match(u.name, u.flat, u.email, u.phone, u.id)
    ));
    result.flats = cap(this.getFlats().filter(f =>
      typeof f === 'string' ? match(f) : match(f.flatNo, f.owner, f.tenant, f.tower, f.id)
    ));
    result.vehicles = cap(this.getVehicles().filter(v => match(v.plateNo, v.ownerName, v.flat, v.brand, v.type, v.id)));
    result.complaints = cap(this.getComplaints().filter(c => match(c.title, c.description, c.category, c.flat, c.residentName, c.id)));
    result.visitors = cap(this.getVisitors().filter(v => match(v.name, v.flat, v.purpose, v.phone, v.gatePassCode, v.id)));
    result.payments = cap(this.getMaintenance().filter(m => match(m.residentName, m.flat, m.month, m.id, m.status)));
    result.notices = cap(this.getNotices().filter(n => match(n.title, n.content, n.category, n.postedBy, n.id)));
    result.amenities = cap(this.getAmenities().filter(a => match(a.name, a.type, a.description, a.category, a.id)));
    return result;
  },

  // ──────────────────────────────────────────────
  // Profile Update
  // ──────────────────────────────────────────────
  updateProfile(updates) {
    const user = this.getCurrentUser();
    if (!user) return { success: false, message: 'Not logged in' };
    const dbUser = this.data.users.find(u => u.id === user.id || u.email === user.email);
    if (!dbUser) return { success: false, message: 'User not found' };

    const allowed = ['name', 'email', 'phone', 'bio', 'avatar'];
    allowed.forEach(key => {
      if (updates[key] !== undefined) {
        dbUser[key] = updates[key];
        user[key] = updates[key];
      }
    });

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    this.save();
    return { success: true, user: dbUser };
  },

  logAudit(action, module, details) {
    if (!this.data) return;
    if (!this.data.auditLogs) this.data.auditLogs = [];
    const curUser = this.getCurrentUser();
    const userName = curUser ? curUser.name : 'System';
    const userRole = curUser ? curUser.role : 'System';

    const now = new Date();
    const dateStr = now.toISOString().replace('T', ' ').substring(0, 19);

    const newLog = {
      id: 'LOG-' + Math.floor(1000 + Math.random() * 9000),
      timestamp: dateStr,
      user: userName,
      role: userRole,
      action: action,
      module: module,
      details: details || ''
    };

    this.data.auditLogs.unshift(newLog);
    this.save();
  },

  exportToCSV(filename, rows) {
    if (!rows || !rows.length) return;
    const separator = ',';
    const keys = Object.keys(rows[0]);
    const csvContent =
      keys.join(separator) +
      '\n' +
      rows.map(row => {
        return keys.map(k => {
          let cell = row[k] === null || row[k] === undefined ? '' : row[k].toString();
          cell = cell.replace(/"/g, '""');
          if (cell.search(/("|,|\n)/g) >= 0) {
            cell = `"${cell}"`;
          }
          return cell;
        }).join(separator);
      }).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  },

  // ──────────────────────────────────────────────
  // Default data — mirrors data/seed.json exactly (offline fallback)
  // ──────────────────────────────────────────────
  getDefaultData() {
    return {
  "users": [
    {
      "id": "USR-101",
      "username": "jenilbarad089",
      "password": "$2a$10$kRqRobIgS8Z/kXCg3gxobOm9QETHTIKzkEFe6eZ232HfuqaLxEwXi",
      "name": "Jenil Barad (Admin)",
      "role": "Admin",
      "status": "Approved",
      "flat": "A-101",
      "tower": "Tower A",
      "residentType": "Owner",
      "maintenanceDues": "₹3,500/month",
      "parkingSlot": "P-01",
      "email": "jenilbarad089@gmail.com",
      "phone": "9876543210",
      "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&gender=male",
      "registeredAt": "2026-01-15",
      "approvedAt": "2026-01-15",
      "approvedBy": "USR-101",
      "designation": "Super Administrator",
      "society": "Leonex Grand Residency"
    },
    {
      "id": "USR-102",
      "username": "resident1",
      "password": "$2a$10$dn.36Xt5q0KMyOZAU2ykoeEs9V0Vn7r1uTqePw1MqwHcBknaoihMO",
      "name": "Amit Patel",
      "role": "Resident",
      "status": "Approved",
      "tower": "Tower A",
      "flat": "A-302",
      "flatNo": "A-302",
      "residentType": "Owner",
      "maintenanceDues": "₹3,500/month",
      "parkingSlot": "P-14",
      "email": "amit.patel@gmail.com",
      "phone": "9812345678",
      "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Amit&gender=male",
      "vehicles": [
        "MH 02 EQ 8829 (SUV)",
        "MH 02 CB 1029 (Bike)"
      ],
      "familyMembers": [
        "Rita Patel (Spouse)",
        "Riya Patel (Child)"
      ],
      "familyCount": "3 Members",
      "moveInDate": "2024-01-15",
      "block": "Phase 1",
      "registeredAt": "2026-01-15",
      "approvedAt": "2026-01-15",
      "approvedBy": "USR-101"
    },
    {
      "id": "USR-103",
      "username": "resident2",
      "password": "$2a$10$nZyZF0vaAvkO82.HJWmYauCkpUxnCnpNhI2vKazgd6GMxZctnh3yi",
      "name": "Priya Verma",
      "role": "Resident",
      "status": "Approved",
      "tower": "Tower C",
      "flat": "C-501",
      "flatNo": "C-501",
      "residentType": "Tenant",
      "rentAmount": "₹22,000/month",
      "maintenanceDues": "₹4,000/month",
      "parkingSlot": "P-22",
      "email": "priya.v@gmail.com",
      "phone": "9823456789",
      "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Priya&gender=female",
      "vehicles": [
        "MH 04 AX 4410 (Sedan)"
      ],
      "familyMembers": [
        "Rohan Verma (Spouse)"
      ],
      "familyCount": "2 Members",
      "moveInDate": "2024-03-01",
      "block": "Phase 2",
      "registeredAt": "2026-01-15",
      "approvedAt": "2026-01-15",
      "approvedBy": "USR-101"
    },
    {
      "id": "USR-104",
      "username": "guard",
      "password": "$2a$10$bEKklmed8M2G2Za5w8Z4f.UDv1VUm2QzbdlGIrszaJhVUvAsMi3BC",
      "name": "Bahadur Singh",
      "role": "Security Guard",
      "status": "Approved",
      "empId": "EMP-104",
      "shift": "Morning (06:00 - 14:00)",
      "gateAssigned": "Gate 1",
      "salary": "₹18,000/month",
      "flat": "Gate 1",
      "email": "guard@smartsociety.com",
      "phone": "9988776655",
      "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Bahadur&gender=male",
      "registeredAt": "2026-01-15",
      "approvedAt": "2026-01-15",
      "approvedBy": "USR-101"
    },
    {
      "id": "USR-105",
      "username": "committee",
      "password": "$2a$10$pS6V.WzooWLB0Z2hT/LucO9FqBM4UK5bzaf2wRdKrjvF9RK1u28Oy",
      "name": "Suresh Kumar",
      "role": "Committee Member",
      "status": "Approved",
      "tower": "Tower A",
      "flat": "A-402",
      "designation": "Managing Treasurer",
      "email": "suresh.treasurer@smartsociety.com",
      "phone": "9765432109",
      "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Suresh&gender=male",
      "registeredAt": "2026-01-15",
      "approvedAt": "2026-01-15",
      "approvedBy": "USR-101"
    },
    {
      "id": "USR-106",
      "username": "rahul.sharma",
      "password": "",
      "name": "Rahul Sharma",
      "role": "Resident",
      "status": "Approved",
      "tower": "Tower B",
      "flat": "B-104",
      "flatNo": "B-104",
      "residentType": "Owner",
      "maintenanceDues": "₹3,500/month",
      "parkingSlot": "P-08",
      "email": "rahul.sharma@gmail.com",
      "phone": "9811223344",
      "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Rahul&gender=male",
      "vehicles": [
        "MH 04 BR 7723 (Hatchback)"
      ],
      "familyMembers": [
        "Sneha Sharma (Spouse)",
        "Aarav Sharma (Child)"
      ],
      "familyCount": "3 Members",
      "moveInDate": "2024-02-10",
      "block": "Phase 1",
      "registeredAt": "2026-02-01",
      "approvedAt": "2026-02-01",
      "approvedBy": "USR-101"
    },
    {
      "id": "USR-107",
      "username": "neha.gupta",
      "password": "",
      "name": "Neha Gupta",
      "role": "Resident",
      "status": "Approved",
      "tower": "Tower B",
      "flat": "B-202",
      "flatNo": "B-202",
      "residentType": "Tenant",
      "rentAmount": "₹20,000/month",
      "maintenanceDues": "₹3,500/month",
      "parkingSlot": "P-19",
      "email": "neha.gupta@gmail.com",
      "phone": "9822334455",
      "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Neha&gender=female",
      "vehicles": [
        "MH 01 CX 5588 (Scooter)"
      ],
      "familyMembers": [
        "Anil Gupta (Spouse)"
      ],
      "familyCount": "2 Members",
      "moveInDate": "2024-04-15",
      "block": "Phase 1",
      "registeredAt": "2026-04-10",
      "approvedAt": "2026-04-10",
      "approvedBy": "USR-101"
    },
    {
      "id": "USR-108",
      "username": "vikram.yadav",
      "password": "",
      "name": "Vikram Yadav",
      "role": "Security Guard",
      "status": "Approved",
      "empId": "EMP-108",
      "shift": "Evening (14:00 - 22:00)",
      "gateAssigned": "Gate 2",
      "salary": "₹18,000/month",
      "flat": "Gate 2",
      "email": "vikram.yadav@gmail.com",
      "phone": "9833445566",
      "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Vikram&gender=male",
      "registeredAt": "2026-05-01",
      "approvedAt": "2026-05-01",
      "approvedBy": "USR-101"
    },
    {
      "id": "USR-109",
      "username": "ananya.d",
      "password": "",
      "name": "Ananya Deshmukh",
      "role": "Resident",
      "status": "Approved",
      "tower": "Tower A",
      "flat": "A-604",
      "flatNo": "A-604",
      "residentType": "Owner",
      "maintenanceDues": "₹4,200/month",
      "parkingSlot": "P-33",
      "email": "ananya.d@gmail.com",
      "phone": "9844556677",
      "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Ananya&gender=female",
      "vehicles": [
        "MH 02 KX 1199 (SUV)",
        "MH 02 LP 3344 (Bike)"
      ],
      "familyMembers": [
        "Raj Deshmukh (Spouse)",
        "Isha Deshmukh (Child)",
        "Maya Deshmukh (Child)"
      ],
      "familyCount": "4 Members",
      "moveInDate": "2024-05-01",
      "block": "Phase 2",
      "registeredAt": "2026-05-15",
      "approvedAt": "2026-05-15",
      "approvedBy": "USR-101"
    },
    {
      "id": "USR-110",
      "username": "rohan.m",
      "password": "",
      "name": "Rohan Mehta",
      "role": "Committee Member",
      "status": "Approved",
      "tower": "Tower B",
      "flat": "B-301",
      "designation": "Society General Secretary",
      "email": "rohan.secretary@smartsociety.com",
      "phone": "9855667788",
      "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Rohan&gender=male",
      "registeredAt": "2026-01-15",
      "approvedAt": "2026-01-15",
      "approvedBy": "USR-101"
    },
    {
      "id": "USR-201",
      "username": "kiran.new",
      "password": "",
      "name": "Kiran Shah",
      "role": "Resident",
      "status": "Pending",
      "tower": "",
      "flat": "",
      "email": "kiran.shah@gmail.com",
      "phone": "9900112233",
      "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Kiran&gender=female",
      "registeredAt": "2026-08-20",
      "approvedAt": null,
      "approvedBy": null
    },
    {
      "id": "USR-202",
      "username": "dev.new",
      "password": "",
      "name": "Dev Malhotra",
      "role": "Resident",
      "status": "Pending",
      "tower": "",
      "flat": "",
      "email": "dev.malhotra@gmail.com",
      "phone": "9911223344",
      "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Dev&gender=male",
      "registeredAt": "2026-08-21",
      "approvedAt": null,
      "approvedBy": null
    }
  ],
  "complaints": [
    {
      "id": "CMP-101",
      "residentId": "USR-102",
      "residentName": "Amit Patel",
      "flat": "A-302",
      "category": "Plumbing",
      "title": "Severe water leakage in master bathroom",
      "description": "Pipe joint broken under washbasin, water overflowing into hallway.",
      "status": "Pending",
      "priority": "High",
      "date": "2026-07-22",
      "assignedTo": "",
      "notes": "Admin notified plumbing maintenance team. On-site visit scheduled.",
      "timeline": [
        {
          "at": "2026-07-22 09:40",
          "by": "Amit Patel",
          "action": "Submitted",
          "note": "Complaint submitted by resident."
        },
        {
          "at": "2026-07-22 11:05",
          "by": "Jenil Barad (Admin)",
          "action": "Note",
          "note": "Plumbing maintenance team notified. On-site visit scheduled."
        }
      ]
    },
    {
      "id": "CMP-102",
      "residentId": "USR-103",
      "residentName": "Priya Verma",
      "flat": "C-501",
      "category": "Electrical",
      "title": "Corridor lights flickering on 5th floor",
      "description": "Two LED tubelights are malfunctioning near elevator lobby C.",
      "status": "In Progress",
      "priority": "Medium",
      "date": "2026-07-20",
      "assignedTo": "Mahesh Electrician",
      "notes": "Electrician assigned; LED spares ordered from vendor.",
      "timeline": [
        {
          "at": "2026-07-20 08:55",
          "by": "Priya Verma",
          "action": "Submitted",
          "note": "Complaint submitted by resident."
        },
        {
          "at": "2026-07-20 16:20",
          "by": "Jenil Barad (Admin)",
          "action": "Assigned",
          "note": "Assigned to Mahesh Electrician."
        },
        {
          "at": "2026-07-21 10:30",
          "by": "Mahesh Electrician",
          "action": "In Progress",
          "note": "LED spares ordered from vendor; replacement tomorrow."
        }
      ]
    },
    {
      "id": "CMP-103",
      "residentId": "USR-106",
      "residentName": "Rahul Sharma",
      "flat": "B-104",
      "category": "Security",
      "title": "Automatic boom barrier remote slow response",
      "description": "Gate sensor delay observed during peak evening rush hours.",
      "status": "Resolved",
      "priority": "Low",
      "date": "2026-07-15",
      "assignedTo": "Gate Automation Vendor",
      "notes": "Sensor recalibrated and battery replaced by maintenance team.",
      "timeline": [
        {
          "at": "2026-07-15 17:45",
          "by": "Rahul Sharma",
          "action": "Submitted",
          "note": "Complaint submitted by resident."
        },
        {
          "at": "2026-07-16 09:10",
          "by": "Jenil Barad (Admin)",
          "action": "Assigned",
          "note": "Assigned to Gate Automation Vendor."
        },
        {
          "at": "2026-07-17 13:25",
          "by": "Bahadur Singh",
          "action": "Resolved",
          "note": "Sensor recalibrated and battery replaced by maintenance team."
        }
      ]
    },
    {
      "id": "CMP-104",
      "residentId": "USR-107",
      "residentName": "Neha Gupta",
      "flat": "B-202",
      "category": "Cleanliness",
      "title": "Garbage not picked up from B-Wing corridor",
      "description": "Dry waste bags lying outside B-Wing entry since 3 days.",
      "status": "Pending",
      "priority": "Medium",
      "date": "2026-07-23",
      "assignedTo": "",
      "notes": "Housekeeping team notified. Pickup scheduled tomorrow.",
      "timeline": [
        {
          "at": "2026-07-23 08:15",
          "by": "Neha Gupta",
          "action": "Submitted",
          "note": "Complaint submitted by resident."
        },
        {
          "at": "2026-07-23 12:40",
          "by": "Jenil Barad (Admin)",
          "action": "Note",
          "note": "Housekeeping team notified. Pickup scheduled tomorrow."
        }
      ]
    },
    {
      "id": "CMP-105",
      "residentId": "USR-109",
      "residentName": "Ananya Deshmukh",
      "flat": "A-604",
      "category": "Elevator",
      "title": "Tower A lift unusually noisy on ascent",
      "description": "Grinding noise audible above 4th floor, particularly during morning rush.",
      "status": "In Progress",
      "priority": "High",
      "date": "2026-07-21",
      "assignedTo": "Elevator AMC Team",
      "notes": "Elevator AMC team contacted for urgent inspection.",
      "timeline": [
        {
          "at": "2026-07-21 07:50",
          "by": "Ananya Deshmukh",
          "action": "Submitted",
          "note": "Complaint submitted by resident."
        },
        {
          "at": "2026-07-21 11:30",
          "by": "Jenil Barad (Admin)",
          "action": "Assigned",
          "note": "Assigned to Elevator AMC Team for urgent inspection."
        },
        {
          "at": "2026-07-22 15:00",
          "by": "Elevator AMC Team",
          "action": "In Progress",
          "note": "Inspection in progress; guide rail lubrication done, parts may be required."
        }
      ]
    }
  ],
  "maintenance": [
    {
      "id": "INV-2026-07-101",
      "residentName": "Amit Patel",
      "flat": "A-302",
      "month": "July 2026",
      "amount": 3500,
      "status": "Unpaid",
      "dueDate": "2026-07-31",
      "txnId": null,
      "paymentDate": null,
      "receiptNo": null
    },
    {
      "id": "INV-2026-07-102",
      "residentName": "Priya Verma",
      "flat": "C-501",
      "month": "July 2026",
      "amount": 4000,
      "status": "Paid",
      "dueDate": "2026-07-31",
      "txnId": "TXN987654321",
      "paymentDate": "2026-07-18",
      "receiptNo": "REC-2026-789"
    },
    {
      "id": "INV-2026-07-103",
      "residentName": "Rahul Sharma",
      "flat": "B-104",
      "month": "July 2026",
      "amount": 3500,
      "status": "Unpaid",
      "dueDate": "2026-07-31",
      "txnId": null,
      "paymentDate": null,
      "receiptNo": null
    },
    {
      "id": "INV-2026-07-104",
      "residentName": "Neha Gupta",
      "flat": "B-202",
      "month": "July 2026",
      "amount": 3500,
      "status": "Paid",
      "dueDate": "2026-07-31",
      "txnId": "TXN112233445",
      "paymentDate": "2026-07-10",
      "receiptNo": "REC-2026-812"
    },
    {
      "id": "INV-2026-07-105",
      "residentName": "Ananya Deshmukh",
      "flat": "A-604",
      "month": "July 2026",
      "amount": 4200,
      "status": "Unpaid",
      "dueDate": "2026-07-31",
      "txnId": null,
      "paymentDate": null,
      "receiptNo": null
    },
    {
      "id": "INV-2026-06-101",
      "residentName": "Amit Patel",
      "flat": "A-302",
      "month": "June 2026",
      "amount": 3500,
      "status": "Paid",
      "dueDate": "2026-06-30",
      "txnId": "TXN123456789",
      "paymentDate": "2026-06-10",
      "receiptNo": "REC-2026-456"
    },
    {
      "id": "INV-2026-06-102",
      "residentName": "Priya Verma",
      "flat": "C-501",
      "month": "June 2026",
      "amount": 4000,
      "status": "Paid",
      "dueDate": "2026-06-30",
      "txnId": "TXN223456789",
      "paymentDate": "2026-06-08",
      "receiptNo": "REC-2026-457"
    },
    {
      "id": "INV-2026-06-103",
      "residentName": "Rahul Sharma",
      "flat": "B-104",
      "month": "June 2026",
      "amount": 3500,
      "status": "Paid",
      "dueDate": "2026-06-30",
      "txnId": "TXN323456789",
      "paymentDate": "2026-06-12",
      "receiptNo": "REC-2026-458"
    }
  ],
  "visitors": [
    {
      "id": "VIS-101",
      "name": "Ramesh Kumar",
      "phone": "9123456780",
      "flat": "A-302",
      "residentName": "Amit Patel",
      "purpose": "Amazon Parcel Delivery",
      "type": "Delivery",
      "vehicleNo": "MH-12-AB-3456",
      "entryTime": "2026-07-27 10:10",
      "exitTime": "2026-07-27 10:25",
      "status": "Checked Out",
      "durationMins": 15,
      "gatePassCode": "GP-9821",
      "timeline": [
        {
          "at": "2026-07-27 10:05",
          "by": "Bahadur Singh",
          "action": "Created",
          "note": "Delivery entry logged at Gate 1."
        },
        {
          "at": "2026-07-27 10:10",
          "by": "Bahadur Singh",
          "action": "Checked In",
          "note": "Gate pass GP-9821 issued."
        },
        {
          "at": "2026-07-27 10:25",
          "by": "Bahadur Singh",
          "action": "Checked Out",
          "note": "Parcel delivered to A-302."
        }
      ]
    },
    {
      "id": "VIS-102",
      "name": "Sunita Devi",
      "phone": "9871234560",
      "flat": "C-501",
      "residentName": "Priya Verma",
      "purpose": "Family Visit",
      "type": "Guest",
      "vehicleNo": "MH-14-XY-9900",
      "entryTime": "2026-07-27 11:35",
      "exitTime": "Still In Society",
      "status": "Checked In",
      "durationMins": null,
      "gatePassCode": "GP-5512",
      "timeline": [
        {
          "at": "2026-07-27 11:20",
          "by": "Priya Verma",
          "action": "Created",
          "note": "Family visit expected around noon."
        },
        {
          "at": "2026-07-27 11:30",
          "by": "Priya Verma",
          "action": "Approved",
          "note": "Approved via resident portal."
        },
        {
          "at": "2026-07-27 11:35",
          "by": "Bahadur Singh",
          "action": "Checked In",
          "note": "Vehicle MH-14-XY-9900 parked at visitor bay."
        }
      ]
    },
    {
      "id": "VIS-103",
      "name": "Arjun Plumber (Mistry)",
      "phone": "9000112233",
      "flat": "A-302",
      "residentName": "Amit Patel",
      "purpose": "Plumbing Repair",
      "type": "Service Provider",
      "vehicleNo": "N/A",
      "entryTime": "2026-07-27 09:30",
      "exitTime": "2026-07-27 11:45",
      "status": "Checked Out",
      "durationMins": 135,
      "gatePassCode": "GP-3344",
      "timeline": [
        {
          "at": "2026-07-27 09:20",
          "by": "Amit Patel",
          "action": "Created",
          "note": "Plumber requested for bathroom leakage (CMP-101)."
        },
        {
          "at": "2026-07-27 09:25",
          "by": "Amit Patel",
          "action": "Approved",
          "note": "Approved via resident portal."
        },
        {
          "at": "2026-07-27 09:30",
          "by": "Bahadur Singh",
          "action": "Checked In",
          "note": "Gate pass GP-3344 issued."
        },
        {
          "at": "2026-07-27 11:45",
          "by": "Bahadur Singh",
          "action": "Checked Out",
          "note": "Repair work completed at A-302."
        }
      ]
    },
    {
      "id": "VIS-104",
      "name": "Delivery Boy - Swiggy",
      "phone": "9977886655",
      "flat": "B-202",
      "residentName": "Neha Gupta",
      "purpose": "Food Delivery",
      "type": "Delivery",
      "vehicleNo": "MH-04-SW-0012",
      "entryTime": "2026-07-27 13:05",
      "exitTime": "2026-07-27 13:15",
      "status": "Checked Out",
      "durationMins": 10,
      "gatePassCode": "GP-7788",
      "timeline": [
        {
          "at": "2026-07-27 13:05",
          "by": "Bahadur Singh",
          "action": "Checked In",
          "note": "Food delivery for B-202, gate pass GP-7788."
        },
        {
          "at": "2026-07-27 13:15",
          "by": "Bahadur Singh",
          "action": "Checked Out",
          "note": "Order delivered to B-202."
        }
      ]
    },
    {
      "id": "VIS-105",
      "name": "Mahesh Electrician",
      "phone": "9811567890",
      "flat": "A-604",
      "residentName": "Ananya Deshmukh",
      "purpose": "Electrical Repair Work",
      "type": "Service Provider",
      "vehicleNo": "N/A",
      "entryTime": "2026-07-27 14:00",
      "exitTime": "Still In Society",
      "status": "Pending",
      "durationMins": null,
      "gatePassCode": "GP-4422",
      "timeline": [
        {
          "at": "2026-07-27 13:55",
          "by": "Ananya Deshmukh",
          "action": "Created",
          "note": "Electrician requested for A-604 inverter fault."
        },
        {
          "at": "2026-07-27 14:00",
          "by": "Vikram Yadav",
          "action": "Note",
          "note": "Awaiting resident approval at Gate 2."
        }
      ]
    }
  ],
  "notices": [
    {
      "id": "NOT-101",
      "title": "Annual General Body Meeting (AGM) Notice — July 28th",
      "category": "Meeting",
      "postedBy": "Rohan Mehta (Secretary)",
      "date": "2026-07-20",
      "content": "The AGM for all society flat owners is scheduled for Sunday, July 28th at 10:00 AM in the Main Community Hall. Key agenda: Annual Financial Audit, Security Upgrade Proposal & Rooftop Solar Installation vote."
    },
    {
      "id": "NOT-102",
      "title": "Overhead Tank Cleaning — Water Disruption 09:00–13:00",
      "category": "Emergency",
      "postedBy": "Jenil Barad (Admin)",
      "date": "2026-07-21",
      "content": "Overhead water tank sanitization conducted tomorrow between 09:00 AM and 01:00 PM. Water supply will be temporarily paused on all floors. Please store adequate water in advance."
    },
    {
      "id": "NOT-103",
      "title": "Society Foundation Day Celebration — August 1st",
      "category": "General",
      "postedBy": "Suresh Kumar (Treasurer)",
      "date": "2026-07-22",
      "content": "Leonex Grand Residency completes 5 years! Celebrations planned on August 1st: Cultural Program, Lucky Draw, Kids Competitions, and Grand Dinner. All residents are cordially invited."
    },
    {
      "id": "NOT-104",
      "title": "Parking Lot Rules Update — Visitor Parking Enforcement",
      "category": "Rules",
      "postedBy": "Rohan Mehta (Secretary)",
      "date": "2026-07-23",
      "content": "Visitor parking is now strictly limited to 2 hours. Resident-designated slots P-01 through P-40 must remain clear at all times. Violating vehicles will be towed at owner's expense."
    }
  ],
  "amenities": [
    {
      "id": "AMN-101",
      "name": "Grand Community Hall",
      "capacity": 200,
      "rate": 2000,
      "icon": "fa-building",
      "description": "Air-conditioned hall with Dolby sound system and stage for events, meetings, and celebrations."
    },
    {
      "id": "AMN-102",
      "name": "Clubhouse Gym & Lounge",
      "capacity": 50,
      "rate": 500,
      "icon": "fa-dumbbell",
      "description": "Modern fitness equipment, table tennis, and indoor lounge. Open 5 AM–11 PM daily."
    },
    {
      "id": "AMN-103",
      "name": "Party Lawn & Garden",
      "capacity": 300,
      "rate": 3500,
      "icon": "fa-tree",
      "description": "Lush green open lawn with decorative lighting setup for outdoor gatherings and events."
    },
    {
      "id": "AMN-104",
      "name": "Rooftop Pool & Spa",
      "capacity": 40,
      "rate": 1200,
      "icon": "fa-water-ladder",
      "description": "Temperature-controlled rooftop swimming pool with steam room and jacuzzi."
    },
    {
      "id": "AMN-105",
      "name": "Indoor Badminton Court",
      "capacity": 20,
      "rate": 300,
      "icon": "fa-table-tennis-paddle-ball",
      "description": "Wooden-floored covered badminton court with rackets and shuttle service."
    }
  ],
  "bookings": [
    {
      "id": "BK-501",
      "amenityId": "AMN-101",
      "amenityName": "Grand Community Hall",
      "residentName": "Priya Verma",
      "flat": "C-501",
      "date": "2026-07-28",
      "timeSlot": "Morning (09:00 AM - 02:00 PM)",
      "purpose": "Birthday Celebration",
      "amount": 2000,
      "status": "Confirmed"
    },
    {
      "id": "BK-502",
      "amenityId": "AMN-103",
      "amenityName": "Party Lawn & Garden",
      "residentName": "Ananya Deshmukh",
      "flat": "A-604",
      "date": "2026-08-01",
      "timeSlot": "Evening (04:00 PM - 10:00 PM)",
      "purpose": "Foundation Day Celebration",
      "amount": 3500,
      "status": "Confirmed"
    },
    {
      "id": "BK-503",
      "amenityId": "AMN-102",
      "amenityName": "Clubhouse Gym & Lounge",
      "residentName": "Rahul Sharma",
      "flat": "B-104",
      "date": "2026-07-27",
      "timeSlot": "Morning (06:00 AM - 08:00 AM)",
      "purpose": "Personal Workout Session",
      "amount": 500,
      "status": "Confirmed"
    }
  ],
  "towers": [
    {
      "id": "TOW-A",
      "name": "Tower A - Emerald Block",
      "floors": 12,
      "flatsPerFloor": 4,
      "totalFlats": 48
    },
    {
      "id": "TOW-B",
      "name": "Tower B - Sapphire Block",
      "floors": 10,
      "flatsPerFloor": 4,
      "totalFlats": 40
    },
    {
      "id": "TOW-C",
      "name": "Tower C - Diamond Block",
      "floors": 14,
      "flatsPerFloor": 4,
      "totalFlats": 56
    }
  ],
  "flats": [
    {
      "id": "FLT-A101",
      "tower": "Tower A",
      "floor": "1st Floor",
      "flatNo": "A-101",
      "owner": "Jenil Barad",
      "residentType": "Owner",
      "occupancy": "Owner Occupied",
      "dues": 3500,
      "parking": "P-01",
      "electricMeter": "EM-9012",
      "waterMeter": "WM-441"
    },
    {
      "id": "FLT-A302",
      "tower": "Tower A",
      "floor": "3rd Floor",
      "flatNo": "A-302",
      "owner": "Amit Patel",
      "residentType": "Owner",
      "occupancy": "Owner Occupied",
      "dues": 3500,
      "parking": "P-14",
      "electricMeter": "EM-9034",
      "waterMeter": "WM-442"
    },
    {
      "id": "FLT-B104",
      "tower": "Tower B",
      "floor": "1st Floor",
      "flatNo": "B-104",
      "owner": "Rahul Sharma",
      "residentType": "Owner",
      "occupancy": "Owner Occupied",
      "dues": 3500,
      "parking": "P-08",
      "electricMeter": "EM-9055",
      "waterMeter": "WM-443"
    },
    {
      "id": "FLT-B202",
      "tower": "Tower B",
      "floor": "2nd Floor",
      "flatNo": "B-202",
      "owner": "Ramesh Gupta",
      "residentType": "Tenant",
      "tenant": "Neha Gupta",
      "rent": 20000,
      "occupancy": "Rented",
      "dues": 3500,
      "parking": "P-19",
      "electricMeter": "EM-9078",
      "waterMeter": "WM-444"
    },
    {
      "id": "FLT-C501",
      "tower": "Tower C",
      "floor": "5th Floor",
      "flatNo": "C-501",
      "owner": "Sunil Verma",
      "residentType": "Tenant",
      "tenant": "Priya Verma",
      "rent": 22000,
      "occupancy": "Rented",
      "dues": 4000,
      "parking": "P-22",
      "electricMeter": "EM-9099",
      "waterMeter": "WM-445"
    },
    {
      "id": "FLT-A604",
      "tower": "Tower A",
      "floor": "6th Floor",
      "flatNo": "A-604",
      "owner": "Ananya Deshmukh",
      "residentType": "Owner",
      "occupancy": "Owner Occupied",
      "dues": 4200,
      "parking": "P-33",
      "electricMeter": "EM-9112",
      "waterMeter": "WM-446"
    }
  ],
  "auditLogs": [
    {
      "id": "LOG-1001",
      "timestamp": "2026-07-27 08:00:00",
      "user": "System",
      "role": "System",
      "action": "System Initialized",
      "module": "Core Engine",
      "details": "Leonex v3.0 Enterprise Engine started cleanly."
    },
    {
      "id": "LOG-1002",
      "timestamp": "2026-07-27 09:15:00",
      "user": "Jenil Barad (Admin)",
      "role": "Admin",
      "action": "User Login",
      "module": "Auth",
      "details": "Admin logged in from 192.168.1.1. Session started."
    },
    {
      "id": "LOG-1003",
      "timestamp": "2026-07-27 09:20:00",
      "user": "Bahadur Singh",
      "role": "Security Guard",
      "action": "Gate Pass Generated",
      "module": "Security",
      "details": "Issued GP-9821 for Ramesh Kumar (Courier → Flat A-302)."
    },
    {
      "id": "LOG-1004",
      "timestamp": "2026-07-27 10:18:00",
      "user": "Priya Verma",
      "role": "Resident",
      "action": "Maintenance Bill Payment",
      "module": "Billing",
      "details": "Paid INV-2026-07-102 ₹4,000 via UPI (TXN987654321)."
    },
    {
      "id": "LOG-1005",
      "timestamp": "2026-07-27 11:30:00",
      "user": "Amit Patel",
      "role": "Resident",
      "action": "Complaint Submitted",
      "module": "Complaints",
      "details": "Complaint CMP-101 filed: Severe water leakage in Flat A-302 bathroom."
    },
    {
      "id": "LOG-1006",
      "timestamp": "2026-07-27 12:00:00",
      "user": "Jenil Barad (Admin)",
      "role": "Admin",
      "action": "Notice Published",
      "module": "Notices",
      "details": "Published Notice NOT-102: Overhead Tank Cleaning disruption alert."
    }
  ],
  "societySettings": {
    "name": "Leonex Grand Residency",
    "code": "SOC-MH-4001",
    "city": "Mumbai",
    "pincode": "400053",
    "maintenanceRateSqFt": 3.5,
    "lateFeePercentage": 5,
    "graceDays": 10,
    "pwaEnabled": true,
    "enableCommitteePortal": true
  },
  "polls": [
    {
      "id": "POL-101",
      "title": "Installation of 50kW Rooftop Solar Power System",
      "category": "Infrastructure & Energy",
      "description": "Proposal to allocate ₹4.5 Lakhs from society reserve funds for green solar power installation across Tower A & B.",
      "options": [
        {
          "id": "opt1",
          "text": "Approve Solar Allocation",
          "votes": 42
        },
        {
          "id": "opt2",
          "text": "Reject Proposal",
          "votes": 8
        },
        {
          "id": "opt3",
          "text": "Request Detailed Vendor Quotes",
          "votes": 5
        }
      ],
      "voters": [],
      "totalVotes": 55,
      "status": "Active",
      "createdDate": "2026-07-15",
      "endDate": "2026-07-31",
      "createdBy": "Suresh Kumar (Treasurer)"
    },
    {
      "id": "POL-102",
      "title": "Basement B1 EV Fast Charging Stations",
      "category": "Amenities & Upgrades",
      "description": "Setup 6 dedicated dual-port EV chargers for electric cars and 2-wheelers.",
      "options": [
        {
          "id": "opt1",
          "text": "Yes, Install EV Chargers",
          "votes": 38
        },
        {
          "id": "opt2",
          "text": "No, Not Required",
          "votes": 12
        }
      ],
      "voters": [],
      "totalVotes": 50,
      "status": "Active",
      "createdDate": "2026-07-18",
      "endDate": "2026-08-05",
      "createdBy": "Rohan Mehta (Secretary)"
    }
  ],
  "vehicles": [
    {
      "id": "VEH-101",
      "userId": "USR-102",
      "ownerName": "Amit Patel",
      "flat": "A-302",
      "plateNo": "MH 02 EQ 8829",
      "type": "SUV",
      "brand": "Toyota Fortuner",
      "colour": "White",
      "registeredAt": "2026-01-15"
    },
    {
      "id": "VEH-102",
      "userId": "USR-102",
      "ownerName": "Amit Patel",
      "flat": "A-302",
      "plateNo": "MH 02 CB 1029",
      "type": "Bike",
      "brand": "Royal Enfield Classic 350",
      "colour": "Black",
      "registeredAt": "2026-01-15"
    },
    {
      "id": "VEH-103",
      "userId": "USR-103",
      "ownerName": "Priya Verma",
      "flat": "C-501",
      "plateNo": "MH 04 AX 4410",
      "type": "Sedan",
      "brand": "Honda City",
      "colour": "Silver",
      "registeredAt": "2026-03-01"
    },
    {
      "id": "VEH-104",
      "userId": "USR-106",
      "ownerName": "Rahul Sharma",
      "flat": "B-104",
      "plateNo": "MH 04 BR 7723",
      "type": "Hatchback",
      "brand": "Maruti Swift",
      "colour": "Red",
      "registeredAt": "2026-02-10"
    },
    {
      "id": "VEH-105",
      "userId": "USR-107",
      "ownerName": "Neha Gupta",
      "flat": "B-202",
      "plateNo": "MH 01 CX 5588",
      "type": "Scooter",
      "brand": "Honda Activa 6G",
      "colour": "Grey",
      "registeredAt": "2026-04-10"
    },
    {
      "id": "VEH-106",
      "userId": "USR-109",
      "ownerName": "Ananya Deshmukh",
      "flat": "A-604",
      "plateNo": "MH 02 KX 1199",
      "type": "SUV",
      "brand": "Hyundai Creta",
      "colour": "Blue",
      "registeredAt": "2026-05-15"
    },
    {
      "id": "VEH-107",
      "userId": "USR-109",
      "ownerName": "Ananya Deshmukh",
      "flat": "A-604",
      "plateNo": "MH 02 LP 3344",
      "type": "Bike",
      "brand": "Bajaj Pulsar 150",
      "colour": "Black",
      "registeredAt": "2026-05-15"
    }
  ],
  "preApprovedVisitors": [
    {
      "id": "PAV-101",
      "residentId": "USR-102",
      "residentName": "Amit Patel",
      "flat": "A-302",
      "visitorName": "Ravi Patel",
      "visitorPhone": "9876500001",
      "purpose": "Family Visit",
      "expectedDate": "2026-08-22",
      "expectedTimeFrom": "11:00",
      "expectedTimeTo": "14:00",
      "status": "Pending",
      "createdAt": "2026-08-21"
    }
  ],
  "expenses": [
    {
      "id": "EXP-101",
      "title": "Common Area Electricity Bill — June 2026",
      "category": "Electricity",
      "vendor": "MSEB",
      "amount": 42500,
      "date": "2026-06-05",
      "paymentMethod": "Bank Transfer",
      "status": "Paid",
      "notes": "Includes lift, lobby lighting and pump house consumption.",
      "addedBy": "Suresh Kumar (Treasurer)",
      "createdAt": "2026-06-05T11:20:00.000Z"
    },
    {
      "id": "EXP-102",
      "title": "Security Guard Services — June 2026",
      "category": "Security",
      "vendor": "SecureLife Guards Agency",
      "amount": 36000,
      "date": "2026-06-01",
      "paymentMethod": "Bank Transfer",
      "status": "Paid",
      "notes": "6 guards across Gate 1, Gate 2 and night patrol.",
      "addedBy": "Suresh Kumar (Treasurer)",
      "createdAt": "2026-06-01T10:00:00.000Z"
    },
    {
      "id": "EXP-103",
      "title": "Housekeeping & Sanitization Contract — June",
      "category": "Cleaning",
      "vendor": "ShineWell Facility Services",
      "amount": 18500,
      "date": "2026-06-03",
      "paymentMethod": "Cheque",
      "status": "Paid",
      "notes": "Daily corridor cleaning and monthly deep sanitization.",
      "addedBy": "Jenil Barad (Admin)",
      "createdAt": "2026-06-03T12:40:00.000Z"
    },
    {
      "id": "EXP-104",
      "title": "Lift AMC Quarterly Service (Tower A & B)",
      "category": "Lift Maintenance",
      "vendor": "Otis Elevator Services",
      "amount": 28000,
      "date": "2026-06-12",
      "paymentMethod": "Bank Transfer",
      "status": "Paid",
      "notes": "Quarterly servicing of 4 passenger lifts.",
      "addedBy": "Jenil Barad (Admin)",
      "createdAt": "2026-06-12T15:10:00.000Z"
    },
    {
      "id": "EXP-105",
      "title": "Society Staff Salaries — July 2026",
      "category": "Staff Salary",
      "vendor": "Society Payroll",
      "amount": 58000,
      "date": "2026-07-01",
      "paymentMethod": "Bank Transfer",
      "status": "Paid",
      "notes": "Salaries for housekeeping supervisor, plumber and electrician.",
      "addedBy": "Suresh Kumar (Treasurer)",
      "createdAt": "2026-07-01T09:30:00.000Z"
    },
    {
      "id": "EXP-106",
      "title": "Municipal Water Tanker Supply (8 Tankers)",
      "category": "Water",
      "vendor": "Mumbai Water Supply",
      "amount": 12800,
      "date": "2026-07-08",
      "paymentMethod": "UPI",
      "status": "Paid",
      "notes": "Supplementary tankers during low-pressure week.",
      "addedBy": "Jenil Barad (Admin)",
      "createdAt": "2026-07-08T14:25:00.000Z"
    },
    {
      "id": "EXP-107",
      "title": "Garden Maintenance & Seasonal Plants",
      "category": "Gardening",
      "vendor": "GreenScape Gardeners",
      "amount": 9500,
      "date": "2026-07-10",
      "paymentMethod": "Cash",
      "status": "Paid",
      "notes": "Monsoon planting and lawn trimming around clubhouse.",
      "addedBy": "Suresh Kumar (Treasurer)",
      "createdAt": "2026-07-10T11:00:00.000Z"
    },
    {
      "id": "EXP-108",
      "title": "Basement Pump Room Motor Repair",
      "category": "Repairs",
      "vendor": "FixIt Engineering Works",
      "amount": 15200,
      "date": "2026-07-18",
      "paymentMethod": "Cheque",
      "status": "Paid",
      "notes": "Rewinding of water pump motor, Tower B basement.",
      "addedBy": "Jenil Barad (Admin)",
      "createdAt": "2026-07-18T16:45:00.000Z"
    },
    {
      "id": "EXP-109",
      "title": "Common Area Electricity Bill — August 2026",
      "category": "Electricity",
      "vendor": "MSEB",
      "amount": 44800,
      "date": "2026-08-05",
      "paymentMethod": "Bank Transfer",
      "status": "Paid",
      "notes": "Higher load due to monsoon pump usage.",
      "addedBy": "Suresh Kumar (Treasurer)",
      "createdAt": "2026-08-05T11:20:00.000Z"
    },
    {
      "id": "EXP-110",
      "title": "Security Guard Services — August 2026",
      "category": "Security",
      "vendor": "SecureLife Guards Agency",
      "amount": 36000,
      "date": "2026-08-01",
      "paymentMethod": "Bank Transfer",
      "status": "Paid",
      "notes": "Monthly agency invoice for gate and patrol staff.",
      "addedBy": "Suresh Kumar (Treasurer)",
      "createdAt": "2026-08-01T10:00:00.000Z"
    },
    {
      "id": "EXP-111",
      "title": "Monsoon Drainage & Deep Cleaning Drive",
      "category": "Cleaning",
      "vendor": "ShineWell Facility Services",
      "amount": 22000,
      "date": "2026-08-12",
      "paymentMethod": "Cheque",
      "status": "Pending",
      "notes": "Desilting of basement drains; invoice awaiting committee approval.",
      "addedBy": "Jenil Barad (Admin)",
      "createdAt": "2026-08-12T13:15:00.000Z"
    },
    {
      "id": "EXP-112",
      "title": "Foundation Day Celebration Expenses",
      "category": "Other",
      "vendor": "EventCraft Decorators",
      "amount": 31500,
      "date": "2026-08-02",
      "paymentMethod": "UPI",
      "status": "Paid",
      "notes": "Stage decor, sound and refreshments for Aug 1 celebration.",
      "addedBy": "Rohan Mehta (Secretary)",
      "createdAt": "2026-08-02T12:00:00.000Z"
    }
  ],
  "events": [
    {
      "id": "EVT-101",
      "title": "Independence Day Cultural Program",
      "description": "Flag hoisting followed by cultural performances by society kids, patriotic songs and breakfast for all residents.",
      "date": "2026-08-15",
      "startTime": "09:00",
      "endTime": "12:00",
      "location": "Grand Community Hall",
      "category": "Cultural",
      "status": "Completed",
      "createdBy": "Rohan Mehta (Secretary)",
      "createdAt": "2026-08-01T10:00:00.000Z"
    },
    {
      "id": "EVT-102",
      "title": "Society AGM",
      "description": "Annual General Meeting: financial audit review, security upgrade proposal and rooftop solar vote. All members requested to attend.",
      "date": "2026-08-30",
      "startTime": "18:00",
      "endTime": "20:00",
      "location": "Grand Community Hall",
      "category": "Meeting",
      "status": "Upcoming",
      "createdBy": "Suresh Kumar (Treasurer)",
      "createdAt": "2026-08-18T12:30:00.000Z"
    },
    {
      "id": "EVT-103",
      "title": "Weekend Yoga Camp",
      "description": "Certified instructor-led yoga and pranayama sessions for all age groups. Carry your own mat and water bottle.",
      "date": "2026-09-05",
      "startTime": "07:00",
      "endTime": "09:00",
      "location": "Party Lawn & Garden",
      "category": "Health & Wellness",
      "status": "Upcoming",
      "createdBy": "Rohan Mehta (Secretary)",
      "createdAt": "2026-08-22T09:00:00.000Z"
    },
    {
      "id": "EVT-104",
      "title": "Lift Maintenance Drive",
      "description": "Quarterly lift servicing by the AMC team. Lifts will run one at a time per tower; please plan accordingly.",
      "date": "2026-09-08",
      "startTime": "10:00",
      "endTime": "16:00",
      "location": "Tower A & B Lift Lobbies",
      "category": "Maintenance",
      "status": "Upcoming",
      "createdBy": "Jenil Barad (Admin)",
      "createdAt": "2026-08-24T15:20:00.000Z"
    },
    {
      "id": "EVT-105",
      "title": "Kids Sports Day",
      "description": "Races, relay and badminton for kids aged 5–15 with prizes, medals and refreshments.",
      "date": "2026-09-13",
      "startTime": "16:00",
      "endTime": "19:00",
      "location": "Indoor Badminton Court",
      "category": "Sports",
      "status": "Upcoming",
      "createdBy": "Rohan Mehta (Secretary)",
      "createdAt": "2026-08-25T10:30:00.000Z"
    },
    {
      "id": "EVT-106",
      "title": "Diwali Preparation Meet",
      "description": "Committee meet to plan Diwali decoration, rangoli contest, lighting budget and community dinner.",
      "date": "2026-09-20",
      "startTime": "17:00",
      "endTime": "19:00",
      "location": "Clubhouse Gym & Lounge",
      "category": "Festival",
      "status": "Upcoming",
      "createdBy": "Suresh Kumar (Treasurer)",
      "createdAt": "2026-08-25T11:45:00.000Z"
    }
  ],
  "documents": [
    {
      "id": "DOC-101",
      "title": "Society Bye-laws",
      "category": "Legal",
      "fileName": "society-bye-laws-2026.pdf",
      "fileType": "PDF",
      "sizeKB": 842,
      "uploadedBy": "Jenil Barad (Admin)",
      "uploadedAt": "2026-06-10",
      "access": "All"
    },
    {
      "id": "DOC-102",
      "title": "AGM Minutes — July 2026",
      "category": "Meetings",
      "fileName": "agm-minutes-july-2026.pdf",
      "fileType": "PDF",
      "sizeKB": 318,
      "uploadedBy": "Rohan Mehta (Secretary)",
      "uploadedAt": "2026-07-29",
      "access": "All"
    },
    {
      "id": "DOC-103",
      "title": "Maintenance Audit Report Q2 2026",
      "category": "Finance",
      "fileName": "maintenance-audit-q2-2026.xlsx",
      "fileType": "XLSX",
      "sizeKB": 256,
      "uploadedBy": "Suresh Kumar (Treasurer)",
      "uploadedAt": "2026-07-15",
      "access": "Admin+Committee"
    },
    {
      "id": "DOC-104",
      "title": "Fire Safety Certificate 2026",
      "category": "Compliance",
      "fileName": "fire-safety-certificate-2026.pdf",
      "fileType": "PDF",
      "sizeKB": 1024,
      "uploadedBy": "Jenil Barad (Admin)",
      "uploadedAt": "2026-06-22",
      "access": "All"
    },
    {
      "id": "DOC-105",
      "title": "Resident Onboarding Form",
      "category": "Forms",
      "fileName": "resident-onboarding-form.docx",
      "fileType": "DOCX",
      "sizeKB": 88,
      "uploadedBy": "Jenil Barad (Admin)",
      "uploadedAt": "2026-06-01",
      "access": "All"
    },
    {
      "id": "DOC-106",
      "title": "Parking Allocation Policy",
      "category": "Policies",
      "fileName": "parking-allocation-policy.pdf",
      "fileType": "PDF",
      "sizeKB": 412,
      "uploadedBy": "Rohan Mehta (Secretary)",
      "uploadedAt": "2026-07-24",
      "access": "All"
    },
    {
      "id": "DOC-107",
      "title": "Emergency Contact Directory",
      "category": "Security",
      "fileName": "emergency-contact-directory.xlsx",
      "fileType": "XLSX",
      "sizeKB": 134,
      "uploadedBy": "Jenil Barad (Admin)",
      "uploadedAt": "2026-08-05",
      "access": "All"
    }
  ],
  "notifications": [
    {
      "id": "NTF-101",
      "target": "all",
      "type": "notice",
      "title": "Notice: Overhead Tank Cleaning — Water Disruption",
      "message": "Water supply will be paused on Jul 22 between 09:00 and 13:00 for tank sanitization. Please store water in advance.",
      "link": "",
      "read": true,
      "createdAt": "2026-07-21T10:00:00.000Z"
    },
    {
      "id": "NTF-102",
      "target": "all",
      "type": "notice",
      "title": "Notice: Society AGM on August 30",
      "message": "Annual General Meeting at 6:00 PM in the Grand Community Hall. All members are requested to attend.",
      "link": "",
      "read": false,
      "createdAt": "2026-08-18T12:30:00.000Z"
    },
    {
      "id": "NTF-103",
      "target": "all",
      "type": "notice",
      "title": "Notice: Parking Rules Update",
      "message": "Visitor parking is now limited to 2 hours. Resident slots P-01 to P-40 must remain clear at all times.",
      "link": "",
      "read": false,
      "createdAt": "2026-07-23T16:00:00.000Z"
    },
    {
      "id": "NTF-104",
      "target": "Resident",
      "type": "bill",
      "title": "Maintenance Bill Reminder — July 2026",
      "message": "Your July 2026 maintenance bill is pending for some flats. Please pay at the earliest to avoid late fees.",
      "link": "resident.html#bills",
      "read": false,
      "createdAt": "2026-08-05T09:00:00.000Z"
    }
  ],
  "emergencyAlerts": [
    {
      "id": "EMG-101",
      "type": "Fire",
      "message": "Smoke detected near Tower B generator room during evening patrol.",
      "status": "Resolved",
      "raisedBy": "Bahadur Singh",
      "raisedAt": "2026-07-19T21:40:00.000Z",
      "resolvedAt": "2026-07-19T22:15:00.000Z",
      "resolvedBy": "Jenil Barad (Admin)",
      "notes": "Generator overheating caused smoke. Extinguisher used and fire department informed. No injuries."
    }
  ],
  "familyMembers": [
    {
      "id": "FAM-101",
      "userId": "USR-102",
      "name": "Rita Patel",
      "relationship": "Spouse",
      "age": 34,
      "phone": "9812300001",
      "emergencyContact": true
    },
    {
      "id": "FAM-102",
      "userId": "USR-102",
      "name": "Riya Patel",
      "relationship": "Child",
      "age": 8,
      "phone": "",
      "emergencyContact": false
    },
    {
      "id": "FAM-103",
      "userId": "USR-103",
      "name": "Rohan Verma",
      "relationship": "Spouse",
      "age": 38,
      "phone": "9823400002",
      "emergencyContact": true
    },
    {
      "id": "FAM-104",
      "userId": "USR-106",
      "name": "Sneha Sharma",
      "relationship": "Spouse",
      "age": 32,
      "phone": "9811200003",
      "emergencyContact": true
    },
    {
      "id": "FAM-105",
      "userId": "USR-107",
      "name": "Anil Gupta",
      "relationship": "Spouse",
      "age": 35,
      "phone": "9822300004",
      "emergencyContact": true
    },
    {
      "id": "FAM-106",
      "userId": "USR-109",
      "name": "Raj Deshmukh",
      "relationship": "Spouse",
      "age": 40,
      "phone": "9844500005",
      "emergencyContact": true
    }
  ],
  "parkingSlots": [
    {
      "id": "P-01",
      "tower": "Tower A",
      "location": "Tower A Basement",
      "status": "Occupied",
      "vehicleNo": "MH 02 JN 1001",
      "ownerName": "Jenil Barad (Admin)",
      "flat": "A-101",
      "vehicleType": "SUV",
      "notes": ""
    },
    {
      "id": "P-02",
      "tower": "Tower A",
      "location": "Tower A Basement",
      "status": "Available",
      "vehicleNo": "",
      "ownerName": "",
      "flat": "",
      "vehicleType": "",
      "notes": ""
    },
    {
      "id": "P-03",
      "tower": "Tower A",
      "location": "Tower A Basement",
      "status": "Available",
      "vehicleNo": "",
      "ownerName": "",
      "flat": "",
      "vehicleType": "",
      "notes": ""
    },
    {
      "id": "P-04",
      "tower": "Tower A",
      "location": "Tower A Basement",
      "status": "Available",
      "vehicleNo": "",
      "ownerName": "",
      "flat": "",
      "vehicleType": "",
      "notes": ""
    },
    {
      "id": "P-05",
      "tower": "Tower A",
      "location": "Tower A Basement",
      "status": "Available",
      "vehicleNo": "",
      "ownerName": "",
      "flat": "",
      "vehicleType": "",
      "notes": ""
    },
    {
      "id": "P-06",
      "tower": "Tower A",
      "location": "Tower A Basement",
      "status": "Available",
      "vehicleNo": "",
      "ownerName": "",
      "flat": "",
      "vehicleType": "",
      "notes": ""
    },
    {
      "id": "P-07",
      "tower": "Tower A",
      "location": "Tower A Basement",
      "status": "Available",
      "vehicleNo": "",
      "ownerName": "",
      "flat": "",
      "vehicleType": "",
      "notes": ""
    },
    {
      "id": "P-08",
      "tower": "Tower A",
      "location": "Tower A Basement",
      "status": "Occupied",
      "vehicleNo": "MH 04 BR 7723",
      "ownerName": "Rahul Sharma",
      "flat": "B-104",
      "vehicleType": "Hatchback",
      "notes": ""
    },
    {
      "id": "P-09",
      "tower": "Tower B",
      "location": "Tower B Basement",
      "status": "Available",
      "vehicleNo": "",
      "ownerName": "",
      "flat": "",
      "vehicleType": "",
      "notes": ""
    },
    {
      "id": "P-10",
      "tower": "Tower B",
      "location": "Tower B Basement",
      "status": "Available",
      "vehicleNo": "",
      "ownerName": "",
      "flat": "",
      "vehicleType": "",
      "notes": ""
    },
    {
      "id": "P-11",
      "tower": "Tower B",
      "location": "Tower B Basement",
      "status": "Available",
      "vehicleNo": "",
      "ownerName": "",
      "flat": "",
      "vehicleType": "",
      "notes": ""
    },
    {
      "id": "P-12",
      "tower": "Tower B",
      "location": "Tower B Basement",
      "status": "Reserved",
      "vehicleNo": "",
      "ownerName": "",
      "flat": "",
      "vehicleType": "",
      "notes": "Guest parking — Society Office"
    },
    {
      "id": "P-13",
      "tower": "Tower B",
      "location": "Tower B Basement",
      "status": "Available",
      "vehicleNo": "",
      "ownerName": "",
      "flat": "",
      "vehicleType": "",
      "notes": ""
    },
    {
      "id": "P-14",
      "tower": "Tower B",
      "location": "Tower B Basement",
      "status": "Occupied",
      "vehicleNo": "MH 02 EQ 8829",
      "ownerName": "Amit Patel",
      "flat": "A-302",
      "vehicleType": "SUV",
      "notes": ""
    },
    {
      "id": "P-15",
      "tower": "Tower B",
      "location": "Tower B Basement",
      "status": "Available",
      "vehicleNo": "",
      "ownerName": "",
      "flat": "",
      "vehicleType": "",
      "notes": ""
    },
    {
      "id": "P-16",
      "tower": "Tower B",
      "location": "Tower B Basement",
      "status": "Available",
      "vehicleNo": "",
      "ownerName": "",
      "flat": "",
      "vehicleType": "",
      "notes": ""
    },
    {
      "id": "P-17",
      "tower": "Tower C",
      "location": "Tower C Basement",
      "status": "Available",
      "vehicleNo": "",
      "ownerName": "",
      "flat": "",
      "vehicleType": "",
      "notes": ""
    },
    {
      "id": "P-18",
      "tower": "Tower C",
      "location": "Tower C Basement",
      "status": "Available",
      "vehicleNo": "",
      "ownerName": "",
      "flat": "",
      "vehicleType": "",
      "notes": ""
    },
    {
      "id": "P-19",
      "tower": "Tower C",
      "location": "Tower C Basement",
      "status": "Occupied",
      "vehicleNo": "MH 01 CX 5588",
      "ownerName": "Neha Gupta",
      "flat": "B-202",
      "vehicleType": "Scooter",
      "notes": ""
    },
    {
      "id": "P-20",
      "tower": "Tower C",
      "location": "Tower C Basement",
      "status": "Available",
      "vehicleNo": "",
      "ownerName": "",
      "flat": "",
      "vehicleType": "",
      "notes": ""
    },
    {
      "id": "P-21",
      "tower": "Tower C",
      "location": "Tower C Basement",
      "status": "Available",
      "vehicleNo": "",
      "ownerName": "",
      "flat": "",
      "vehicleType": "",
      "notes": ""
    },
    {
      "id": "P-22",
      "tower": "Tower C",
      "location": "Tower C Basement",
      "status": "Occupied",
      "vehicleNo": "MH 04 AX 4410",
      "ownerName": "Priya Verma",
      "flat": "C-501",
      "vehicleType": "Sedan",
      "notes": ""
    },
    {
      "id": "P-23",
      "tower": "Tower C",
      "location": "Tower C Basement",
      "status": "Available",
      "vehicleNo": "",
      "ownerName": "",
      "flat": "",
      "vehicleType": "",
      "notes": ""
    },
    {
      "id": "P-24",
      "tower": "Tower C",
      "location": "Tower C Basement",
      "status": "Reserved",
      "vehicleNo": "",
      "ownerName": "",
      "flat": "",
      "vehicleType": "",
      "notes": "Reserved for Ananya Deshmukh (A-604) — second car slot request under review"
    }
  ]
};
  }
};
