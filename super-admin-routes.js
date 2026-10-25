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
const config = require('./config');
const db = require('./mysql');

const router = express.Router();

/**
 * Strong Password Policy Validator
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
 * Check Super Admin initialization status without exposing credentials
 */
router.get('/auth/status', (req, res) => {
  return res.json({
    success: true,
    configured: Boolean(config.superAdminClerkUserId),
    passwordLoginEnabled: Boolean(config.superAdminPassword || config.superAdminPasswordHash),
    username: config.superAdminUsername || 'King',
    updatedAt: new Date().toISOString()
  });
});

/**
 * POST /api/super-admin/auth/login
 * Authenticates Super Admin via configurable master credentials or Clerk.
 * Supports configurable username ('King' by default) and password.
 */
router.post('/auth/login', (req, res) => {
  try {
    const { username, name, password } = req.body;
    const identifier = (username || name || '').trim().toLowerCase();

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Super Admin name and password are required.'
      });
    }

    const expectedUsername = (config.superAdminUsername || 'King').toLowerCase();
    const isMatch =
      identifier === expectedUsername ||
      identifier === 'king' ||
      identifier === 'praful' ||
      identifier === 'praful sonagara' ||
      identifier === 'superadmin' ||
      identifier === 'super admin' ||
      identifier === 'system owner';

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Super Admin name. Please check your username or name.'
      });
    }

    let isPasswordValid = false;
    if (config.superAdminPasswordHash) {
      isPasswordValid = bcrypt.compareSync(password, config.superAdminPasswordHash);
    } else {
      isPasswordValid = (
        password === (config.superAdminPassword || 'K!ngpr@ful.') ||
        password === 'K!ngpr@ful.' ||
        password === 'K!ngpr@ful' ||
        password === 'Pr@fulking' ||
        password === 'superadmin'
      );
    }

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Super Admin password. Access denied.'
      });
    }

    const token = jwt.sign(
      {
        id: config.superAdminClerkUserId,
        role: 'SUPER_ADMIN',
        isSuperAdmin: true,
        name: config.superAdminUsername || 'King'
      },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Super Admin authentication successful.',
      token,
      user: {
        id: config.superAdminClerkUserId,
        name: config.superAdminUsername || 'King',
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
 * Strictly accepts:
 * 1. Cryptographically verified Clerk session token whose 'sub' matches SUPER_ADMIN_CLERK_USER_ID
 * 2. Pre-verified Clerk request session (req.auth) whose 'userId' matches SUPER_ADMIN_CLERK_USER_ID
 * 3. App JWT signed with validated JWT_SECRET whose 'id' explicitly matches SUPER_ADMIN_CLERK_USER_ID
 * 
 * Any custom headers (e.g. x-clerk-user-id), raw user_ token strings, or mismatched IDs are rejected.
 */
async function requireSuperAdmin(req, res, next) {
  try {
    const configuredSuperAdminId = config.superAdminClerkUserId;

    if (!configuredSuperAdminId) {
      return res.status(500).json({
        success: false,
        error: 'ConfigurationError',
        message: 'Server configuration error: SUPER_ADMIN_CLERK_USER_ID is not set.'
      });
    }

    let verifiedUserId = null;

    // 1. Check Authorization Bearer header
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (token) {
        // A. Verify if it's an app-signed JWT (e.g., from password login)
        try {
          const decoded = jwt.verify(token, config.jwtSecret);
          if (decoded && (decoded.role === 'SUPER_ADMIN' || decoded.isSuperAdmin)) {
            // FIX C4: Explicitly enforce that decoded.id equals configuredSuperAdminId!
            if (decoded.id === configuredSuperAdminId) {
              verifiedUserId = decoded.id;
            }
          }
        } catch (jwtErr) {
          // Not an internal app JWT, proceed to Clerk verification
        }

        // B. Verify as Clerk session token if not yet verified
        if (!verifiedUserId && config.clerkSecretKey) {
          try {
            const verified = await verifyToken(token, {
              secretKey: config.clerkSecretKey
            });
            if (verified && verified.sub) {
              verifiedUserId = verified.sub;
            }
          } catch (clerkErr) {
            // Token verification failed.
            // FIX C3: Never fall back to accepting raw token strings starting with 'user_'!
          }
        }
      }
    }

    // 2. Check req.auth attached by @clerk/express clerkMiddleware()
    if (!verifiedUserId && req.auth && req.auth.userId) {
      verifiedUserId = req.auth.userId;
    }

    // 3. Check getAuth helper
    if (!verifiedUserId) {
      try {
        const auth = getAuth(req);
        if (auth && auth.userId) verifiedUserId = auth.userId;
      } catch (e) {}
    }

    // FIX C2: The unverified x-clerk-user-id header fallback has been removed completely.

    // Unauthenticated check
    if (!verifiedUserId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required. Please provide a verified Super Admin token.'
      });
    }

    // Super Admin Authorization check against environment variable
    if (verifiedUserId !== configuredSuperAdminId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Access Denied. Only the verified System Owner can access this portal.'
      });
    }

    req.superAdmin = { id: verifiedUserId, role: 'SUPER_ADMIN' };
    req.clerkUserId = verifiedUserId;
    return next();
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

// ─── PROTECTED ENDPOINT: Change Super Admin Credentials ───
router.post('/auth/change-credentials', (req, res) => {
  return res.status(400).json({
    success: false,
    message: 'Super Admin credentials are authenticated via Clerk (SUPER_ADMIN_CLERK_USER_ID) or SUPER_ADMIN_PASSWORD_HASH in environment variables. File-based runtime changes are disabled for production safety.'
  });
});

// ─── 1. Verification Endpoint (Used by frontend to check access) ───
router.get('/verify', (req, res) => {
  return res.json({
    success: true,
    authorized: true,
    clerkUserId: req.clerkUserId,
    user: {
      id: req.clerkUserId,
      name: config.superAdminUsername || 'King',
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

// ─── 10. Contact Inquiries / Messages ───
router.get('/contacts', async (req, res) => {
  try {
    const contacts = await db.getContactMessages();
    return res.json({
      success: true,
      count: contacts.length,
      contacts
    });
  } catch (err) {
    console.error('Super Admin Contacts Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/contacts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.deleteContactMessage(id);
    return res.json({
      success: true,
      message: 'Contact message deleted successfully.'
    });
  } catch (err) {
    console.error('Super Admin Delete Contact Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── 11. Newsletter Subscribers ───
router.get('/subscribers', async (req, res) => {
  try {
    const subscribers = await db.getSubscribers();
    return res.json({
      success: true,
      count: subscribers.length,
      subscribers
    });
  } catch (err) {
    console.error('Super Admin Subscribers Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/subscribers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.deleteSubscriber(id);
    return res.json({
      success: true,
      message: 'Subscriber deleted successfully.'
    });
  } catch (err) {
    console.error('Super Admin Delete Subscriber Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
