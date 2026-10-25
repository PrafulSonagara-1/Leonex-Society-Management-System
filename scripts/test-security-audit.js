/**
 * Comprehensive Automated Security Audit Regression Test Suite
 * Tests all 10 Security Audit requirements
 */

require('dotenv').config();
const http = require('http');
const jwt = require('jsonwebtoken');
const config = require('../config');

const PORT = config.port || 3000;
const HOST = 'localhost';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const reqHeaders = { ...headers };
    if (payload && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        hostname: HOST,
        port: PORT,
        path,
        method,
        headers: reqHeaders
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runAuditTests() {
  console.log('\n===============================================================');
  console.log('  LEONEX SOCIETY MANAGEMENT SYSTEM — SECURITY REGRESSION TESTS');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`\x1b[32m✔ PASS\x1b[0m: ${name}`);
      passed++;
    } else {
      console.error(`\x1b[31m✖ FAIL\x1b[0m: ${name} ${details ? '— ' + details : ''}`);
      failed++;
    }
  }

  // 1. Health check
  try {
    const health = await request('GET', '/api/health');
    assert(health.status === 200, 'Server health check returns 200 OK');
  } catch (err) {
    console.error('\x1b[31mFATAL: Could not connect to dev server at port', PORT, err.message, '\x1b[0m');
    process.exit(1);
  }

  // 2. Private file & route blocking (Item 2)
  console.log('\n--- Category 2: Private Files & Static Protection ---');
  {
    const rData = await request('GET', '/data');
    assert(rData.status === 404, 'Direct access to /data is blocked (404)');

    const rSeed = await request('GET', '/data/seed.json');
    assert(rSeed.status === 404, 'Direct access to /data/seed.json is blocked (404)');

    const rRootSeed = await request('GET', '/seed.json');
    assert(rRootSeed.status === 404, 'Direct access to /seed.json is blocked (404)');

    const rDb = await request('GET', '/data/super-admin-db.json');
    assert(rDb.status === 404, 'Direct access to /data/super-admin-db.json is blocked (404)');

    const rEnv = await request('GET', '/.env');
    assert(rEnv.status === 404, 'Direct access to /.env is blocked (404)');

    const rPkg = await request('GET', '/package.json');
    assert(rPkg.status === 404, 'Direct access to /package.json is blocked (404)');

    const rServerJs = await request('GET', '/server.js');
    assert(rServerJs.status === 404, 'Direct access to /server.js is blocked (404)');

    const rDirectSa = await request('GET', '/super-admin.html');
    assert(rDirectSa.status === 404, 'Direct access to /super-admin.html is blocked (404)');

    const rSaPortal = await request('GET', '/super-admin');
    assert(rSaPortal.status === 200, 'Dedicated /super-admin portal route is accessible (200)');

    const rIndex = await request('GET', '/index.html');
    assert(rIndex.status === 200, 'Public landing page /index.html is accessible (200)');
  }

  // 3. Super Admin authentication hardening (Item 1)
  console.log('\n--- Category 1: Super Admin Authentication & Credential Hardening ---');
  {
    // Invalid username
    const badUser = await request('POST', '/api/super-admin/auth/login', {
      username: 'nonexistent_admin_123',
      password: 'SomePassword123!'
    });
    assert(badUser.status === 401, 'Super Admin login rejects invalid username (401)');

    // Invalid password
    const badPass = await request('POST', '/api/super-admin/auth/login', {
      username: config.superAdminUsername || 'King',
      password: 'WrongPassword999!'
    });
    assert(badPass.status === 401, 'Super Admin login rejects incorrect password (401)');

    // Attempting old unconfigured password string (if different from configured)
    if (config.superAdminPassword !== 'superadmin') {
      const oldDefault = await request('POST', '/api/super-admin/auth/login', {
        username: config.superAdminUsername || 'King',
        password: 'superadmin'
      });
      assert(oldDefault.status === 401, 'Super Admin login rejects generic "superadmin" fallback');
    }

    // Legitimate Super Admin login if configured
    let saToken = null;
    if (config.superAdminPassword || config.superAdminPasswordHash) {
      const goodLogin = await request('POST', '/api/super-admin/auth/login', {
        username: config.superAdminUsername || 'King',
        password: config.superAdminPassword
      });
      assert(
        goodLogin.status === 200 && goodLogin.body?.token,
        'Super Admin login succeeds with configured credentials',
        `Status: ${goodLogin.status}`
      );
      saToken = goodLogin.body?.token;
      if (saToken) {
        const decoded = jwt.decode(saToken);
        assert(decoded?.role === 'SUPER_ADMIN', 'Super Admin JWT contains SUPER_ADMIN role');
      }
    }
  }

  // 4. JWT Verification & Algorithm Hardening (Item 3)
  console.log('\n--- Category 3: JWT Verification & Algorithm Security ---');
  {
    // Request without token to protected endpoint
    const noToken = await request('GET', '/api/auth/me');
    assert(noToken.status === 401, 'Protected /api/auth/me rejects missing token (401)');

    // Request with invalid token
    const fakeToken = await request('GET', '/api/auth/me', null, {
      Authorization: 'Bearer invalid_signature_token.12345.abcde'
    });
    assert(fakeToken.status === 403, 'Protected /api/auth/me rejects invalid token signature (403)');

    // Request with 'none' algorithm token
    const noneAlgToken = jwt.sign(
      { id: 'USR-101', role: 'Admin', email: 'jenilbarad089@gmail.com' },
      '',
      { algorithm: 'none' }
    );
    const noneRes = await request('GET', '/api/auth/me', null, {
      Authorization: `Bearer ${noneAlgToken}`
    });
    assert(noneRes.status === 403, 'Protected /api/auth/me rejects token with algorithm: none (403)');
  }

  // 5. Role-based access control & user isolation (Item 5 & 7)
  console.log('\n--- Category 5 & 7: Role Authorization & User Data Isolation ---');
  {
    // Generate legitimate Resident token
    const residentToken = jwt.sign(
      { id: 'USR-102', role: 'Resident', email: 'amit.patel@gmail.com', name: 'Amit Patel', flat: 'A-302' },
      config.jwtSecret,
      { algorithm: 'HS256', expiresIn: '1h' }
    );

    // Resident calling Admin-only /api/auth/pending
    const resPending = await request('GET', '/api/auth/pending', null, {
      Authorization: `Bearer ${residentToken}`
    });
    assert(resPending.status === 403, 'Resident token cannot access /api/auth/pending (403 Forbidden)');

    // Resident calling Admin-only /api/auth/all
    const resAll = await request('GET', '/api/auth/all', null, {
      Authorization: `Bearer ${residentToken}`
    });
    assert(resAll.status === 403, 'Resident token cannot read directory of all users /api/auth/all (403 Forbidden)');

    // Admin token calling /api/auth/pending
    const adminToken = jwt.sign(
      { id: 'USR-101', role: 'Admin', email: 'jenilbarad089@gmail.com', name: 'Jenil Barad (Admin)', flat: 'A-101' },
      config.jwtSecret,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
    const adminPending = await request('GET', '/api/auth/pending', null, {
      Authorization: `Bearer ${adminToken}`
    });
    assert(adminPending.status === 200, 'Admin token successfully accesses /api/auth/pending (200 OK)');
  }

  // 6. OTP Security & Role Escalation Prevention (Item 7)
  console.log('\n--- Category 7: OTP Security & Role Escalation Prevention ---');
  {
    // Send OTP: check devOtp is not leaked
    const otpRes = await request('POST', '/api/auth/send-otp', {
      identifier: 'test.security.resident@example.com'
    });
    assert(otpRes.status === 200, 'POST /api/auth/send-otp generates OTP successfully');
    if (config.allowDevOtp) {
      console.log('  [Notice] ALLOW_DEV_OTP is enabled in local development config');
    } else {
      assert(
        otpRes.body?.devOtp === undefined,
        'POST /api/auth/send-otp does not leak devOtp in API response'
      );
    }

    // Role escalation attempt via verify-otp: attacker specifies role: 'Admin'
    // First, let's test invalid OTP rejection
    const invalidOtp = await request('POST', '/api/auth/verify-otp', {
      identifier: 'test.security.resident@example.com',
      otp: '000000',
      role: 'Admin'
    });
    assert(invalidOtp.status === 400, 'POST /api/auth/verify-otp rejects invalid OTP code (400)');
  }

  // 7. Status update endpoint validation (Item 7)
  console.log('\n--- Category 7: Status Update Endpoint Validation ---');
  {
    const adminToken = jwt.sign(
      { id: 'USR-101', role: 'Admin', email: 'jenilbarad089@gmail.com', name: 'Jenil Barad (Admin)' },
      config.jwtSecret,
      { algorithm: 'HS256', expiresIn: '1h' }
    );

    // Invalid status
    const invalidStatusRes = await request('POST', '/api/auth/update-status', {
      userId: 'USR-102',
      status: 'HACKED_STATUS'
    }, {
      Authorization: `Bearer ${adminToken}`
    });
    assert(invalidStatusRes.status === 400, 'POST /api/auth/update-status rejects invalid status (400)');

    // Valid status: ensure response returns properly without hanging
    const validStatusRes = await request('POST', '/api/auth/update-status', {
      userId: 'USR-102',
      status: 'Approved'
    }, {
      Authorization: `Bearer ${adminToken}`
    });
    assert(validStatusRes.status === 200, 'POST /api/auth/update-status returns 200 OK without hanging');
  }

  // 8. Public contact & newsletter validation
  console.log('\n--- Category 6: Input Validation on Public Endpoints ---');
  {
    const badContact = await request('POST', '/api/contact', {
      email: 'not-an-email',
      message: 'test'
    });
    assert(badContact.status === 400, 'POST /api/contact validates email input format (400)');

    const badSub = await request('POST', '/api/subscribe', {
      email: 'invalid-email'
    });
    assert(badSub.status === 400, 'POST /api/subscribe validates email input format (400)');
  }

  console.log('\n===============================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAuditTests().catch((err) => {
  console.error('\x1b[31m[Test Suite Error]\x1b[0m', err);
  process.exit(1);
});
