require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const authRoutes = require('./auth-routes');
const superAdminRoutes = require('./super-admin-routes');
const { clerkMiddleware } = require('@clerk/express');

const db = require('./mysql');

// Initialize database
db.init().catch(err => console.warn('[DB Init Warning]', err.message));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(clerkMiddleware());

// Super Admin API routes (Strictly protected by Clerk authentication & SUPER_ADMIN_CLERK_USER_ID)
app.use('/api/super-admin', superAdminRoutes);

// Auth API routes (must be before static file middleware)
app.use('/api/auth', authRoutes);

// Health check API
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Smart Society Management System API active' });
});

// Dedicated private route for Super Admin Portal
app.get(['/super-admin', '/super-admin/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'super-admin.html'));
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

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(path.join(__dirname, 'data')));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  const filePath = path.join(__dirname, 'public', req.path);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.sendFile(filePath);
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log('==========================================================');
  console.log(` Smart Society Management System Express Server Started!`);
  console.log(` Server listening at: http://localhost:${PORT}/`);
  console.log(` Access Role Dashboards at http://localhost:${PORT}/index.html`);
  console.log('==========================================================');
});
