#!/usr/bin/env node

/**
 * Uptime Kuma Docker Container Monitor Configuration Script
 * 
 * This script creates comprehensive monitoring for all Docker containers
 * using the Uptime Kuma API with Docker type monitors.
 * 
 * Usage:
 *   node configure-uptime-docker-monitors.js
 * 
 * Prerequisites:
 *   - Uptime Kuma running at http://62.72.56.99:3001
 *   - Username: admin
 *   - Password: Coreinme@789
 *   - Uptime Kuma container must have access to Docker socket
 */

const io = require('socket.io-client');

const UPTIME_KUMA_URL = 'http://62.72.56.99:3001';
const USERNAME = 'admin';
const PASSWORD = 'Coreinme@789';

// Docker Container Monitors Configuration
const DOCKER_MONITORS = [
  // Infrastructure Services
  {
    name: '🐳 Vault Container',
    type: 'docker',
    docker_container: 'tasktracker-vault',
    docker_host: 1, // Will be set after getting Docker host ID
    interval: 60,
    description: 'HashiCorp Vault container health'
  },
  {
    name: '🐳 MongoDB Container',
    type: 'docker',
    docker_container: 'tasktracker-mongodb',
    docker_host: 1,
    interval: 60,
    description: 'MongoDB database container'
  },
  {
    name: '🐳 Redis Container',
    type: 'docker',
    docker_container: 'tasktracker-redis',
    docker_host: 1,
    interval: 60,
    description: 'Redis cache and queue container'
  },
  
  // Microservices
  {
    name: '🐳 Auth Service Container',
    type: 'docker',
    docker_container: 'tasktracker-auth-service',
    docker_host: 1,
    interval: 60,
    description: 'Authentication service container'
  },
  {
    name: '🐳 Excel Service Container',
    type: 'docker',
    docker_container: 'tasktracker-excel-service',
    docker_host: 1,
    interval: 60,
    description: 'Excel processing service container'
  },
  {
    name: '🐳 Project Service Container',
    type: 'docker',
    docker_container: 'tasktracker-project-service',
    docker_host: 1,
    interval: 60,
    description: 'Project management service container'
  },
  {
    name: '🐳 SubProject Service Container',
    type: 'docker',
    docker_container: 'tasktracker-subproject-service',
    docker_host: 1,
    interval: 60,
    description: 'SubProject management service container'
  },
  {
    name: '🐳 Metrics Service Container',
    type: 'docker',
    docker_container: 'tasktracker-metrics-service',
    docker_host: 1,
    interval: 60,
    description: 'Metrics and reports service container'
  },
  {
    name: '🐳 Traefik Container',
    type: 'docker',
    docker_container: 'tasktracker-traefik',
    docker_host: 1,
    interval: 60,
    description: 'Traefik reverse proxy container'
  },
  {
    name: '🐳 Uptime Kuma Container',
    type: 'docker',
    docker_container: 'uptime-kuma',
    docker_host: 1,
    interval: 60,
    description: 'Uptime Kuma monitoring container (self-monitor)'
  }
];

