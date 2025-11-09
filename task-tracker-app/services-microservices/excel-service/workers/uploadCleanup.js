const cron = require('node-cron');
const UploadSession = require('../models/UploadSession');

/**
 * Cleanup stalled upload sessions
 * 
 * An upload is considered stalled if:
 * 1. Status is 'in_progress'
 * 2. No batch updates in the last 2 minutes
 * 3. Has at least one batch that started processing
 */
async function cleanupStalledUploads() {
  try {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    
    // Find uploads that are in progress but haven't been updated recently
    const stalledSessions = await UploadSession.find({
      status: 'in_progress',
      updatedAt: { $lt: twoMinutesAgo }
    });

    if (stalledSessions.length === 0) {
      console.log('🧹 [CLEANUP] No stalled upload sessions found');
      return { cleaned: 0 };
    }

    console.log(`🧹 [CLEANUP] Found ${stalledSessions.length} potentially stalled session(s)`);

    let cleanedCount = 0;

    for (const session of stalledSessions) {
      try {
        // Check if any batch is actually in progress or if all are pending
        const hasStartedProcessing = session.batches.some(
          b => b.status === 'success' || b.status === 'failed'
        );

        // If no batches have been processed and it's been more than 2 minutes, mark as failed
        if (!hasStartedProcessing) {
          console.log(`🧹 [CLEANUP] Session ${session.uploadId} - no batches processed, marking as failed`);
          session.status = 'failed';
          session.completedAt = new Date();
          session.updateSummary();
          await session.save();
          cleanedCount++;
          continue;
        }

        // Check if there are pending batches but no recent updates
        const hasPendingBatches = session.batches.some(b => b.status === 'pending');
        
        if (hasPendingBatches) {
          // Worker might have crashed while processing - mark remaining as failed and finalize
          console.log(`🧹 [CLEANUP] Session ${session.uploadId} - worker stalled, finalizing with current results`);
          
          // Mark all pending batches as failed
          session.batches.forEach(batch => {
            if (batch.status === 'pending') {
              batch.status = 'failed';
              batch.errorMessage = 'Worker stalled - batch not processed';
            }
          });
          
          session.updateSummary();
          await session.save();
          cleanedCount++;
          
          console.log(`📊 [CLEANUP] Session ${session.uploadId} finalized: ${session.status} - ${session.summary.successfulBatches}/${session.totalBatches} batches succeeded`);
        } else {
          // All batches processed but status not updated - just recalculate and save
          console.log(`🧹 [CLEANUP] Session ${session.uploadId} - all batches done, updating final status`);
          session.updateSummary();
          await session.save();
          cleanedCount++;
        }

      } catch (error) {
        console.error(`❌ [CLEANUP] Error cleaning session ${session.uploadId}:`, error.message);
      }
    }

    console.log(`✅ [CLEANUP] Cleaned ${cleanedCount} stalled session(s)`);
    return { cleaned: cleanedCount };

  } catch (error) {
    console.error('❌ [CLEANUP] Cleanup job failed:', error);
    return { error: error.message };
  }
}

/**
 * Start the cleanup cron job
 * Runs every minute to check for stalled uploads
 */
function startUploadCleanupJob() {
  console.log('✅ [CLEANUP] Starting upload cleanup cron job (runs every minute)');

  // Run every minute
  cron.schedule('* * * * *', async () => {
    console.log('🧹 [CLEANUP] Running scheduled cleanup check...');
    await cleanupStalledUploads();
  });

  // Also run once immediately on startup
  setTimeout(() => {
    console.log('🧹 [CLEANUP] Running initial cleanup check...');
    cleanupStalledUploads().catch(console.error);
  }, 5000); // Wait 5 seconds after startup
}

module.exports = {
  startUploadCleanupJob,
  cleanupStalledUploads
};
