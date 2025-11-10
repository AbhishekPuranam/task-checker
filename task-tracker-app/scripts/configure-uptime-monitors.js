#!/usr/bin/env node

/**
 * Uptime Kuma Monitor Configuration Script
 * 
 * This script creates comprehensive monitoring for all microservices
 * using the Uptime Kuma API.
 * 
 * Usage:
 *   node configure-uptime-monitors.js
 * 
 * Prerequisites:
 *   - Uptime Kuma running at http://62.72.56.99:3001
 *   - Username: admin
 *   - Password: Coreinme@789
 */

const io = require('socket.io-client');

const UPTIME_KUMA_URL = 'http://62.72.56.99:3001';
const USERNAME = 'admin';
const PASSWORD = 'Coreinme@789';
const BASE_DOMAIN = 'projects.sapcindia.com';

// Monitor configurations
const MONITORS = [
  // Infrastructure Services
  {
    name: '🔒 Vault - Secret Management',
    type: 'http',
    url: 'http://62.72.56.99:8200/v1/sys/health',
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: 'HashiCorp Vault health check',
    accepted_statuscodes: ['200-299', '429', '473']
  },
  {
    name: '🗄️ MongoDB - Database',
    type: 'port',
    hostname: '62.72.56.99',
    port: 27017,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: 'MongoDB replica set health'
  },
  {
    name: '⚡ Redis - Cache & Queue',
    type: 'port',
    hostname: '62.72.56.99',
    port: 6379,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: 'Redis cache and BullMQ'
  },
  
  // Microservices - Backend APIs (Use login page as proxy for auth check)
  {
    name: '🔐 Auth Service',
    type: 'http',
    url: `https://${BASE_DOMAIN}/login`,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: 'Authentication & Authorization service',
    keyword: 'Login'
  },
  {
    name: '📊 Excel Service',
    type: 'http',
    url: `https://${BASE_DOMAIN}/api/excel/health`,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: 'Excel upload & batch processing',
    accepted_statuscodes: ['200-299', '401']
  },
  {
    name: '📁 Project Service',
    type: 'http',
    url: `https://${BASE_DOMAIN}/api/projects`,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: 'Project management service',
    accepted_statuscodes: ['200-299', '401']
  },
  {
    name: '📋 SubProject Service',
    type: 'http',
    url: `https://${BASE_DOMAIN}/api/subprojects`,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: 'SubProject management service',
    accepted_statuscodes: ['200-299', '401']
  },
  {
    name: '🏗️ Structural Elements Service',
    type: 'http',
    url: `https://${BASE_DOMAIN}/api/structural-elements`,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: 'Structural elements service (3 replicas)',
    accepted_statuscodes: ['200-299', '401']
  },
  {
    name: '⚙️ Jobs Service',
    type: 'http',
    url: `https://${BASE_DOMAIN}/api/jobs`,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: 'Jobs management service (3 replicas)',
    accepted_statuscodes: ['200-299', '401']
  },
  {
    name: '📈 Metrics Service',
    type: 'http',
    url: `https://${BASE_DOMAIN}/api/metrics`,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: 'Reports & analytics service',
    accepted_statuscodes: ['200-299', '401', '404']
  },
  
  // Frontend Services
  {
    name: '🖥️ Admin Portal',
    type: 'http',
    url: `https://${BASE_DOMAIN}/admin`,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: 'Admin UI (2 replicas)'
  },
  {
    name: '👷 Engineer Portal',
    type: 'http',
    url: `https://${BASE_DOMAIN}/engineer`,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: 'Engineer UI (2 replicas)'
  },
  
  // Monitoring Services
  {
    name: '🔍 OpenSearch',
    type: 'http',
    url: 'http://62.72.56.99:9200/_cluster/health',
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: 'OpenSearch cluster health',
    accepted_statuscodes: ['200-299', '401']
  },
  {
    name: '📊 OpenSearch Dashboards',
    type: 'http',
    url: 'http://62.72.56.99:5601/api/status',
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: 'OpenSearch Dashboards UI',
    accepted_statuscodes: ['200-299', '302']
  },
  {
    name: '🌐 Traefik Dashboard',
    type: 'http',
    url: 'http://62.72.56.99:8080/dashboard/',
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: 'Traefik reverse proxy dashboard'
  },
  
  // Main Application Endpoints
  {
    name: '🌍 Main Website',
    type: 'http',
    url: `https://${BASE_DOMAIN}`,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: 'Main application landing page'
  },
  {
    name: '🔑 Login Page',
    type: 'http',
    url: `https://${BASE_DOMAIN}/login`,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: 'Login page availability',
    keyword: 'Login'
  }
];

