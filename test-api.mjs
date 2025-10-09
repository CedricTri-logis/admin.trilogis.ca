// Test the lease discrepancies API
import http from 'http';

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/lease-discrepancies',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 5000
};

console.log('Testing API endpoint:', `http://${options.hostname}:${options.port}${options.path}`);

const req = http.request(options, (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);

  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response body:', data);
    try {
      const json = JSON.parse(data);
      console.log('Parsed JSON:', JSON.stringify(json, null, 2));
    } catch (e) {
      console.error('Failed to parse JSON:', e.message);
    }
  });
});

req.on('timeout', () => {
  console.error('Request timed out after 5 seconds');
  req.destroy();
});

req.on('error', (error) => {
  console.error('Request error:', error.message);
});

req.end();
