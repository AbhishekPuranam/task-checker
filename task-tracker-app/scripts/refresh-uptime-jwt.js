#!/usr/bin/env node

/**
 * Update Uptime Kuma API monitors with fresh JWT token
 * This script:
 * 1. Gets a fresh JWT token from the API
 * 2. Updates all API monitors with the new token in the Authorization header
 * 3. Should be run via cron every 10 hours to keep tokens fresh
 */

const io = require('socket.io-client');
const https = require('https');

const UPTIME_KUMA_URL = process.env.UPTIME_KUMA_URL || 'http://localhost:3001';
const UPTIME_KUMA_USER = process.env.UPTIME_KUMA_USER || 'admin';
const UPTIME_KUMA_PASS = process.env.UPTIME_KUMA_PASS || 'Admin@SAPCIndia2025';

const API_URL = process.env.API_URL || 'projects.sapcindia.com';
const API_USER = process.env.API_USER || 'admin';
const API_PASS = process.env.API_PASS || 'admin123';

// List of monitor names that need JWT token updates
const JWT_REQUIRED_MONITORS = [
  'API - Tasks',
  'API - Users',
  'API - Projects',
  'API - Jobs',
  'API - Structural Elements',
  'API - Reports',
  'API - Excel',
  'API - SubProjects'
];

/**
 * Get fresh JWT token from the API
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

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.token) {
            resolve(response.token);
          } else {
            reject(new Error('No token in API response'));
          }
        } catch (error) {
          reject(new Error(`Failed to parse API response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`API request failed: ${error.message}`));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Update Uptime Kuma monitors with new JWT token
 */
async function updateMonitorsWithToken(jwtToken) {
  return new Promise((resolve, reject) => {
    console.log('Connecting to Uptime Kuma...');
    const socket = io(UPTIME_KUMA_URL, {
      reconnection: false,
      timeout: 10000
    });

    socket.on('connect', () => {
      console.log('✅ Connected to Uptime Kuma');
      
      // Login to Uptime Kuma
      socket.emit('login', {
        username: UPTIME_KUMA_USER,
        password: UPTIME_KUMA_PASS,
        token: ''
      }, (response) => {
        if (!response.ok) {
          socket.disconnect();
          reject(new Error(`Uptime Kuma login failed: ${response.msg}`));
          return;
        }
        
        console.log('✅ Logged into Uptime Kuma');
        
        // Get list of all monitors
        socket.emit('getMonitorList', (response) => {
          if (!response.ok) {
            socket.disconnect();
            reject(new Error('Failed to get monitor list'));
            return;
          }
          
          const monitors = Object.values(response);
          const monitorsToUpdate = monitors.filter(m => 
            JWT_REQUIRED_MONITORS.includes(m.name)
          );
          
          console.log(`\nFound ${monitorsToUpdate.length} monitors to update`);
          
          if (monitorsToUpdate.length === 0) {
            console.log('No monitors need updating');
            socket.disconnect();
            resolve();
            return;
          }
          
          let updateIndex = 0;
          
          const updateNextMonitor = () => {
            if (updateIndex >= monitorsToUpdate.length) {
              console.log('\n✅ All monitors updated successfully!');
              socket.disconnect();
              resolve();
              return;
            }
            
            const monitor = monitorsToUpdate[updateIndex];
            
            // Update monitor with new JWT token in headers
            const updatedMonitor = {
              ...monitor,
              headers: JSON.stringify({
                Authorization: `Bearer ${jwtToken}`
              })
            };
            
            console.log(`Updating: ${monitor.name}...`);
            
            socket.emit('save', updatedMonitor, (response) => {
              if (response.ok) {
                console.log(`  ✅ Updated: ${monitor.name}`);
              } else {
                console.error(`  ❌ Failed: ${monitor.name} - ${response.msg}`);
              }
              
              updateIndex++;
              setTimeout(updateNextMonitor, 500);
            });
          };
          
          updateNextMonitor();
        });
      });
    });

    socket.on('connect_error', (error) => {
      reject(new Error(`Connection failed: ${error.message}`));
    });

    socket.on('error', (error) => {
      reject(new Error(`Socket error: ${error.message}`));
    });
  });
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('=== Uptime Kuma JWT Token Refresh ===\n');
    console.log(`Timestamp: ${new Date().toISOString()}\n`);
    
    // Step 1: Get fresh JWT token
    console.log('Step 1: Getting fresh JWT token from API...');
    const jwtToken = await getJWTToken();
    console.log('✅ JWT token obtained\n');
    
    // Step 2: Update monitors
    console.log('Step 2: Updating Uptime Kuma monitors...');
    await updateMonitorsWithToken(jwtToken);
    
    console.log('\n=== Token refresh completed successfully ===');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
