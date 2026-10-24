require('dotenv').config();
const config = require('./config');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const authRoutes = require('./auth-routes');
const superAdminRoutes = require('./super-admin-routes');
const { clerkMiddleware } = require('@clerk/express');

const db = require('./mysql');

// Initialize database
db.init().catch(err => console.warn('[DB Init Warning]', err.message));

const app = express();
const PORT = config.port;

// Security Headers & Content Security Policy (M7, H3)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "https://unpkg.com",
          "https://cdn.tailwindcss.com",
          "https://*.clerk.accounts.dev",
          "https://clerk.*",
          "https://accounts.google.com",
          "https://www.gstatic.com"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "https://fonts.googleapis.com",
          "https://unpkg.com"
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
          "https://cdn.jsdelivr.net",
          "data:"
        ],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https:"
        ],
        connectSrc: [
          "'self'",
          "https://*.clerk.accounts.dev",
          "https://clerk.*",
          "https://api.clerk.com",
          "https://firestore.googleapis.com",
          "https://identitytoolkit.googleapis.com",
          "https://*.firebaseio.com"
        ],
        frameSrc: [
          "'self'",
          "https://*.clerk.accounts.dev",
          "https://clerk.*",
          "https://accounts.google.com"
        ],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: config.isProduction ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

// Restricted CORS (H3)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser agents (origin is undefined) or allowed origins from env/config
      if (!origin || config.allowedOrigins.includes('*') || config.allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS policy'));
      }
    },
    credentials: true
  })
);

// Rate Limiting (H3)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' }
});

// Parse payloads
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(clerkMiddleware());

// Apply strict rate limiting to authentication endpoints
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/send-otp', authLimiter);
app.use('/api/auth/verify-otp', authLimiter);
app.use('/api/super-admin/auth/login', authLimiter);

// Super Admin API routes (Strictly protected by Clerk authentication & SUPER_ADMIN_CLERK_USER_ID)
app.use('/api/super-admin', superAdminRoutes);

// Auth API routes (must be before static file middleware)
app.use('/api/auth', authRoutes);

// General API rate limiting
app.use('/api', apiLimiter);

// Health check API
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Smart Society Management System API active' });
});

// Public Contact Form Submission Endpoint
app.post('/api/contact', async (req, res) => {
  try {
    const { name, societyName, society, email, phone, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Name, email, and message are required.' });
    }
    const saved = await db.saveContactMessage({
      name,
      society_name: societyName || society || '',
      email,
      phone: phone || '',
      message
    });
    return res.status(201).json({
      success: true,
      message: 'Thank you! Your message has been received. Our team will contact you shortly.',
      contact: saved
    });
  } catch (err) {
    console.error('Contact submission error:', err);
    return res.status(500).json({ success: false, message: 'Failed to process contact message.' });
  }
});

// Public Newsletter Subscription Endpoint
app.post('/api/subscribe', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'A valid email address is required.' });
    }
    const saved = await db.saveSubscriber(email);
    return res.status(201).json({
      success: true,
      message: 'Successfully subscribed to society updates and announcements!',
      subscriber: saved
    });
  } catch (err) {
    console.error('Newsletter subscribe error:', err);
    return res.status(500).json({ success: false, message: 'Failed to process subscription.' });
  }
});

// Dedicated private route for Super Admin Portal (manual URL access only)
app.get(['/super-admin', '/super-admin/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'super-admin.html'));
});

// Block direct access to super-admin.html (Must manually type /super-admin instead)
app.all(['/super-admin.html', '/public/super-admin.html'], (req, res) => {
  res.status(404).send('Not Found');
});

// Unauthorized landing
app.get('/unauthorized', (req, res) => {
  res.status(403).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>403 - Access Denied</title>
      <style>
        body { background:#09090b; color:#fff; font-family:'Plus Jakarta Sans',sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; text-align:center; }
        .box { max-width:440px; padding:36px; background:#121217; border:1px solid rgba(239,68,68,0.25); border-radius:20px; box-shadow:0 20px 50px rgba(0,0,0,0.5); }
        .icon { width:64px; height:64px; border-radius:50%; background:rgba(239,68,68,0.12); color:#ef4444; display:flex; align-items:center; justify-content:center; font-size:28px; margin:0 auto 16px; }
        h1 { font-size:22px; font-weight:700; color:#fff; margin:0 0 10px; }
        p { color:#a1a1aa; font-size:14px; line-height:1.6; margin:0 0 24px; }
        a { display:inline-block; padding:10px 24px; background:#d4955a; color:#fff; text-decoration:none; font-weight:600; font-size:14px; border-radius:10px; }
      </style>
    </head>
    <body>
      <div class="box">
        <div class="icon">&#9888;</div>
        <h1>Access Denied</h1>
        <p>You are not authorized to access this portal.</p>
        <a href="/index.html">Return to Leonex Home</a>
      </div>
    </body>
    </html>
  `);
});

// Explicitly deny /data route (C6)
app.use('/data', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Serve public static frontend files (data/ directory is intentionally NOT served - C6)
const publicDir = path.resolve(__dirname, 'public');
app.use(express.static(publicDir));

// Fallback to index.html for SPA routing with path traversal protection (M5)
app.get('*', (req, res) => {
  const safePath = path.normalize(req.path).replace(/^(\.\.[\/\\])+/, '');
  const resolvedPath = path.resolve(publicDir, '.' + safePath);

  // Security guard: verify the resolved path remains strictly within publicDir
  if (!resolvedPath.startsWith(publicDir)) {
    return res.status(403).send('Forbidden');
  }

  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
    return res.sendFile(resolvedPath);
  }

  // If the request targets a specific missing asset file, data path, or API, return 404 instead of index.html
  if (path.extname(req.path) || req.path.startsWith('/api') || req.path.startsWith('/data')) {
    return res.status(404).send('Not Found');
  }

  res.sendFile(path.join(publicDir, 'index.html'));
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log('==========================================================');
    console.log(` Smart Society Management System Express Server Started!`);
    console.log(` Server listening at: http://localhost:${PORT}/`);
    console.log(` Access Role Dashboards at http://localhost:${PORT}/index.html`);
    console.log('==========================================================');
  });
}

module.exports = app;

