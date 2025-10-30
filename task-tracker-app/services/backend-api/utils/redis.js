const redis = require('redis');

// Redis client singleton
let redisClient = null;

const getRedisClient = async () => {
  if (redisClient) {
    return redisClient;
  }

  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('Redis: Too many retries, stopping reconnection');
            return new Error('Too many retries');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    // Return null if Redis is not available - app should work without cache
    return null;
  }
};

// Cache helper functions
const cacheHelpers = {
  // Get cached data
  async get(key) {
    try {
      const client = await getRedisClient();
      if (!client) return null;
      
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis GET error:', error);
      return null;
    }
  },

  // Set cached data with TTL (in seconds)
  async set(key, value, ttl = 300) {
    try {
      const client = await getRedisClient();
      if (!client) return false;
      
      await client.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Redis SET error:', error);
      return false;
    }
  },

  // Delete cached data
  async del(key) {
    try {
      const client = await getRedisClient();
      if (!client) return false;
      
      await client.del(key);
      return true;
    } catch (error) {
      console.error('Redis DEL error:', error);
      return false;
    }
  },

  // Delete multiple keys matching a pattern
  async delPattern(pattern) {
    try {
      const client = await getRedisClient();
      if (!client) return false;
      
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
      }
      return true;
    } catch (error) {
      console.error('Redis DEL PATTERN error:', error);
      return false;
    }
  },

  // Check if key exists
  async exists(key) {
    try {
      const client = await getRedisClient();
      if (!client) return false;
      
      return await client.exists(key);
    } catch (error) {
      console.error('Redis EXISTS error:', error);
      return false;
    }
  },

  // Get TTL for a key
  async ttl(key) {
    try {
      const client = await getRedisClient();
      if (!client) return -1;
      
      return await client.ttl(key);
    } catch (error) {
      console.error('Redis TTL error:', error);
      return -1;
    }
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  if (redisClient) {
    await redisClient.quit();
    console.log('Redis connection closed');
  }
});

module.exports = {
  getRedisClient,
  cache: cacheHelpers
};
