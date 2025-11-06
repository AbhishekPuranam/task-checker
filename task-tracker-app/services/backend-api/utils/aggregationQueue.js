const { Queue } = require('bullmq');
const fs = require('fs');

// Read Redis password from secret if available
let redisPassword;
try {
  if (fs.existsSync('/run/secrets/redis_password')) {
    redisPassword = fs.readFileSync('/run/secrets/redis_password', 'utf8').trim();
  }
} catch (error) {
  console.warn('⚠️  Could not read Redis password from secret, using env var');
}

// Redis connection for BullMQ
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: redisPassword || process.env.REDIS_PASSWORD,
  db: process.env.REDIS_DB || 0
};

// Create aggregation queue
const aggregationQueue = new Queue('aggregation-queue', { connection });

/**
 * Schedule SubProject statistics recalculation
 * @param {String} subProjectId - SubProject ID
 * @param {Number} delay - Delay in milliseconds (default: 0)
 */
async function scheduleSubProjectAggregation(subProjectId, delay = 0) {
  try {
    const job = await aggregationQueue.add(
      'calculate-subproject',
      { type: 'subproject', subProjectId },
      {
        delay,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 100
        },
        removeOnFail: {
          age: 86400 // Keep failed jobs for 24 hours
        }
      }
    );
    
    console.log(`[Aggregation Queue] Scheduled SubProject aggregation job ${job.id} for ${subProjectId}`);
    return job;
  } catch (error) {
    console.error('[Aggregation Queue] Error scheduling SubProject aggregation:', error);
    throw error;
  }
}

/**
 * Schedule Project statistics recalculation
 * @param {String} projectId - Project ID
 * @param {Number} delay - Delay in milliseconds (default: 0)
 */
async function scheduleProjectAggregation(projectId, delay = 0) {
  try {
    const job = await aggregationQueue.add(
      'calculate-project',
      { type: 'project', projectId },
      {
        delay,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: {
          age: 3600,
          count: 100
        },
        removeOnFail: {
          age: 86400
        }
      }
    );
    
    console.log(`[Aggregation Queue] Scheduled Project aggregation job ${job.id} for ${projectId}`);
    return job;
  } catch (error) {
    console.error('[Aggregation Queue] Error scheduling Project aggregation:', error);
    throw error;
  }
}

/**
 * Schedule aggregation after a batch of elements is created/updated
 * Uses a delay to debounce multiple rapid updates
 * @param {String} subProjectId - SubProject ID
 */
async function scheduleBatchAggregation(subProjectId) {
  return scheduleSubProjectAggregation(subProjectId, 5000); // 5 second delay for debouncing
}

module.exports = {
  aggregationQueue,
  scheduleSubProjectAggregation,
  scheduleProjectAggregation,
  scheduleBatchAggregation
};
