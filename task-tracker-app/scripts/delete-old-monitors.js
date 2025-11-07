#!/usr/bin/env node

const io = require('socket.io-client');

const UPTIME_KUMA_URL = 'http://62.72.56.99:3001';
const USERNAME = 'admin';
const PASSWORD = 'Admin@SAPCIndia2025';
const MONITOR_IDS_TO_DELETE = [7, 8, 9, 10, 11, 12, 13, 14];

async function deleteMonitors() {
  return new Promise((resolve, reject) => {
    const socket = io(UPTIME_KUMA_URL, { reconnection: false, timeout: 10000 });

    socket.on('connect', () => {
      socket.emit('login', { username: USERNAME, password: PASSWORD, token: '' }, (response) => {
        if (!response.ok) {
          socket.disconnect();
          reject(new Error('Login failed'));
          return;
        }
        
        let monitorIndex = 0;
        
        const deleteNextMonitor = () => {
          if (monitorIndex >= MONITOR_IDS_TO_DELETE.length) {
            console.log('✅ All old monitors deleted');
            socket.disconnect();
            resolve();
            return;
          }
          
          const monitorId = MONITOR_IDS_TO_DELETE[monitorIndex];
          socket.emit('deleteMonitor', monitorId, (response) => {
            if (response.ok) console.log(`✅ Deleted monitor ID: ${monitorId}`);
            monitorIndex++;
            setTimeout(deleteNextMonitor, 300);
          });
        };
        
        deleteNextMonitor();
      });
    });

    socket.on('connect_error', reject);
  });
}

deleteMonitors().then(() => process.exit(0)).catch((error) => { console.error(error.message); process.exit(1); });
