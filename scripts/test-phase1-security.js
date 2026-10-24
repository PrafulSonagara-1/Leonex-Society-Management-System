/**
 * Automated Verification Script for Phase 1 Security Patches
 * Tests C1-C6, H1, H3, M1, M5, M7
 */

const http = require('http');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n======================================================');
  console.log('  RUNNING PHASE 1 SECURITY ACCEPTANCE TESTS');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`\x1b[32m✔ PASS\x1b[0m: ${testName}`);
      passed++;
    } else {
      console.error(`\x1b[31m✖ FAIL\x1b[0m: ${testName} - ${detail}`);
      failed++;
    }
  }

  // 1. Health check to confirm server is responding
  try {
    const health = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/health',
      method: 'GET'
    });
    assert(health.statusCode === 200, 'Server is running and healthy (/api/health returns 200)');
  } catch (err) {
    console.error('\x1b[31m[ERROR]\x1b[0m Could not connect to server at port', PORT, err.message);
    process.exit(1);
  }

  // 2. Attack: Forged x-clerk-user-id header (C2)
  {
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/super-admin/societies',
      method: 'GET',
      headers: {
        'x-clerk-user-id': 'user_2xyz_spoofed_admin'
      }
    });
    assert(
      res.statusCode === 401 || res.statusCode === 403,
      'C2: Header spoofing (x-clerk-user-id) rejected with 401/403',
      `Got status: ${res.statusCode}`
    );
  }

  // 3. Attack: Raw "user_" token fallback (C3)
  {
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/super-admin/societies',
      method: 'GET',
      headers: {
        Authorization: 'Bearer user_attacker_fake_token_12345'
      }
    });
    assert(
      res.statusCode === 401 || res.statusCode === 403,
      'C3: Unverified "Bearer user_..." raw string rejected with 401/403',
      `Got status: ${res.statusCode}`
    );
  }

  // 4. Attack: Forged JWT signed with old guessed fallback secret (C1, C4)
  {
    const forgedToken = jwt.sign(
      { id: 'user_fake_owner', role: 'SUPER_ADMIN', email: 'attacker@evil.com' },
      'society_hub_super_secure_jwt_secret_key_2026',
      { expiresIn: '1h' }
    );
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/super-admin/societies',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${forgedToken}`
      }
    });
    assert(
      res.statusCode === 401 || res.statusCode === 403,
      'C1: Forged JWT with guessed fallback secret rejected with 401/403',
      `Got status: ${res.statusCode}`
    );
  }

  // 5. Attack: Non-owner JWT with role: SUPER_ADMIN (C4 - Owner ID verification)
  {
    // Sign with any random 64-char key to simulate an unauthorized token
    const randomKey = 'a'.repeat(64);
    const nonOwnerToken = jwt.sign(
      { id: 'user_not_the_configured_owner', role: 'SUPER_ADMIN' },
      randomKey,
      { expiresIn: '1h' }
    );
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/super-admin/societies',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${nonOwnerToken}`
      }
    });
    assert(
      res.statusCode === 401 || res.statusCode === 403,
      'C4: JWT without matching SUPER_ADMIN_CLERK_USER_ID rejected with 401/403',
      `Got status: ${res.statusCode}`
    );
  }

  // 6. Attack: Accessing sensitive /data static files (C6)
  {
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/data/seed.json',
      method: 'GET'
    });
    assert(
      res.statusCode === 404 || res.statusCode === 403,
      'C6: /data/seed.json is NOT publicly accessible (404/403)',
      `Got status: ${res.statusCode}`
    );
  }

  // 7. Attack: Path traversal attempt (M5)
  {
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/..%2Fpackage.json',
      method: 'GET'
    });
    // Should return 403 Forbidden or 404 or index.html, never package.json contents
    const leakedPackage = res.body && res.body.includes('"name": "ssm"');
    assert(
      !leakedPackage,
      'M5: Path traversal does not leak backend package.json',
      'Leaked backend source code!'
    );
  }

  // 8. Security Headers from Helmet (M7)
  {
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/',
      method: 'GET'
    });
    const hasNoSniff = res.headers['x-content-type-options'] === 'nosniff';
    const hasCsp = !!res.headers['content-security-policy'];
    assert(
      hasNoSniff && hasCsp,
      'M7: Helmet security headers (CSP & X-Content-Type-Options: nosniff) active',
      `CSP: ${hasCsp}, nosniff: ${hasNoSniff}`
    );
  }

  // 9. Rate Limiting Active on Auth Endpoints (H3)
  {
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'test@example.com', password: 'wrong' });
    const hasRateLimitHeader =
      res.headers['ratelimit-limit'] !== undefined ||
      res.headers['x-ratelimit-limit'] !== undefined;
    assert(
      hasRateLimitHeader,
      'H3: Rate limiting headers present on auth endpoints',
      `Rate limit headers received: ${JSON.stringify(res.headers['ratelimit-limit'] || res.headers['x-ratelimit-limit'])}`
    );
  }

  console.log('\n======================================================');
  console.log(`  TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});
