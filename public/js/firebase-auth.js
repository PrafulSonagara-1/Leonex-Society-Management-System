/**
 * SocietyHub — Authentication Service
 * ─────────────────────────────────────────────────
 * Server-first auth via /api/auth endpoints (bcrypt + JWT) with a
 * client-side SystemDB fallback for static hosting (demo mode).
 * Google Sign-In via Firebase SDK (compat) + server JWT.
 *
 * Public API (used by login.html / waiting-approval.html / portals):
 *   firebaseLoginWithEmail(email, password) → {success, user} | {success:false, message, status?}
 *   firebaseRegisterWithEmail(name, email, password, role, extra) → same shape
 *   firebaseLoginWithGoogle() → same shape
 *   demoLogin(role) → {success, user} | {success:false, message}   (1-Click demo buttons)
 *   firebaseSignOut()
 *
 * Every successful login sets the session (sessionStorage 'ssm_current_user')
 * and writes SystemDB.logAudit('User Login', 'Auth', ...).
 */

const firebaseConfig = {
  apiKey: "AIzaSyAQKGxFLBwKpE-Rg5SkqhXGBNMoLzOz_as",
  authDomain: "smart-sm-c30db.firebaseapp.com",
  projectId: "smart-sm-c30db",
  storageBucket: "smart-sm-c30db.firebasestorage.app",
  messagingSenderId: "730008445249",
  appId: "1:730008445249:web:477cd1cba54490b39481c0",
  measurementId: "G-7WEFSX4VFV"
};

let firebaseApp = null;
let firebaseAuth = null;
let googleProvider = null;
let isFirebaseInitialized = false;

// Canonical demo accounts — one per role, used by the 1-Click Demo buttons.
const DEMO_ACCOUNTS = {
  'Admin': 'jenilbarad089@gmail.com',
  'Resident': 'amit.patel@gmail.com',
  'Security Guard': 'guard@smartsociety.com',
  'Committee Member': 'suresh.treasurer@smartsociety.com'
};

// Initialize Firebase (for Google Auth only)
function initFirebaseAuth() {
  try {
    if (typeof firebase !== 'undefined' && firebase.apps) {
      if (!firebase.apps.length) {
        firebaseApp = firebase.initializeApp(firebaseConfig);
      } else {
        firebaseApp = firebase.app();
      }
      firebaseAuth = firebase.auth();
      googleProvider = new firebase.auth.GoogleAuthProvider();
      isFirebaseInitialized = true;
      console.log("Firebase initialized for Google Sign-In");
    }
  } catch (err) {
    console.warn("Firebase init skipped:", err);
  }
}

/* ────────────────────────────────────────────────
   Internal helpers
   ──────────────────────────────────────────────── */

// Session key must match SystemDB (db.js) — kept literal so this file
// stays readable even if loaded before db.js.
const AUTH_SESSION_KEY = 'ssm_current_user';

function __authSetSession(user) {
  sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
}

// Meaningful, human-friendly message for each account status.
function __authStatusMessage(status) {
  switch (status) {
    case 'Pending':
      return 'Your account is awaiting admin approval. You can sign in once the Society Administrator approves your registration.';
    case 'Rejected':
      return 'Your registration was rejected. Please contact the Society Office for details or re-register with correct information.';
    case 'Suspended':
      return 'Your account has been suspended. Please contact the Society Office to restore access.';
    default:
      return 'Your account is not active. Please contact the Society Office.';
  }
}

// Guard: only Approved accounts may enter a portal. Returns a blocked
// result object for non-approved users, or null when the user may proceed.
function __authStatusGate(user) {
  if (user && user.status && user.status !== 'Approved') {
    return { success: false, message: __authStatusMessage(user.status), status: user.status };
  }
  return null;
}

// Audit helper — never lets audit failures break an auth flow.
// The session is set BEFORE this is called so logAudit attributes
// the action to the correct user.
function __authAudit(action, details) {
  try {
    if (typeof SystemDB !== 'undefined' && SystemDB && SystemDB.data && typeof SystemDB.logAudit === 'function') {
      SystemDB.logAudit(action, 'Auth', details || '');
    }
  } catch (e) {
    console.warn('Audit log skipped:', e);
  }
}

