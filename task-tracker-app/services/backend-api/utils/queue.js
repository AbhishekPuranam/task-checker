const { Queue } = require('bullmq');
const { getRedisClient } = require('./redis');

let excelQueue = null;

/**
 * Get or create the Excel processing queue
 * Uses the same Redis connection as caching
 */
function getExcelQueue() {
  if (excelQueue) {
    return excelQueue;
  }

  const redisClient = getRedisClient();
  
  if (!redisClient) {
    console.warn('⚠️ [QUEUE] Redis not available, queue disabled');
    return null;
  }

  try {
    // BullMQ requires connection options, not client instance
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    excelQueue = new Queue('excel-processing', {
      connection: {
        host: redisUrl.includes('://') ? new URL(redisUrl).hostname : redisUrl,
        port: redisUrl.includes('://') ? parseInt(new URL(redisUrl).port || '6379') : 6379,
      },
      defaultJobOptions: {
        attempts: 3, // Retry up to 3 times
        backoff: {
          type: 'exponential',
          delay: 2000, // Start with 2 second delay
        },
        removeOnComplete: {
          count: 100, // Keep last 100 completed jobs
          age: 24 * 3600, // Keep for 24 hours
        },
        removeOnFail: {
          count: 200, // Keep last 200 failed jobs
          age: 7 * 24 * 3600, // Keep for 7 days
        },
      },
    });

    console.log('✅ [QUEUE] Excel processing queue initialized');
    return excelQueue;
  } catch (error) {
    console.error('❌ [QUEUE] Failed to initialize queue:', error.message);
    return null;
  }
}

/**
 * Add Excel processing job to queue
 * @param {Object} jobData - Job data including file path, project info, etc.
 * @returns {Promise<Object>} Job instance
 */
async function addExcelJob(jobData) {
  const queue = getExcelQueue();
  
  if (!queue) {
    throw new Error('Queue not available');
  }

  try {
    const job = await queue.add('process-excel', jobData, {
      priority: jobData.priority || 1, // Lower number = higher priority
    });

    console.log(`📋 [QUEUE] Added Excel job ${job.id}`);
    return job;
  } catch (error) {
    console.error('❌ [QUEUE] Failed to add job:', error.message);
    throw error;
  }
}

/**
 * Get job status and progress
 * @param {string} jobId - Job ID
 * @returns {Promise<Object>} Job status
 */
async function getJobStatus(jobId) {
  const queue = getExcelQueue();
  
  if (!queue) {
    throw new Error('Queue not available');
  }

  try {
    const job = await queue.getJob(jobId);
    
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress;
    const returnValue = job.returnvalue;
    const failedReason = job.failedReason;

    return {
      id: job.id,
      state, // 'waiting', 'active', 'completed', 'failed', 'delayed'
      progress,
      data: job.data,
      result: returnValue,
      error: failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  } catch (error) {
    console.error('❌ [QUEUE] Failed to get job status:', error.message);
    throw error;
  }
}

/**
 * Close queue connection gracefully
 */
async function closeQueue() {
  if (excelQueue) {
    try {
      await excelQueue.close();
      console.log('✅ [QUEUE] Queue closed gracefully');
    } catch (error) {
      console.error('❌ [QUEUE] Error closing queue:', error.message);
    }
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await closeQueue();
});

module.exports = {
  getExcelQueue,
  addExcelJob,
  getJobStatus,
  closeQueue,
};
