#!/usr/bin/env node

/**
 * Fix Uptime Kuma Monitors
 * 
 * This script deletes all existing monitors and recreates them with fixed configuration
 */

const { UptimeKumaClient, MONITORS } = require('./configure-uptime-monitors');

const UPTIME_KUMA_URL = 'http://62.72.56.99:3001';
const USERNAME = 'admin';
const PASSWORD = 'Coreinme@789';

async function deleteMonitor(client, monitorId) {
  return new Promise((resolve, reject) => {
    console.log(`🗑️  Deleting monitor ID: ${monitorId}...`);
    
    client.socket.emit('deleteMonitor', monitorId, (response) => {
      if (response.ok) {
        console.log(`✅ Monitor deleted: ID ${monitorId}`);
        resolve(response);
      } else {
        console.error(`❌ Failed to delete monitor ${monitorId}:`, response.msg);
        reject(new Error(response.msg));
      }
    });

    setTimeout(() => {
      reject(new Error(`Timeout deleting monitor: ${monitorId}`));
    }, 10000);
  });
}

async function main() {
  const client = new UptimeKumaClient(UPTIME_KUMA_URL);
  
  try {
    // Connect and login
    await client.connect();
    await client.login(USERNAME, PASSWORD);
    
    // Get all existing monitors
    const existingMonitors = await client.getMonitors();
    const monitorIds = Object.keys(existingMonitors);
    
    console.log(`\n🗑️  Deleting ${monitorIds.length} existing monitors...\n`);
    
    // Delete all monitors
    for (const monitorId of monitorIds) {
      try {
        await deleteMonitor(client, parseInt(monitorId));
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`❌ Error deleting monitor ${monitorId}:`, error.message);
      }
    }
    
    console.log('\n✅ All monitors deleted. Waiting 2 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Recreate monitors with fixed configuration
    console.log('📊 Creating fixed monitors...\n');
    
    let successCount = 0;
    let failCount = 0;
    
    for (const monitor of MONITORS) {
      try {
        await client.addMonitor(monitor);
        successCount++;
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Error creating ${monitor.name}:`, error.message);
        failCount++;
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`✅ Successfully created: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📝 Total monitors: ${MONITORS.length}`);
    
    console.log('\n🎉 Monitor fix complete!');
    console.log(`\n🌐 Check status at: ${UPTIME_KUMA_URL}`);
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    client.disconnect();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}