// Notify the Admin when a new registration needs approval. Non-fatal.
function __authNotifyAdmin(newUser) {
  try {
    if (typeof SystemDB !== 'undefined' && SystemDB && SystemDB.data && typeof SystemDB.notify === 'function') {
      SystemDB.notify({
        target: 'Admin',
        type: 'approval',
        title: 'New registration request',
        message: (newUser.name || 'A new member') + ' (' + (newUser.role || 'Resident') + ') has registered and is awaiting approval.',
        link: 'admin.html'
      });
    }
  } catch (e) { /* non-fatal */ }
}

// Parse a fetch Response body as JSON without throwing on HTML/empty bodies
// (static hosts answer unknown /api routes with HTML pages).
async function __authParseJson(res) {
  try {
    const data = await res.json();
    return (data && typeof data === 'object') ? data : null;
  } catch (e) {
    return null;
  }
}

// Users collection reference that is safe to mutate + save.
function __authUsers() {
  if (typeof SystemDB === 'undefined' || !SystemDB) return [];
  if (typeof SystemDB.getCollection === 'function') return SystemDB.getCollection('users');
  return (SystemDB.data && SystemDB.data.users) ? SystemDB.data.users : [];
}

/* ────────────────────────────────────────────────
   POST /api/auth/login  —  Email/username + password
   Server-first; falls back to the client-side demo
   login when the backend is unavailable (static hosting).
   ──────────────────────────────────────────────── */
async function firebaseLoginWithEmail(email, password) {
  // 1) Try the Express backend first
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await __authParseJson(res);
    if (data) {
      // Success — server issued a JWT + user profile
      if (data.success && data.token && data.user) {
        SystemDB.setToken(data.token);
        __authSetSession(data.user);
        __authAudit('User Login', (data.user.name || data.user.email) + ' (' + (data.user.role || 'Member') + ') signed in with email + password');
        return { success: true, user: data.user };
      }

      // Account-state rejections — map to specific messages and stop here.
      // (The client fallback would block these users too, but with less detail.)
      // The server returns these with HTTP 403 + a `status` field.
      const status = data.status;
      if (status === 'Pending' || status === 'Rejected' || status === 'Suspended') {
        return { success: false, message: data.message || __authStatusMessage(status), status: status };
      }
      // Any other result (400/401/500 or unexpected body) falls through to the
      // client-side demo fallback below — preserving the dual architecture where
      // static hosts and demo presets still authenticate via SystemDB.
    }
  } catch (err) {
    console.warn('Backend API login unavailable, using SystemDB fallback:', err);
  }

  // 2) Client-side fallback for demo logins & static (Vercel) deployments
  const lookup = (email || '').toLowerCase().trim();
  const users = __authUsers();

  // Direct email/username match first
  let user = users.find(u =>
    (u.email && u.email.toLowerCase() === lookup) ||
    (u.username && u.username.toLowerCase() === lookup)
  );

  // Demo presets / shorthand fallback matching
  if (!user) {
    if (['admin', 'admin@smartsociety.com', 'jenilbarad089@gmail.com', 'jenilbarad089'].includes(lookup)) {
      user = users.find(u => u.role === 'Admin');
    } else if (['resident', 'resident1', 'amit.patel@gmail.com', 'amit'].includes(lookup)) {
      user = users.find(u => u.email === 'amit.patel@gmail.com');
    } else if (['guard', 'guard@smartsociety.com', 'bahadur'].includes(lookup)) {
      user = users.find(u => u.role === 'Security Guard' && u.gateAssigned === 'Gate 1');
    } else if (['committee', 'suresh@smartsociety.com', 'suresh.treasurer@smartsociety.com', 'suresh'].includes(lookup)) {
      user = users.find(u => u.email === 'suresh.treasurer@smartsociety.com');
    } else if (['rohan', 'rohan.secretary@smartsociety.com'].includes(lookup)) {
      user = users.find(u => u.email === 'rohan.secretary@smartsociety.com');
    } else if (['vikram', 'vikram.yadav@gmail.com'].includes(lookup)) {
      user = users.find(u => u.email === 'vikram.yadav@gmail.com');
    } else if (['priya', 'priya.v@gmail.com'].includes(lookup)) {
      user = users.find(u => u.email === 'priya.v@gmail.com');
    } else if (['rahul', 'rahul.sharma@gmail.com'].includes(lookup)) {
      user = users.find(u => u.email === 'rahul.sharma@gmail.com');
    } else if (['neha', 'neha.gupta@gmail.com'].includes(lookup)) {
      user = users.find(u => u.email === 'neha.gupta@gmail.com');
    } else if (['ananya', 'ananya.d@gmail.com'].includes(lookup)) {
      user = users.find(u => u.email === 'ananya.d@gmail.com');
    }
  }

  if (user) {
    const blocked = __authStatusGate(user);
    if (blocked) return blocked;
    __authSetSession(user);
    __authAudit('User Login', (user.name || user.email) + ' (' + (user.role || 'Member') + ') signed in via demo fallback');
    return { success: true, user: user };
  }

  return { success: false, message: 'Invalid email or password. Please check your credentials or use a 1-Click Demo account below.' };
}

