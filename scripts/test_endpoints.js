const http = require('http');

function checkUrl(path) {
  return new Promise((resolve) => {
    http.get({
      host: 'localhost',
      port: 3000,
      path: path
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', (err) => resolve({ error: err.message }));
  });
}

async function run() {
  console.log('Testing endpoints...');
  const resHtml = await checkUrl('/super-admin.html');
  console.log('GET /super-admin.html => Status:', resHtml.status);

  const resRoute = await checkUrl('/super-admin');
  console.log('GET /super-admin => Status:', resRoute.status, 'HTML Length:', resRoute.data ? resRoute.data.length : 0);

  const resIndex = await checkUrl('/index.html');
  console.log('GET /index.html => Status:', resIndex.status);
}

run();
