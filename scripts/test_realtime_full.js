const http = require('http');

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTest() {
  console.log('--- STARTING REAL-TIME VERIFICATION TEST ---');

  // 1. Connect to SSE Stream
  console.log('1. Connecting to SSE stream at /api/realtime/stream...');
  const sseEvents = [];
  const sseReq = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/realtime/stream',
    method: 'GET'
  }, res => {
    res.on('data', chunk => {
      const text = chunk.toString();
      sseEvents.push(text);
      console.log('  [SSE Chunk Received]:', text.trim());
    });
  });
  sseReq.on('error', err => console.error('SSE Error:', err));
  sseReq.end();

  // Wait 500ms for SSE connection
  await new Promise(r => setTimeout(r, 600));

  // 2. Submit Contact Inquiry with Gmail
  const testContactEmail = `praful_contact_${Date.now()}@gmail.com`;
  console.log(`\n2. Submitting Contact Inquiry with email: ${testContactEmail}...`);
  const contactRes = await request('POST', '/api/contact', {
    name: 'Praful Realtime',
    societyName: 'Galaxy Heights',
    email: testContactEmail,
    phone: '+91 99887 76655',
    message: 'We want 24/7 gate security and automated billing for 300 flats.'
  });
  console.log('Contact response status:', contactRes.status, contactRes.data?.success ? 'SUCCESS' : 'FAILED');

  // 3. Subscribe with Gmail
  const testSubscribeEmail = `praful_subscriber_${Date.now()}@gmail.com`;
  console.log(`\n3. Submitting Newsletter Subscription with email: ${testSubscribeEmail}...`);
  const subRes = await request('POST', '/api/subscribe', {
    email: testSubscribeEmail
  });
  console.log('Subscribe response status:', subRes.status, subRes.data?.success ? 'SUCCESS' : 'FAILED');

  // Wait 800ms for SSE events to be received
  await new Promise(r => setTimeout(r, 800));

  // Close SSE stream
  sseReq.destroy();

  // 4. Verify SSE captured both events
  const allSseText = sseEvents.join('\n');
  const hasContactInSse = allSseText.includes(testContactEmail);
  const hasSubInSse = allSseText.includes(testSubscribeEmail);
  console.log(`\n4. SSE Event Verification:`);
  console.log(`  - Contact event received over SSE: ${hasContactInSse ? 'YES (PASSED)' : 'NO (FAILED)'}`);
  console.log(`  - Subscriber event received over SSE: ${hasSubInSse ? 'YES (PASSED)' : 'NO (FAILED)'}`);

  // 5. Verify /api/realtime/snapshot
  console.log(`\n5. Checking /api/realtime/snapshot...`);
  const snapshotRes = await request('GET', '/api/realtime/snapshot');
  const contactsInSnap = snapshotRes.data?.contacts || [];
  const subsInSnap = snapshotRes.data?.subscribers || [];
  const contactFoundInSnap = contactsInSnap.some(c => c.email === testContactEmail);
  const subFoundInSnap = subsInSnap.some(s => s.email === testSubscribeEmail);
  console.log(`  - Contact in snapshot: ${contactFoundInSnap ? 'YES (PASSED)' : 'NO (FAILED)'}`);
  console.log(`  - Subscriber in snapshot: ${subFoundInSnap ? 'YES (PASSED)' : 'NO (FAILED)'}`);

  // 6. Login as Super Admin and fetch protected tables
  console.log(`\n6. Authenticating Super Admin King...`);
  const loginRes = await request('POST', '/api/super-admin/auth/login', {
    username: 'King',
    password: 'K!ngpr@ful.'
  });
  const token = loginRes.data?.token;
  console.log(`  - Super Admin Login: ${loginRes.status === 200 && token ? 'SUCCESS' : 'FAILED'}`);

  // 7. Get contacts as Super Admin
  const authHeaders = { 'Authorization': `Bearer ${token}` };
  const getContactsRes = await request('GET', '/api/super-admin/contacts', null, authHeaders);
  const adminContacts = getContactsRes.data?.contacts || [];
  const adminFoundContact = adminContacts.some(c => c.email === testContactEmail);
  console.log(`  - Super Admin sees new Contact ${testContactEmail}: ${adminFoundContact ? 'YES (PASSED)' : 'NO (FAILED)'}`);

  // 8. Get subscribers as Super Admin
  const getSubsRes = await request('GET', '/api/super-admin/subscribers', null, authHeaders);
  const adminSubs = getSubsRes.data?.subscribers || [];
  const adminFoundSub = adminSubs.some(s => s.email === testSubscribeEmail);
  console.log(`  - Super Admin sees new Subscriber ${testSubscribeEmail}: ${adminFoundSub ? 'YES (PASSED)' : 'NO (FAILED)'}`);

  if (hasContactInSse && hasSubInSse && contactFoundInSnap && subFoundInSnap && adminFoundContact && adminFoundSub) {
    console.log('\n>>> ALL REAL-TIME VERIFICATION TESTS PASSED SUCCESSFULLY! <<<');
  } else {
    console.error('\n>>> SOME TESTS FAILED! <<<');
  }
}

runTest().catch(console.error);