/* ────────────────────────────────────────────────
   demoLogin(role) — 1-Click Demo Accounts
   Finds the canonical demo user for a role, sets the
   session, audits the login and returns {success, user}.
   ──────────────────────────────────────────────── */
function demoLogin(role) {
  try {
    const canonicalEmail = DEMO_ACCOUNTS[role];
    if (!canonicalEmail) {
      return { success: false, message: 'No demo account is configured for this role.' };
    }

    const users = __authUsers();
    let user = users.find(u => u.email && u.email.toLowerCase() === canonicalEmail.toLowerCase());
    // Resilient fallback: any approved user wearing that role
    if (!user) user = users.find(u => u.role === role && (!u.status || u.status === 'Approved'));

    if (!user) {
      return { success: false, message: 'Demo account for ' + role + ' was not found in the sample data. Please reset demo data from the Admin portal.' };
    }

    const blocked = __authStatusGate(user);
    if (blocked) return blocked;

    __authSetSession(user);
    __authAudit('User Login', 'One-click demo login as ' + (user.name || user.email) + ' (' + (user.role || role) + ')');
    return { success: true, user: user };
  } catch (err) {
    console.error('demoLogin failed:', err);
    return { success: false, message: 'Demo login failed. Please try again.' };
  }
}

/* ────────────────────────────────────────────────
   POST /api/auth/register  —  Create new account
   New accounts are created with status 'Pending' and
   need Admin approval before portal access.
   ──────────────────────────────────────────────── */
async function firebaseRegisterWithEmail(name, email, password, role, extra) {
  // 1) Try the Express backend first
  try {
    const body = { name, email, password, role, ...(extra || {}) };
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await __authParseJson(res);
    if (data) {
      if (data.success && data.user) {
        if (data.token) SystemDB.setToken(data.token);
        __authSetSession(data.user);
        __authAudit('User Registered', 'New ' + (data.user.role || 'Resident') + ' registration: ' + (data.user.name || '') + ' (' + (data.user.email || email) + ') — pending approval');
        __authNotifyAdmin(data.user);
        return { success: true, user: data.user };
      }
      // Definitive validation errors from a live backend (duplicate email, etc.)
      if (res.status === 400 || res.status === 403 || res.status === 409) {
        return { success: false, message: data.message || 'Registration failed. Please check your details and try again.' };
      }
      // 5xx / unexpected body → fall through to the local fallback
    }
  } catch (err) {
    console.warn('Backend API register unavailable, using SystemDB fallback:', err);
  }

  // 2) Fallback registration for static deployments
  const users = __authUsers();
  const lookup = (email || '').toLowerCase().trim();

  const existing = users.find(u => u.email && u.email.toLowerCase() === lookup);
  if (existing) {
    return { success: false, message: 'An account with this email address already exists. Try signing in instead.' };
  }

  const newUser = {
    id: (typeof SystemDB.nextId === 'function') ? SystemDB.nextId('USR') : ('USR-' + (users.length + 101)),
    username: email.split('@')[0],
    name: name,
    email: email,
    role: role || 'Resident',
    status: 'Pending',
    phone: (extra && extra.phone) || '',
    flat: (extra && extra.flat) || '',
    societyCode: (extra && extra.societyCode) || '',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(name || email),
    registeredAt: new Date().toISOString().split('T')[0],
    approvedAt: null
  };

  users.push(newUser);
  if (typeof SystemDB.save === 'function') SystemDB.save();
  __authSetSession(newUser);
  __authAudit('User Registered', 'New ' + newUser.role + ' registration: ' + newUser.name + ' (' + newUser.email + ') — pending approval');
  __authNotifyAdmin(newUser);

  return { success: true, user: newUser };
}

