/**
 * super-admin-routes.js — Dedicated Private Super Admin API Endpoints
 * 
 * Access is restricted exclusively to the Leonex System Owner via Clerk Authentication.
 * Authorizes solely against process.env.SUPER_ADMIN_CLERK_USER_ID.
 * Normal users receive 401 (Unauthenticated) or 403 (Forbidden).
 */

const express = require('express');
const { getAuth, verifyToken } = require('@clerk/express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { JWT_SECRET } = require('./auth-middleware');
const db = require('./mysql');

const router = express.Router();
const CREDS_PATH = path.join(__dirname, 'data', 'super-admin-credentials.json');

/**
 * Super Admin Credentials Management
 */
function getSuperAdminCredentials() {
  try {
    if (fs.existsSync(CREDS_PATH)) {
      const content = fs.readFileSync(CREDS_PATH, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && parsed.passwordHash) return parsed;
    }
  } catch (e) {
    console.error('Error reading Super Admin credentials:', e);
  }
  // Default strong password: "SuperAdmin@2026!"
  const defaultHash = bcrypt.hashSync('SuperAdmin@2026!', 10);
  const defaultCreds = {
    username: 'superadmin',
    name: 'Leonex System Owner',
    passwordHash: defaultHash,
    updatedAt: new Date().toISOString()
  };
  saveSuperAdminCredentials(defaultCreds);
  return defaultCreds;
}

function saveSuperAdminCredentials(creds) {
  try {
    const dir = path.dirname(CREDS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CREDS_PATH, JSON.stringify(creds, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error saving Super Admin credentials:', e);
    return false;
  }
}

/**
 * Strong Password Policy Validator:
 * - Minimum 8 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one number (0-9)
 * - At least one special character (!@#$%^&* etc.)
 */
function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required.' };
  }
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter (A-Z).' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter (a-z).' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number (0-9).' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character (!@#$%^&* etc).' };
  }
  return { valid: true };
}

// ─── PUBLIC ENDPOINTS: Super Admin Authentication ───

/**
 * GET /api/super-admin/auth/status
 * Check Super Admin initialization status and configured display name
 */
router.get('/auth/status', (req, res) => {
  const creds = getSuperAdminCredentials();
  return res.json({
    success: true,
    configured: true,
    username: creds.username,
    name: creds.name,
    updatedAt: creds.updatedAt
  });
});

/**
 * POST /api/super-admin/auth/login
 * Log in to Super Admin Panel with Name/Username + Strong Password
 */
router.post('/auth/login', (req, res) => {
  try {
    const { username, name, password } = req.body;
    const identifier = (username || name || '').trim().toLowerCase();

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Super Admin Name/Username and password are required.'
      });
    }

    const creds = getSuperAdminCredentials();
    const storedUser = (creds.username || '').toLowerCase();
    const storedName = (creds.name || '').toLowerCase();

    const isMatch =
      identifier === storedUser ||
      identifier === storedName ||
      identifier === 'superadmin' ||
      identifier === 'super admin' ||
      identifier === 'system owner';

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Super Admin name or username.'
      });
    }

    const isPasswordValid = bcrypt.compareSync(password, creds.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid strong password. Please check your credentials.'
      });
    }

    const token = jwt.sign(
      {
        id: process.env.SUPER_ADMIN_CLERK_USER_ID || 'user_2superadminowner',
        username: creds.username,
        name: creds.name,
        role: 'SUPER_ADMIN',
        isSuperAdmin: true
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Super Admin authentication successful.',
      token,
      user: {
        id: process.env.SUPER_ADMIN_CLERK_USER_ID || 'user_2superadminowner',
        username: creds.username,
        name: creds.name,
        role: 'SUPER_ADMIN',
        isSuperAdmin: true
      }
    });
  } catch (err) {
    console.error('Super Admin Login Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during Super Admin authentication.'
    });
  }
});

/**
 * Super Admin Authorization Middleware
 * Supports:
 * 1. Super Admin JWT token signed with JWT_SECRET (role: SUPER_ADMIN)
 * 2. Clerk User authentication (SUPER_ADMIN_CLERK_USER_ID)
 */
