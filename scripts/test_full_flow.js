const http = require('http');

function post(path, body, headers = {}) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = http.request({
      host: 'localhost',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      }
    }, (res) => {
      let bodyData = '';
      res.on('data', chunk => bodyData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(bodyData) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: bodyData });
        }
      });
    });
    req.on('error', err => resolve({ error: err.message }));
    req.write(data);
    req.end();
  });
}

function get(path, headers = {}) {
  return new Promise((resolve) => {
    http.get({
      host: 'localhost',
      port: 3000,
      path: path,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }, (res) => {
      let bodyData = '';
      res.on('data', chunk => bodyData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(bodyData) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: bodyData });
        }
      });
    }).on('error', err => resolve({ error: err.message }));
  });
}

async function run() {
  console.log('1. Testing POST /api/contact...');
  const contactRes = await post('/api/contact', {
    name: 'Vikram Mehta',
    societyName: 'Silver Oak Heights',
    email: 'vikram@silveroak.com',
    phone: '+91 98765 43210',
    message: 'We are evaluating Leonex for our 240-unit society in Mumbai.'
  });
  console.log('Contact response:', contactRes);

  console.log('\n2. Testing POST /api/subscribe...');
  const subRes = await post('/api/subscribe', {
    email: 'secretary@silveroak.com'
  });
  console.log('Subscribe response:', subRes);

  console.log('\n3. Testing Super Admin Login with King / K!ngpr@ful....');
  const loginRes = await post('/api/super-admin/auth/login', {
    username: 'King',
    password: 'K!ngpr@ful.'
  });
  console.log('Login response:', loginRes.status, loginRes.data?.success, 'User:', loginRes.data?.user);

  if (!loginRes.data?.token) {
    console.error('Failed to get token!');
    return;
  }
  const token = loginRes.data.token;
  const authHeaders = { 'Authorization': `Bearer ${token}` };

  console.log('\n4. Testing Super Admin GET /api/super-admin/contacts...');
  const contactsList = await get('/api/super-admin/contacts', authHeaders);
  console.log('Contacts status:', contactsList.status, 'Count:', contactsList.data?.count);
  console.log('Latest contact:', contactsList.data?.contacts?.[contactsList.data.contacts.length - 1]);

  console.log('\n5. Testing Super Admin GET /api/super-admin/subscribers...');
  const subsList = await get('/api/super-admin/subscribers', authHeaders);
  console.log('Subscribers status:', subsList.status, 'Count:', subsList.data?.count);
  console.log('Latest subscriber:', subsList.data?.subscribers?.[subsList.data.subscribers.length - 1]);
}

run();
