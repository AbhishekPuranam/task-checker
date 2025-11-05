#!/usr/bin/env node

/**
 * Manually trigger progress calculation for a project
 * Usage: node scripts/trigger-progress.js <projectId>
 */

const { addProgressJob } = require('../services/backend-api/utils/queue');

async function triggerProgress(projectId) {
  if (!projectId) {
    console.error('❌ Please provide a project ID');
    console.log('Usage: node scripts/trigger-progress.js <projectId>');
    process.exit(1);
  }

  console.log(`📊 Triggering progress calculation for project: ${projectId}`);
  
  try {
    const job = await addProgressJob(projectId);
    
    if (job) {
      console.log(`✅ Progress calculation job queued successfully`);
      console.log(`   Job ID: ${job.id}`);
    } else {
      console.log('⚠️ Job may not have been queued (check logs)');
    }
    
    // Wait a bit for the job to be processed
    console.log('⏳ Waiting for job to complete...');
    
    setTimeout(() => {
      console.log('✅ Done! Check the progress in your application.');
      process.exit(0);
    }, 5000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Get project ID from command line
const projectId = process.argv[2];
triggerProgress(projectId);