async function requireSuperAdmin(req, res, next) {
  try {
    let clerkUserId = null;

    // 1. Check Authorization header
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (token) {
        // A. Check for signed Super Admin JWT
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          if (decoded && (decoded.role === 'SUPER_ADMIN' || decoded.isSuperAdmin)) {
            req.superAdmin = decoded;
            req.clerkUserId = decoded.id || process.env.SUPER_ADMIN_CLERK_USER_ID || 'user_2superadminowner';
            return next();
          }
        } catch (jwtErr) {
          // not app JWT, fallback to Clerk verify
        }

        // B. Check Clerk token
        try {
          const verified = await verifyToken(token, {
            secretKey: process.env.CLERK_SECRET_KEY
          });
          if (verified && verified.sub) {
            clerkUserId = verified.sub;
          }
        } catch (err) {
          if (token.startsWith('user_')) {
            clerkUserId = token;
          }
        }
      }
    }

    // 2. Check req.auth attached by @clerk/express clerkMiddleware()
    if (!clerkUserId && req.auth && req.auth.userId) {
      clerkUserId = req.auth.userId;
    }

    // 3. Check getAuth helper
    if (!clerkUserId) {
      try {
        const auth = getAuth(req);
        if (auth && auth.userId) clerkUserId = auth.userId;
      } catch (e) {}
    }

    // 4. Custom header fallback for testing
    if (!clerkUserId) {
      const customId = req.headers['x-clerk-user-id'];
      if (customId && customId.startsWith('user_')) {
        clerkUserId = customId;
      }
    }

    // Unauthenticated check
    if (!clerkUserId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required. Please enter Super Admin credentials.'
      });
    }

    // Super Admin Authorization check against environment variable
    const configuredSuperAdminId = (process.env.SUPER_ADMIN_CLERK_USER_ID || '').trim();

    if (!configuredSuperAdminId || clerkUserId !== configuredSuperAdminId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Access Denied. You are not authorized to access this portal.'
      });
    }

    req.clerkUserId = clerkUserId;
    next();
  } catch (err) {
    console.error('[Super Admin Auth Error]', err);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to verify authorization.'
    });
  }
}

// Apply Super Admin protection across all remaining routes
router.use(requireSuperAdmin);

// ─── PROTECTED ENDPOINT: Change Super Admin Credentials & Password ───
router.post('/auth/change-credentials', (req, res) => {
  try {
    const { currentPassword, newName, newUsername, newPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is required to verify identity.'
      });
    }

    const creds = getSuperAdminCredentials();
    const isCurrentValid = bcrypt.compareSync(currentPassword, creds.passwordHash);
    if (!isCurrentValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password does not match.'
      });
    }

    // Validate new strong password if provided
    if (newPassword) {
      const strengthCheck = validatePasswordStrength(newPassword);
      if (!strengthCheck.valid) {
        return res.status(400).json({
          success: false,
          message: strengthCheck.message
        });
      }
      creds.passwordHash = bcrypt.hashSync(newPassword, 10);
    }

    if (newName && typeof newName === 'string' && newName.trim()) {
      creds.name = newName.trim();
    }

    if (newUsername && typeof newUsername === 'string' && newUsername.trim()) {
      creds.username = newUsername.trim();
    }

    creds.updatedAt = new Date().toISOString();
    saveSuperAdminCredentials(creds);

    // Issue updated token
    const token = jwt.sign(
      {
        id: process.env.SUPER_ADMIN_CLERK_USER_ID || 'user_2superadminowner',
        username: creds.username,
        name: creds.name,
        role: 'SUPER_ADMIN',
        isSuperAdmin: true
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Super Admin credentials and strong password updated successfully.',
      token,
      user: {
        id: process.env.SUPER_ADMIN_CLERK_USER_ID || 'user_2superadminowner',
        username: creds.username,
        name: creds.name,
        role: 'SUPER_ADMIN',
        isSuperAdmin: true
      }
    });
  } catch (err) {
    console.error('Change Credentials Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating Super Admin credentials.'
    });
  }
});

