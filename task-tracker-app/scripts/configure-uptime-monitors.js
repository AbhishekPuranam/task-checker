#!/usr/bin/env node

/**
 * Configure Uptime Kuma monitors for Task Tracker application
 * 
 * This script creates monitors for:
 * - MongoDB health
 * - Redis health
 * - BullMQ queues health
 * - API endpoints (projects, subprojects, elements, users)
 * - Overall application health
 */

const axios = require('axios');

// Configuration
const UPTIME_KUMA_URL = process.env.UPTIME_KUMA_URL || 'http://62.72.56.99:3001';
const UPTIME_KUMA_USERNAME = process.env.UPTIME_KUMA_USERNAME || 'admin';
const UPTIME_KUMA_PASSWORD = process.env.UPTIME_KUMA_PASSWORD || 'Coreinme@789';
const API_BASE_URL = process.env.API_BASE_URL || 'http://tasktracker-app:5000';

// Monitor definitions
const monitors = [
  {
    name: 'Task Tracker - Overall Health',
    type: 'http',
    url: `${API_BASE_URL}/health/detailed`,
    interval: 60, // Check every minute
    maxretries: 3,
    retryInterval: 60,
    description: 'Overall application health including all dependencies',
    method: 'GET',
    timeout: 10,
    expectedStatusCodes: ['200']
  },
  {
    name: 'Task Tracker - MongoDB',
    type: 'http',
    url: `${API_BASE_URL}/health/mongodb`,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: 'MongoDB database connectivity and performance',
    method: 'GET',
    timeout: 10,
    expectedStatusCodes: ['200']
  },
  {
    name: 'Task Tracker - Redis Cache',
    type: 'http',
    url: `${API_BASE_URL}/health/redis`,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: 'Redis cache connectivity and memory usage',
    method: 'GET',
    timeout: 10,
    expectedStatusCodes: ['200']
  },
  {
    name: 'Task Tracker - BullMQ Queues',
    type: 'http',
    url: `${API_BASE_URL}/health/queues`,
    interval: 120, // Check every 2 minutes
    maxretries: 2,
    retryInterval: 60,
    description: 'Background job queues (Excel processing, progress calculation)',
    method: 'GET',
    timeout: 15,
    expectedStatusCodes: ['200']
  },
  {
    name: 'Task Tracker - API Endpoints',
    type: 'http',
    url: `${API_BASE_URL}/health/api`,
    interval: 120,
    maxretries: 2,
    retryInterval: 60,
    description: 'Core API functionality (projects, subprojects, elements, users)',
    method: 'GET',
    timeout: 15,
    expectedStatusCodes: ['200']
  },
  {
    name: 'Task Tracker - Projects API',
    type: 'http',
    url: `${API_BASE_URL}/api/projects`,
    interval: 300, // Check every 5 minutes
    maxretries: 2,
    retryInterval: 60,
    description: 'Projects API endpoint availability',
    method: 'GET',
    timeout: 10,
    expectedStatusCodes: ['200', '401'] // May be auth-protected
  },
  {
    name: 'Task Tracker - Admin Portal',
    type: 'http',
    url: 'http://62.72.56.99:3000',
    interval: 120,
    maxretries: 2,
    retryInterval: 60,
    description: 'Admin portal web interface availability',
    method: 'GET',
    timeout: 10,
    expectedStatusCodes: ['200']
  }
];

// Helper function to login to Uptime Kuma
async function login() {
  console.log('⏳ Logging into Uptime Kuma...');
  
  try {
    // Note: Uptime Kuma uses Socket.IO for auth, not REST API
    // We'll need to use their API endpoints if available
    console.log('⚠️  Uptime Kuma requires manual monitor setup or Socket.IO integration');
    console.log('📝 Please create monitors manually using the configuration below:\n');
    return null;
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    return null;
  }
}

// Print monitor configuration for manual setup
function printMonitorConfig() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('       UPTIME KUMA MONITOR CONFIGURATION');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`Uptime Kuma URL: ${UPTIME_KUMA_URL}`);
  console.log(`Username: ${UPTIME_KUMA_USERNAME}`);
  console.log(`Password: ${UPTIME_KUMA_PASSWORD}\n`);
  
  monitors.forEach((monitor, index) => {
    console.log(`\n${index + 1}. ${monitor.name}`);
    console.log('─'.repeat(60));
    console.log(`   Type: ${monitor.type.toUpperCase()}`);
    console.log(`   URL: ${monitor.url}`);
    console.log(`   Method: ${monitor.method}`);
    console.log(`   Interval: ${monitor.interval} seconds`);
    console.log(`   Timeout: ${monitor.timeout} seconds`);
    console.log(`   Max Retries: ${monitor.maxretries}`);
    console.log(`   Retry Interval: ${monitor.retryInterval} seconds`);
    console.log(`   Expected Status: ${monitor.expectedStatusCodes.join(', ')}`);
    console.log(`   Description: ${monitor.description}`);
  });
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('\n📋 MANUAL SETUP INSTRUCTIONS:');
  console.log('─'.repeat(60));
  console.log('1. Open Uptime Kuma: http://62.72.56.99:3001');
  console.log('2. Login with admin/Coreinme@789');
  console.log('3. Click "Add New Monitor" for each configuration above');
  console.log('4. Copy the settings from each monitor definition');
  console.log('5. Save and activate each monitor\n');
  
  console.log('🔔 RECOMMENDED NOTIFICATION SETTINGS:');
  console.log('─'.repeat(60));
  console.log('- Enable notifications for downtime > 2 minutes');
  console.log('- Set up email/Slack/Discord notifications');
  console.log('- Configure escalation for critical services (MongoDB, Redis)');
  console.log('- Use different notification channels for different severity\n');
  
  console.log('📊 MONITORING STRATEGY:');
  console.log('─'.repeat(60));
  console.log('✓ Overall Health (1 min) - Quick overview, immediate alerts');
  console.log('✓ MongoDB (1 min) - Critical dependency, fast detection');
  console.log('✓ Redis (1 min) - Critical dependency, fast detection');
  console.log('✓ BullMQ (2 min) - Job queue health, moderate frequency');
  console.log('✓ API Endpoints (2 min) - Core functionality checks');
  console.log('✓ Projects API (5 min) - Feature availability sampling');
  console.log('✓ Admin Portal (2 min) - User-facing interface\n');
}

// Export configuration as JSON for programmatic use
function exportConfig() {
  const config = {
    uptimeKuma: {
      url: UPTIME_KUMA_URL,
      username: UPTIME_KUMA_USERNAME
    },
    apiBaseUrl: API_BASE_URL,
    monitors: monitors
  };
  
  console.log('\n📄 JSON Configuration (for automation):');
  console.log('─'.repeat(60));
  console.log(JSON.stringify(config, null, 2));
  console.log('\n');
}

// Main execution
async function main() {
  console.log('\n🚀 Uptime Kuma Monitor Configuration Tool\n');
  
  // Try to connect (currently will fallback to manual config)
  await login();
  
  // Print manual configuration
  printMonitorConfig();
  
  // Export JSON config
  if (process.argv.includes('--json')) {
    exportConfig();
  }
  
  console.log('✅ Configuration guide generated successfully!\n');
  console.log('💡 TIP: Run with --json flag to export configuration as JSON\n');
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { monitors };
