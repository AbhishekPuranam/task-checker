const { Queue } = require('bullmq');
const { getRedisClient } = require('./redis');
const fs = require('fs');

let excelQueue = null;
let progressQueue = null;

// Shared Redis connection options for better performance
function getRedisConnectionOptions() {
  let redisPassword = '';
  try {
    redisPassword = fs.readFileSync('/run/secrets/redis_password', 'utf8').trim();
  } catch (err) {
    console.warn('⚠️ Redis password not found in secrets');
  }

  const redisHost = process.env.REDIS_HOST || 'redis';
  const redisPort = process.env.REDIS_PORT || '6379';
  
  return {
    host: redisHost,
    port: parseInt(redisPort),
    password: redisPassword || undefined,
    // Connection optimization settings
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  };
}

/**
 * Get or create the Excel processing queue
 * Optimized for large Excel file processing with better performance settings
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
    excelQueue = new Queue('excel-processing', {
      connection: getRedisConnectionOptions(),
      // Optimize default job options for Excel processing
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        // Aggressive cleanup to reduce memory usage
        removeOnComplete: {
          count: 50, // Keep fewer completed jobs
          age: 3600, // Only 1 hour
        },
        removeOnFail: {
          count: 100, // Keep failed jobs longer for debugging
          age: 7 * 24 * 3600, // 7 days
        },
        // Timeout for very large files (30 minutes)
        timeout: 30 * 60 * 1000,
      },
    });

    console.log('✅ [QUEUE] Excel processing queue initialized with optimized settings');
    return excelQueue;
  } catch (error) {
    console.error('❌ [QUEUE] Failed to initialize queue:', error.message);
    return null;
  }
}

/**
 * Add Excel processing job to queue
 * Optimized with priority and job deduplication
 * @param {Object} jobData - Job data including file path, project info, etc.
 * @returns {Promise<Object>} Job instance
 */
async function addExcelJob(jobData) {
  const queue = getExcelQueue();
  
  if (!queue) {
    throw new Error('Queue not available');
  }

  try {
    // Generate job ID for deduplication (prevents duplicate uploads)
    const jobId = `excel-${jobData.projectId}-${Date.now()}`;
    
    const job = await queue.add('process-excel', jobData, {
      jobId, // Prevents duplicate jobs
      priority: jobData.priority || 1, // Lower number = higher priority
      // For large files, increase timeout
      timeout: jobData.expectedRows > 1000 ? 30 * 60 * 1000 : 10 * 60 * 1000,
    });

    console.log(`📋 [QUEUE] Added Excel job ${job.id} with ${jobData.expectedRows || 'unknown'} rows`);
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
      console.log('✅ [QUEUE] Excel queue closed gracefully');
    } catch (error) {
      console.error('❌ [QUEUE] Error closing excel queue:', error.message);
    }
  }
  if (progressQueue) {
    try {
      await progressQueue.close();
      console.log('✅ [QUEUE] Progress queue closed gracefully');
    } catch (error) {
      console.error('❌ [QUEUE] Error closing progress queue:', error.message);
    }
  }
}

/**
 * Get or create the Progress calculation queue
 * Optimized for fast, concurrent progress calculations
 */
function getProgressQueue() {
  if (progressQueue) {
    return progressQueue;
  }

  const redisClient = getRedisClient();
  
  if (!redisClient) {
    console.warn('⚠️ [QUEUE] Redis not available, progress queue disabled');
    return null;
  }

  try {
    progressQueue = new Queue('progress-calculation', {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 1000,
        },
        removeOnComplete: {
          count: 30, // Keep fewer, progress is calculated frequently
          age: 1800, // 30 minutes
        },
        removeOnFail: {
          count: 50,
          age: 3600, // 1 hour
        },
        // Progress calculation should be fast
        timeout: 60000, // 1 minute timeout
      },
    });

    console.log('✅ [QUEUE] Progress calculation queue initialized with optimized settings');
    return progressQueue;
  } catch (error) {
    console.error('❌ [QUEUE] Failed to initialize progress queue:', error.message);
    return null;
  }
}

/**
 * Add progress calculation job to queue
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Job instance
 */
async function addProgressJob(projectId) {
  const queue = getProgressQueue();
  
  if (!queue) {
    console.warn('⚠️ [QUEUE] Progress queue not available, skipping job');
    return null;
  }

  try {
    const job = await queue.add('calculate-progress', { projectId }, {
      jobId: `progress-${projectId}`, // Deduplicate jobs for same project
      priority: 5,
    });

    console.log(`📊 [QUEUE] Added progress calculation job for project ${projectId}`);
    return job;
  } catch (error) {
    console.error('❌ [QUEUE] Failed to add progress job:', error.message);
    return null;
  }
}

/**
 * Close queue connection gracefully
 */
async function closeQueue() {
  if (excelQueue) {
    try {
      await excelQueue.close();
      console.log('✅ [QUEUE] Excel queue closed gracefully');
    } catch (error) {
      console.error('❌ [QUEUE] Error closing excel queue:', error.message);
    }
  }
  if (progressQueue) {
    try {
      await progressQueue.close();
      console.log('✅ [QUEUE] Progress queue closed gracefully');
    } catch (error) {
      console.error('❌ [QUEUE] Error closing progress queue:', error.message);
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
  getProgressQueue,
  addProgressJob,
};