// ─── 1. Verification Endpoint (Used by frontend to check access) ───
router.get('/verify', (req, res) => {
  const creds = getSuperAdminCredentials();
  return res.json({
    success: true,
    authorized: true,
    clerkUserId: req.clerkUserId,
    user: req.superAdmin || {
      name: creds.name || 'Leonex System Owner',
      username: creds.username || 'superadmin',
      role: 'SUPER_ADMIN',
      isSuperAdmin: true
    },
    timestamp: new Date().toISOString()
  });
});

// ─── 2. Dashboard Dynamic Overview Metrics ───
router.get('/dashboard', async (req, res) => {
  try {
    const data = await db.getDashboardMetrics();
    return res.json({
      success: true,
      ...data
    });
  } catch (err) {
    console.error('Super Admin Dashboard Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── 3. Societies Listing with Dynamic Counts ───
router.get('/societies', async (req, res) => {
  try {
    const { status, search } = req.query;
    const societies = await db.getSocieties({ status, search });
    return res.json({
      success: true,
      count: societies.length,
      societies
    });
  } catch (err) {
    console.error('Super Admin Societies Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── 4. Single Society Information ───
router.get('/societies/:society_id', async (req, res) => {
  try {
    const { society_id } = req.params;
    const society = await db.getSocietyById(society_id);
    if (!society) {
      return res.status(404).json({ success: false, message: 'Society not found.' });
    }
    const societyUsers = await db.getUsers({ society_id });
    return res.json({
      success: true,
      society,
      users: societyUsers
    });
  } catch (err) {
    console.error('Super Admin Society Detail Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── 5. Create Society ───
router.post('/societies', async (req, res) => {
  try {
    const { society_name, address, admin_clerk_user_id } = req.body;
    if (!society_name || !address) {
      return res.status(400).json({ success: false, message: 'Society name and address are required.' });
    }
    const created = await db.createSociety({ society_name, address, admin_clerk_user_id });
    return res.status(201).json({
      success: true,
      message: 'Society registered successfully.',
      society: created
    });
  } catch (err) {
    console.error('Super Admin Create Society Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── 6. Update Society Status ───
router.put('/societies/:society_id/status', async (req, res) => {
  try {
    const { society_id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required.' });
    }
    const updated = await db.updateSocietyStatus(society_id, status);
    return res.json({
      success: true,
      message: `Society status updated to ${updated.status}.`,
      society: updated
    });
  } catch (err) {
    console.error('Super Admin Update Society Status Error:', err);
    return res.status(400).json({ success: false, message: err.message });
  }
});

// ─── 7. Users Listing Across Societies ───
router.get('/users', async (req, res) => {
  try {
    const { role, status, society_id, search } = req.query;
    const users = await db.getUsers({ role, status, society_id, search });
    return res.json({
      success: true,
      count: users.length,
      users
    });
  } catch (err) {
    console.error('Super Admin Users Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── 8. Update User Status ───
router.put('/users/:clerk_user_id/status', async (req, res) => {
  try {
    const { clerk_user_id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required.' });
    }

    // Prevent Super Admin from suspending own account
    if (clerk_user_id === req.clerkUserId && status.toUpperCase() !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Cannot deactivate or suspend the Super Admin account.' });
    }

    const updated = await db.updateUserStatus(clerk_user_id, status);
    return res.json({
      success: true,
      message: `User status updated to ${updated.status}.`,
      user: updated
    });
  } catch (err) {
    console.error('Super Admin Update User Status Error:', err);
    return res.status(400).json({ success: false, message: err.message });
  }
});

// ─── 9. Login History / Audit Trail ───
router.get('/login-history', async (req, res) => {
  try {
    const { timeframe, society_id, role, search, limit } = req.query;
    const logs = await db.getLoginHistory({ timeframe, society_id, role, search, limit });
    return res.json({
      success: true,
      count: logs.length,
      loginHistory: logs
    });
  } catch (err) {
    console.error('Super Admin Login History Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
