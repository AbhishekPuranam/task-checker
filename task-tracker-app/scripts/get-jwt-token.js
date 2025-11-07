#!/usr/bin/env node

/**
 * Get JWT token from the API for use in Uptime Kuma monitors
 */

const https = require('https');

async function getJWTToken() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      username: 'admin',
      password: 'admin123'
    });

    const options = {
      hostname: 'projects.sapcindia.com',
      port: 443,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.token) {
            console.log('✅ JWT Token obtained successfully!');
            console.log('\nToken:', response.token);
            console.log('\nAdd this to Uptime Kuma monitor headers:');
            console.log(`Authorization: Bearer ${response.token}`);
            resolve(response.token);
          } else {
            reject(new Error('No token in response'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

getJWTToken()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