// Scaled services - these don't have fixed container names
const SCALED_SERVICES = [
  {
    name: '🐳 Structural Elements Services (Scaled)',
    type: 'docker',
    docker_container: '/tasktracker_structural-elements-service',
    docker_host: 1,
    interval: 60,
    description: 'Structural elements service replicas (monitors first instance)'
  },
  {
    name: '🐳 Jobs Services (Scaled)',
    type: 'docker',
    docker_container: '/tasktracker_jobs-service',
    docker_host: 1,
    interval: 60,
    description: 'Jobs service replicas (monitors first instance)'
  },
  {
    name: '🐳 Admin Portal (Scaled)',
    type: 'docker',
    docker_container: '/tasktracker_tasktracker-admin',
    docker_host: 1,
    interval: 60,
    description: 'Admin UI replicas (monitors first instance)'
  },
  {
    name: '🐳 Engineer Portal (Scaled)',
    type: 'docker',
    docker_container: '/tasktracker_tasktracker-engineer',
    docker_host: 1,
    interval: 60,
    description: 'Engineer UI replicas (monitors first instance)'
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

      setTimeout(() => {
        reject(new Error('Login timeout'));
      }, 5000);
    });
  }

  async getDockerHosts() {
    return new Promise((resolve, reject) => {
      console.log('🐋 Fetching Docker hosts...');
      
      this.socket.emit('getDockerHosts', (response) => {
        if (response.ok) {
          console.log(`✅ Found ${response.dockerHosts.length} Docker host(s)`);
          resolve(response.dockerHosts);
        } else {
          console.error('❌ Failed to fetch Docker hosts:', response.msg);
          reject(new Error(response.msg));
        }
      });

      setTimeout(() => {
        reject(new Error('Timeout fetching Docker hosts'));
      }, 5000);
    });
  }

  async addDockerHost(name, dockerDaemon) {
    return new Promise((resolve, reject) => {
      console.log(`🐋 Adding Docker host: ${name}...`);
      
      const dockerHost = {
        name: name,
        dockerDaemon: dockerDaemon,
        dockerType: 'socket'
      };

      this.socket.emit('addDockerHost', dockerHost, (response) => {
        if (response.ok) {
          console.log(`✅ Docker host added: ${name} (ID: ${response.id})`);
          resolve(response);
        } else {
          console.error(`❌ Failed to add Docker host:`, response.msg);
          reject(new Error(response.msg));
        }
      });

      setTimeout(() => {
        reject(new Error('Timeout adding Docker host'));
      }, 5000);
    });
  }

  async addMonitor(monitorConfig) {
    return new Promise((resolve, reject) => {
      const monitor = {
        type: monitorConfig.type || 'docker',
        name: monitorConfig.name,
        docker_container: monitorConfig.docker_container,
        docker_host: monitorConfig.docker_host,
        interval: monitorConfig.interval || 60,
        maxretries: 3,
        retryInterval: 60,
        resendInterval: 0,
        notificationIDList: {},
        description: monitorConfig.description || ''
      };

      console.log(`📝 Creating Docker monitor: ${monitor.name}...`);

      this.socket.emit('add', monitor, (response) => {
        if (response.ok) {
          console.log(`✅ Monitor created: ${monitor.name} (ID: ${response.monitorID})`);
          resolve(response);
        } else {
          console.error(`❌ Failed to create monitor ${monitor.name}:`, response.msg);
          reject(new Error(response.msg));
        }
      });

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
    
    // Get or create Docker host
    console.log('\n🐋 Setting up Docker host connection...\n');
    let dockerHosts = await client.getDockerHosts();
    let dockerHostId;
    
    if (dockerHosts.length === 0) {
      console.log('No Docker hosts found, adding local Docker socket...');
      const result = await client.addDockerHost('Local Docker', '/var/run/docker.sock');
      dockerHostId = result.id;
    } else {
      dockerHostId = dockerHosts[0].id;
      console.log(`Using existing Docker host: ${dockerHosts[0].name} (ID: ${dockerHostId})`);
    }
    
    // Update all monitor configurations with the correct Docker host ID
    const allMonitors = [...DOCKER_MONITORS, ...SCALED_SERVICES];
    allMonitors.forEach(monitor => {
      monitor.docker_host = dockerHostId;
    });
    
    // Get existing monitors
    const existingMonitors = await client.getMonitors();
    const existingNames = Object.values(existingMonitors).map(m => m.name);
    
    console.log('\n📊 Starting Docker container monitor creation...\n');
    
    // Create monitors
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    
    for (const monitor of allMonitors) {
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
    console.log(`📝 Total Docker monitors: ${allMonitors.length}`);
    
    console.log('\n🎉 Docker container monitor configuration complete!');
    console.log(`\n🌐 Access Uptime Kuma at: ${UPTIME_KUMA_URL}`);
    console.log(`   Username: ${USERNAME}`);
    console.log(`   Password: ${PASSWORD}`);
    
    console.log('\n📝 Note: For scaled services (structural-elements, jobs, admin, engineer),');
    console.log('   monitors track the first replica. All replicas share the same base name.');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    
    if (error.message.includes('Docker')) {
      console.log('\n💡 Troubleshooting Docker monitoring:');
      console.log('   1. Ensure Uptime Kuma container has Docker socket mounted');
      console.log('   2. Check if Docker socket permissions allow Uptime Kuma to access it');
      console.log('   3. Verify docker-compose.yml has: -/var/run/docker.sock:/var/run/docker.sock:ro');
    }
    
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

module.exports = { UptimeKumaClient, DOCKER_MONITORS, SCALED_SERVICES };
