const { cache } = require('../utils/redis');

/**
 * Middleware to cache GET requests
 * @param {number} ttl - Time to live in seconds (default: 5 minutes)
 * @param {function} keyGenerator - Function to generate cache key from req
 */
const cacheMiddleware = (ttl = 300, keyGenerator = null) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    try {
      // Generate cache key
      const cacheKey = keyGenerator 
        ? keyGenerator(req) 
        : `cache:${req.originalUrl}:${req.user?.id || 'anon'}`;

      console.log(`[CACHE] Checking cache for key: ${cacheKey}`);

      // Try to get from cache
      const cachedData = await cache.get(cacheKey);
      
      if (cachedData) {
        console.log(`[CACHE] ✅ HIT - Returning cached data for ${cacheKey}`);
        return res.json(cachedData);
      }

      console.log(`[CACHE] ❌ MISS - Fetching fresh data for ${cacheKey}`);

      // Store original res.json
      const originalJson = res.json.bind(res);

      // Override res.json to cache the response
      res.json = (data) => {
        // Cache the response
        cache.set(cacheKey, data, ttl).then(() => {
          console.log(`[CACHE] 💾 Cached data for ${cacheKey} (TTL: ${ttl}s)`);
        }).catch(err => {
          console.error(`[CACHE] Failed to cache data:`, err);
        });

        // Send response
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('[CACHE] Middleware error:', error);
      // Continue without caching on error
      next();
    }
  };
};

/**
 * Invalidate cache for specific patterns
 */
const invalidateCache = async (pattern) => {
  try {
    console.log(`[CACHE] 🗑️  Invalidating cache pattern: ${pattern}`);
    await cache.delPattern(pattern);
    return true;
  } catch (error) {
    console.error('[CACHE] Failed to invalidate cache:', error);
    return false;
  }
};

/**
 * Generate cache key for jobs endpoint
 */
const jobsCacheKeyGenerator = (req) => {
  const { project, status, fireProofingType, search, page = 1, limit = 10 } = req.query;
  const userId = req.user?.id || 'anon';
  
  // Create a deterministic cache key based on query params
  const parts = [
    'jobs',
    `project:${project || 'all'}`,
    `status:${status || 'all'}`,
    `type:${fireProofingType || 'all'}`,
    `search:${search || 'none'}`,
    `page:${page}`,
    `limit:${limit}`,
    `user:${userId}`
  ];
  
  return `cache:${parts.join(':')}`;
};

/**
 * Generate cache key for stats endpoint
 */
const statsCacheKeyGenerator = (req) => {
  const projectId = req.params.projectId || req.query.project;
  const userId = req.user?.id || 'anon';
  
  return `cache:stats:project:${projectId}:user:${userId}`;
};

module.exports = {
  cacheMiddleware,
  invalidateCache,
  jobsCacheKeyGenerator,
  statsCacheKeyGenerator
};