class UptimeKumaClient {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.token = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      console.log('🔌 Connecting to Uptime Kuma...');
      
      this.socket = io(this.url, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      this.socket.on('connect', () => {
        console.log('✅ Connected to Uptime Kuma');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error.message);
        reject(error);
      });

      this.socket.on('disconnect', () => {
        console.log('🔌 Disconnected from Uptime Kuma');
      });

      // Set connection timeout
      setTimeout(() => {
        if (!this.socket.connected) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  async login(username, password) {
    return new Promise((resolve, reject) => {
      console.log('🔐 Logging in...');
      
      this.socket.emit('login', {
        username,
        password,
        token: ''
      }, (response) => {
        if (response.ok) {
          this.token = response.token;
          console.log('✅ Login successful');
          resolve(response);
        } else {
          console.error('❌ Login failed:', response.msg);
          reject(new Error(response.msg));
        }
      });

      // Set login timeout
      setTimeout(() => {
        reject(new Error('Login timeout'));
      }, 5000);
    });
  }

  async addMonitor(monitorConfig) {
    return new Promise((resolve, reject) => {
      const monitor = {
        type: monitorConfig.type || 'http',
        name: monitorConfig.name,
        url: monitorConfig.url,
        hostname: monitorConfig.hostname,
        port: monitorConfig.port,
        interval: monitorConfig.interval || 60,
        maxretries: monitorConfig.maxretries || 3,
        retryInterval: monitorConfig.retryInterval || 60,
        resendInterval: 0,
        ignoreTls: false,
        upsideDown: false,
        maxredirects: 10,
        accepted_statuscodes: ['200-299'],
        dns_resolve_type: 'A',
        dns_resolve_server: '1.1.1.1',
        notificationIDList: {},
        description: monitorConfig.description || '',
        keyword: monitorConfig.keyword || '',
        expiryNotification: false,
        proxyId: null
      };

      console.log(`📝 Creating monitor: ${monitor.name}...`);

      this.socket.emit('add', monitor, (response) => {
        if (response.ok) {
          console.log(`✅ Monitor created: ${monitor.name} (ID: ${response.monitorID})`);
          resolve(response);
        } else {
          console.error(`❌ Failed to create monitor ${monitor.name}:`, response.msg);
          reject(new Error(response.msg));
        }
      });

      // Set timeout for monitor creation
      setTimeout(() => {
        reject(new Error(`Timeout creating monitor: ${monitor.name}`));
      }, 10000);
    });
  }

  async getMonitors() {
    return new Promise((resolve, reject) => {
      console.log('📋 Fetching existing monitors...');
      
      this.socket.emit('getMonitorList', (response) => {
        if (response.ok) {
          const monitorList = response.monitorList || {};
          console.log(`✅ Found ${Object.keys(monitorList).length} existing monitors`);
          resolve(monitorList);
        } else {
          console.error('❌ Failed to fetch monitors:', response.msg);
          reject(new Error(response.msg));
        }
      });

      setTimeout(() => {
        reject(new Error('Timeout fetching monitors'));
      }, 5000);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      console.log('👋 Disconnected from Uptime Kuma');
    }
  }
}

async function main() {
  const client = new UptimeKumaClient(UPTIME_KUMA_URL);
  
  try {
    // Connect to Uptime Kuma
    await client.connect();
    
    // Login
    await client.login(USERNAME, PASSWORD);
    
    // Get existing monitors
    const existingMonitors = await client.getMonitors();
    const existingNames = Object.values(existingMonitors).map(m => m.name);
    
    console.log('\n📊 Starting monitor creation...\n');
    
    // Create monitors
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    
    for (const monitor of MONITORS) {
      try {
        // Check if monitor already exists
        if (existingNames.includes(monitor.name)) {
          console.log(`⏭️  Skipping ${monitor.name} (already exists)`);
          skipCount++;
          continue;
        }
        
        await client.addMonitor(monitor);
        successCount++;
        
        // Small delay between creating monitors
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Error creating ${monitor.name}:`, error.message);
        failCount++;
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`✅ Successfully created: ${successCount}`);
    console.log(`⏭️  Skipped (existing): ${skipCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📝 Total monitors: ${MONITORS.length}`);
    
    console.log('\n🎉 Monitor configuration complete!');
    console.log(`\n🌐 Access Uptime Kuma at: ${UPTIME_KUMA_URL}`);
    console.log(`   Username: ${USERNAME}`);
    console.log(`   Password: ${PASSWORD}`);
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    client.disconnect();
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { UptimeKumaClient, MONITORS };
