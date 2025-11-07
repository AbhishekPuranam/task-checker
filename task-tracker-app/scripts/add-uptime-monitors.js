#!/usr/bin/env node

/**
 * Add API endpoint monitors to Uptime Kuma with JWT authentication
 * Uses socket.io to communicate with Uptime Kuma backend
 */

const io = require('socket.io-client');
const https = require('https');

const UPTIME_KUMA_URL = 'http://62.72.56.99:3001';
const USERNAME = 'admin';
const PASSWORD = 'Admin@SAPCIndia2025';

const API_URL = 'projects.sapcindia.com';
const API_USER = 'admin';
const API_PASS = 'admin123';

/**
 * Get JWT token from the API
 */
async function getJWTToken() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      username: API_USER,
      password: API_PASS
    });

    const options = {
      hostname: API_URL,
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
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.token) {
            resolve(response.token);
          } else {
            reject(new Error('No token in response'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Monitors to add (will be populated with JWT token)
function getMonitors(jwtToken) {
  return [
    {
      name: 'API - Tasks',
      type: 'http',
      url: 'https://projects.sapcindia.com/api/tasks',
      interval: 60,
      maxretries: 0,
      method: 'GET',
      accepted_statuscodes: ['200-299'],
      headers: JSON.stringify({
        Authorization: `Bearer ${jwtToken}`
      })
    },
    {
      name: 'API - Users',
      type: 'http',
      url: 'https://projects.sapcindia.com/api/users',
      interval: 60,
      maxretries: 0,
      method: 'GET',
      accepted_statuscodes: ['200-299'],
      headers: JSON.stringify({
        Authorization: `Bearer ${jwtToken}`
      })
    },
    {
      name: 'API - Projects',
      type: 'http',
      url: 'https://projects.sapcindia.com/api/projects',
      interval: 60,
      maxretries: 0,
      method: 'GET',
      accepted_statuscodes: ['200-299'],
      headers: JSON.stringify({
        Authorization: `Bearer ${jwtToken}`
      })
    },
    {
      name: 'API - Jobs',
      type: 'http',
      url: 'https://projects.sapcindia.com/api/jobs',
      interval: 60,
      maxretries: 0,
      method: 'GET',
      accepted_statuscodes: ['200-299'],
      headers: JSON.stringify({
        Authorization: `Bearer ${jwtToken}`
      })
    },
    {
      name: 'API - Structural Elements',
      type: 'http',
      url: 'https://projects.sapcindia.com/api/structural-elements',
      interval: 60,
      maxretries: 0,
      method: 'GET',
      accepted_statuscodes: ['200-299'],
      headers: JSON.stringify({
        Authorization: `Bearer ${jwtToken}`
      })
    },
    {
      name: 'API - Reports',
      type: 'http',
      url: 'https://projects.sapcindia.com/api/reports',
      interval: 60,
      maxretries: 0,
      method: 'GET',
      accepted_statuscodes: ['200-299'],
      headers: JSON.stringify({
        Authorization: `Bearer ${jwtToken}`
      })
    },
    {
      name: 'API - Excel',
      type: 'http',
      url: 'https://projects.sapcindia.com/api/excel',
      interval: 60,
      maxretries: 0,
      method: 'GET',
      accepted_statuscodes: ['200-299'],
      headers: JSON.stringify({
        Authorization: `Bearer ${jwtToken}`
      })
    },
    {
      name: 'API - SubProjects',
      type: 'http',
      url: 'https://projects.sapcindia.com/api/subprojects',
      interval: 60,
      maxretries: 0,
      method: 'GET',
      accepted_statuscodes: ['200-299'],
      headers: JSON.stringify({
        Authorization: `Bearer ${jwtToken}`
      })
    }
  ];
}

async function addMonitors() {
  try {
    // First, get JWT token
    console.log('Getting JWT token from API...');
    const jwtToken = await getJWTToken();
    console.log('✅ JWT token obtained\n');
    
    const MONITORS = getMonitors(jwtToken);
    
    return new Promise((resolve, reject) => {
      console.log('Connecting to Uptime Kuma...');
      const socket = io(UPTIME_KUMA_URL, {
        reconnection: false,
        timeout: 10000
      });

      socket.on('connect', () => {
        console.log('Connected to Uptime Kuma');
        
        // Login first
        console.log('Logging in...');
        socket.emit('login', {
          username: USERNAME,
          password: PASSWORD,
          token: ''
        }, (response) => {
          if (!response.ok) {
            console.error('Login failed:', response.msg);
            socket.disconnect();
            reject(new Error('Login failed'));
            return;
          }
          
          console.log('Logged in successfully');
          
          // Add monitors one by one
          let monitorIndex = 0;
          
          const addNextMonitor = () => {
            if (monitorIndex >= MONITORS.length) {
              console.log('\n✅ All monitors added successfully!');
              console.log('\nNote: JWT token expires in 24 hours.');
              console.log('Run the refresh-uptime-jwt.js script or set up a cron job to keep tokens fresh.');
              socket.disconnect();
              resolve();
              return;
            }
            
            const monitor = MONITORS[monitorIndex];
            console.log(`\nAdding monitor: ${monitor.name}...`);
            
            socket.emit('add', monitor, (response) => {
              if (response.ok) {
                console.log(`✅ Added: ${monitor.name} (ID: ${response.monitorID})`);
              } else {
                console.error(`❌ Failed to add ${monitor.name}:`, response.msg);
              }
              
              monitorIndex++;
              setTimeout(addNextMonitor, 500); // Small delay between requests
            });
          };
          
          addNextMonitor();
        });
      });

      socket.on('connect_error', (error) => {
        console.error('Connection error:', error.message);
        reject(error);
      });

      socket.on('error', (error) => {
        console.error('Socket error:', error);
        reject(error);
      });
    });
  } catch (error) {
    console.error('Error getting JWT token:', error.message);
    throw error;
  }
}

// Run the script
addMonitors()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nError:', error.message);
    process.exit(1);
  });
