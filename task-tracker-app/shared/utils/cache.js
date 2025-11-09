/**
 * Redis Caching Utility
 * Provides helpers for caching frequently accessed data
 */

const Redis = require('ioredis');
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

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: redisPassword || process.env.REDIS_PASSWORD,
  db: process.env.REDIS_CACHE_DB || 1, // Use separate DB for caching
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3
};

// Create Redis client
let redisClient = null;

try {
  redisClient = new Redis(redisConfig);
  
  redisClient.on('connect', () => {
    console.log('✅ Redis cache client connected');
  });

  redisClient.on('error', (err) => {
    console.error('❌ Redis cache client error:', err);
  });
} catch (error) {
  console.error('❌ Failed to create Redis client:', error);
}

/**
 * Cache TTL (Time To Live) configurations in seconds
 */
const CACHE_TTL = {
  GROUPING: 10,            // 10 seconds - grouping results
  STATISTICS: 10,          // 10 seconds - SubProject/Project statistics  
  SUBPROJECT_LIST: 10,     // 10 seconds - SubProject list
  ELEMENTS_LIST: 10,       // 10 seconds - Elements list
  AVAILABLE_FIELDS: 10,    // 10 seconds - Available grouping fields
  SHORT: 10,               // 10 seconds - Short-lived cache
  MEDIUM: 30,              // 30 seconds - Medium duration cache
  LONG: 180                // 3 minutes - Long-lived cache
};

/**
 * Generate cache key with prefix and parameters
 */
function generateCacheKey(prefix, params) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('|');
  return `${prefix}:${sortedParams}`;
}

/**
 * Get data from cache
 */
async function get(key) {
  if (!redisClient) {
    console.warn('Redis client not available, skipping cache get');
    return null;
  }

  try {
    const data = await redisClient.get(key);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

/**
 * Set data in cache with TTL
 */
async function set(key, value, ttl = CACHE_TTL.SHORT) {
  if (!redisClient) {
    console.warn('Redis client not available, skipping cache set');
    return false;
  }

  try {
    await redisClient.setex(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Cache set error:', error);
    return false;
  }
}

/**
 * Delete specific cache key
 */
async function del(key) {
  if (!redisClient) return false;

  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error('Cache delete error:', error);
    return false;
  }
}

/**
 * Delete cache keys matching pattern
 */
async function delPattern(pattern) {
  if (!redisClient) return false;

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
      console.log(`Deleted ${keys.length} cache keys matching: ${pattern}`);
    }
    return true;
  } catch (error) {
    console.error('Cache delete pattern error:', error);
    return false;
  }
}

/**
 * Invalidate all caches related to a SubProject
 */
async function invalidateSubProject(subProjectId) {
  const patterns = [
    `grouping:*subProjectId:${subProjectId}*`,
    `statistics:subproject:${subProjectId}`,
    `elements:*subProjectId:${subProjectId}*`,
    `subproject:${subProjectId}`
  ];

  for (const pattern of patterns) {
    await delPattern(pattern);
  }
}

/**
 * Invalidate all caches related to a Project
 */
async function invalidateProject(projectId) {
  const patterns = [
    `grouping:*projectId:${projectId}*`,
    `statistics:project:${projectId}`,
    `subprojects:project:${projectId}*`,
    `elements:*projectId:${projectId}*`
  ];

  for (const pattern of patterns) {
    await delPattern(pattern);
  }
}

/**
 * Cache wrapper function - get from cache or execute function and cache result
 */
async function cacheWrapper(key, ttl, fetchFunction) {
  // Try to get from cache first
  const cached = await get(key);
  if (cached !== null) {
    console.log(`Cache HIT: ${key}`);
    return cached;
  }

  console.log(`Cache MISS: ${key}`);
  
  // Execute fetch function
  const result = await fetchFunction();
  
  // Cache the result
  await set(key, result, ttl);
  
  return result;
}

/**
 * Get cache statistics
 */
async function getStats() {
  if (!redisClient) return { available: false };

  try {
    const info = await redisClient.info('stats');
    const keyspace = await redisClient.info('keyspace');
    const memory = await redisClient.info('memory');

    return {
      available: true,
      info,
      keyspace,
      memory
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return { available: false, error: error.message };
  }
}

/**
 * Flush all cache (use with caution!)
 */
async function flushAll() {
  if (!redisClient) return false;

  try {
    await redisClient.flushdb();
    console.log('✅ Cache flushed successfully');
    return true;
  } catch (error) {
    console.error('Error flushing cache:', error);
    return false;
  }
}

/**
 * Set no-cache headers on response to prevent browser caching
 * Use this for mutation endpoints (POST, PUT, DELETE)
 * @param {Object} res - Express response object
 */
function setNoCacheHeaders(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

module.exports = {
  client: redisClient,
  CACHE_TTL,
  generateCacheKey,
  get,
  set,
  del,
  delPattern,
  invalidateSubProject,
  invalidateProject,
  cacheWrapper,
  getStats,
  flushAll,
  setNoCacheHeaders
};