/* ────────────────────────────────────────────────
   Google Sign-In  —  Firebase popup → Server JWT / Client Fallback
   ──────────────────────────────────────────────── */
async function firebaseLoginWithGoogle() {
  initFirebaseAuth();

  if (!isFirebaseInitialized || !firebaseAuth || !googleProvider) {
    return {
      success: false,
      message: 'Google Sign-In is unavailable right now (Firebase SDK could not be initialized). Please use email sign-in or a 1-Click Demo account.'
    };
  }

  try {
    const result = await firebaseAuth.signInWithPopup(googleProvider);
    const fbUser = result.user;

    // 1. Try Express Backend API (/api/auth/google)
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: fbUser.email,
          displayName: fbUser.displayName,
          photoURL: fbUser.photoURL,
          uid: fbUser.uid,
        }),
      });

      const data = await __authParseJson(res);
      if (data && data.success && data.token && data.user) {
        SystemDB.setToken(data.token);
        return __finishGoogleLogin(data.user);
      }
    } catch (apiErr) {
      console.warn("Backend API unavailable, executing client-side auth fallback for Vercel:", apiErr);
    }

    // 2. Client-side fallback for static Vercel hosting
    const users = __authUsers();
    let existing = users.find(u => u.email && u.email.toLowerCase() === fbUser.email.toLowerCase());

    if (!existing) {
      const isUserAdmin = fbUser.email.toLowerCase() === 'jenilbarad089@gmail.com';
      existing = {
        id: (typeof SystemDB.nextId === 'function') ? SystemDB.nextId('USR') : ('USR-' + (users.length + 101)),
        username: fbUser.email.split('@')[0],
        name: fbUser.displayName || fbUser.email.split('@')[0],
        role: isUserAdmin ? 'Admin' : 'Resident',
        flat: isUserAdmin ? 'A-101' : 'B-101',
        email: fbUser.email,
        phone: fbUser.phoneNumber || '',
        avatar: fbUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fbUser.displayName || fbUser.email)}`,
        status: 'Approved',
        registeredAt: new Date().toISOString().split('T')[0]
      };
      users.push(existing);
      if (typeof SystemDB.save === 'function') SystemDB.save();
    }

    return __finishGoogleLogin(existing);

  } catch (error) {
    console.error('Google Sign-In error:', error);
    if (error.code === 'auth/unauthorized-domain') {
      return {
        success: false,
        message: 'This domain is not authorized for Google Sign-In. Please use email sign-in or a 1-Click Demo account instead.'
      };
    }
    if (error.code === 'auth/popup-closed-by-user') {
      return { success: false, message: 'Google sign-in window was closed before completing.' };
    }
    if (error.code === 'auth/popup-blocked') {
      return { success: false, message: 'Your browser blocked the Google sign-in popup. Please allow popups and try again.' };
    }
    if (error.code === 'auth/network-request-failed' || error.code === 'auth/configuration-not-found') {
      return { success: false, message: 'Google Sign-In is not available right now. Please use email sign-in or a 1-Click Demo account.' };
    }
    return { success: false, message: error.message || 'Google sign-in failed.' };
  }
}

// Shared finisher: gate on account status, set session, audit.
function __finishGoogleLogin(user) {
  const blocked = __authStatusGate(user);
  if (blocked) return blocked;
  __authSetSession(user);
  __authAudit('User Login', (user.name || user.email) + ' (' + (user.role || 'Member') + ') signed in with Google');
  return { success: true, user: user };
}

/* ────────────────────────────────────────────────
   Sign out — clear token + session
   ──────────────────────────────────────────────── */
function firebaseSignOut() {
  try {
    const cur = (typeof SystemDB !== 'undefined' && SystemDB && typeof SystemDB.getCurrentUser === 'function')
      ? SystemDB.getCurrentUser()
      : null;
    if (cur) {
      __authAudit('User Logout', (cur.name || cur.email || 'User') + ' (' + (cur.role || 'Member') + ') signed out');
    }
  } catch (e) { /* non-fatal */ }

  if (isFirebaseInitialized && firebaseAuth) {
    firebaseAuth.signOut().catch(() => {});
  }
  if (typeof SystemDB !== 'undefined' && SystemDB) {
    SystemDB.clearToken();
    SystemDB.logout();
  } else {
    localStorage.removeItem('ssm_auth_token');
    sessionStorage.removeItem(AUTH_SESSION_KEY);
  }
}
