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

/**
 * Cache transaction manager for coordinating cache operations with database transactions
 */
class CacheTransaction {
  constructor(projectId) {
    this.projectId = projectId;
    this.invalidatedKeys = [];
    this.backupData = new Map();
    this.isActive = false;
  }

  /**
   * Start cache transaction - backup current cache state
   */
  async start() {
    this.isActive = true;
    console.log(`🔄 [CACHE-TX] Started cache transaction for project ${this.projectId}`);
  }

  /**
   * Backup cache data before invalidation
   */
  async backupKey(pattern) {
    try {
      const data = await cache.get(pattern);
      if (data) {
        this.backupData.set(pattern, data);
        console.log(`💾 [CACHE-TX] Backed up cache key: ${pattern}`);
      }
    } catch (error) {
      console.error(`⚠️ [CACHE-TX] Failed to backup cache key ${pattern}:`, error.message);
    }
  }

  /**
   * Stage cache invalidation (don't execute yet)
   */
  async stageInvalidation(pattern) {
    if (!this.invalidatedKeys.includes(pattern)) {
      this.invalidatedKeys.push(pattern);
      console.log(`📝 [CACHE-TX] Staged invalidation for: ${pattern}`);
    }
  }

  /**
   * Commit - execute all staged invalidations
   */
  async commit() {
    if (!this.isActive) {
      return;
    }

    console.log(`✅ [CACHE-TX] Committing - Invalidating ${this.invalidatedKeys.length} cache patterns`);
    
    for (const pattern of this.invalidatedKeys) {
      await invalidateCache(pattern);
    }
    
    this.backupData.clear();
    this.isActive = false;
    console.log(`✅ [CACHE-TX] Cache transaction committed`);
  }

  /**
   * Rollback - restore backed up cache data
   */
  async rollback() {
    if (!this.isActive) {
      return;
    }

    console.log(`🔙 [CACHE-TX] Rolling back - Restoring ${this.backupData.size} cache entries`);
    
    for (const [key, data] of this.backupData.entries()) {
      try {
        await cache.set(key, data, 300); // Restore with 5-minute TTL
        console.log(`♻️ [CACHE-TX] Restored cache key: ${key}`);
      } catch (error) {
        console.error(`⚠️ [CACHE-TX] Failed to restore cache key ${key}:`, error.message);
      }
    }
    
    this.backupData.clear();
    this.invalidatedKeys = [];
    this.isActive = false;
    console.log(`🔙 [CACHE-TX] Cache transaction rolled back`);
  }

  /**
   * Get patterns that will be invalidated for a project
   */
  static getProjectCachePatterns(projectId) {
    return [
      `cache:projects:*`, // Invalidate all project listings (they include progress/element counts)
      `cache:project:${projectId}:*`, // Invalidate specific project cache
      `cache:project:name:*`, // Invalidate all project-by-name caches
      `cache:jobs:project:${projectId}:*`,
      `cache:stats:project:${projectId}:*`,
      `cache:structural:elements:project:${projectId}:*`,
      `cache:structural:summary:${projectId}:*`,
      `cache:/api/structural-elements/${projectId}*`,
      `cache:/api/projects/${projectId}*`
    ];
  }
}

/**
 * Middleware to add no-cache headers to mutation requests (POST, PUT, DELETE)
 * Prevents browsers from caching mutation responses
 */
const noCacheMiddleware = (req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
};

module.exports = {
  cacheMiddleware,
  invalidateCache,
  jobsCacheKeyGenerator,
  statsCacheKeyGenerator,
  CacheTransaction,
  noCacheMiddleware
};
