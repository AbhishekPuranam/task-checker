/**
 * Fix Stuck Upload Sessions
 * 
 * This script identifies and fixes upload sessions that are stuck in "in_progress" status
 * with no recent activity. It marks them as "failed" so they don't clutter the UI.
 * 
 * Usage: node fix-stuck-uploads.js [--minutes=60] [--dry-run] [--specific=uploadId]
 */

const mongoose = require('mongoose');
require('dotenv').config();

const UploadSession = require('../services/backend-api/models/UploadSession');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  minutes: 60, // Default: stuck if no update in last 60 minutes
  dryRun: args.includes('--dry-run'),
  specific: null
};

args.forEach(arg => {
  if (arg.startsWith('--minutes=')) {
    options.minutes = parseInt(arg.split('=')[1]);
  } else if (arg.startsWith('--specific=')) {
    options.specific = arg.split('=')[1];
  }
});

async function fixStuckUploads() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/tasktracker';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Build query
    const query = { status: 'in_progress' };
    
    if (options.specific) {
      query.uploadId = options.specific;
      console.log(`\n🔍 Looking for specific upload: ${options.specific}`);
    } else {
      const cutoffDate = new Date(Date.now() - options.minutes * 60 * 1000);
      query.updatedAt = { $lt: cutoffDate };
      console.log(`\n🔍 Looking for stuck uploads (no update in last ${options.minutes} minutes)`);
    }

    // Find stuck sessions
    const stuckSessions = await UploadSession.find(query);

    if (stuckSessions.length === 0) {
      console.log('✅ No stuck upload sessions found!');
      await mongoose.disconnect();
      return;
    }

    console.log(`\n📋 Found ${stuckSessions.length} stuck upload session(s):\n`);

    // Display stuck sessions
    stuckSessions.forEach((session, index) => {
      console.log(`${index + 1}. Upload ID: ${session.uploadId}`);
      console.log(`   File: ${session.filename}`);
      console.log(`   Status: ${session.status}`);
      console.log(`   Created: ${session.createdAt.toISOString()}`);
      console.log(`   Updated: ${session.updatedAt.toISOString()}`);
      console.log(`   Progress: ${session.summary.successful}/${session.summary.total} batches`);
      console.log(`   Elements: ${session.summary.totalElements} created`);
      console.log('');
    });

    if (options.dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made');
      console.log('Run without --dry-run to actually fix these sessions\n');
      await mongoose.disconnect();
      return;
    }

    // Fix the sessions
    console.log('🔧 Fixing stuck sessions...\n');

    let fixedCount = 0;
    for (const session of stuckSessions) {
      try {
        session.status = 'failed';
        session.completedAt = new Date();
        session.updateSummary(); // Recalculate summary to ensure consistency
        await session.save();
        
        console.log(`✅ Fixed: ${session.uploadId} (${session.filename})`);
        fixedCount++;
      } catch (error) {
        console.error(`❌ Failed to fix ${session.uploadId}:`, error.message);
      }
    }

    console.log(`\n✅ Fixed ${fixedCount} out of ${stuckSessions.length} sessions`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Show usage if help requested
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Fix Stuck Upload Sessions

Usage: node fix-stuck-uploads.js [options]

Options:
  --minutes=N          Consider uploads stuck if not updated in N minutes (default: 60)
  --dry-run           Show what would be fixed without making changes
  --specific=uploadId  Fix a specific upload by ID
  --help, -h          Show this help message

Examples:
  node fix-stuck-uploads.js --dry-run
  node fix-stuck-uploads.js --minutes=30
  node fix-stuck-uploads.js --specific=638828f1-1413-4e9e-9d12-bd153d6ca98c
  `);
  process.exit(0);
}

// Run the fix
fixStuckUploads();
