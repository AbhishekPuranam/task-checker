const redis = require('redis');
const fs = require('fs');

// Redis client singleton
let redisClient = null;

const getRedisClient = async () => {
  if (redisClient) {
    // Check if existing client is still connected
    if (redisClient.isReady) {
      return redisClient;
    }
    // If not ready, try to reconnect
    try {
      // Check if connection is not open before attempting to connect
      if (!redisClient.isOpen && typeof redisClient.connect === 'function') {
        await redisClient.connect();
      }
      return redisClient;
    } catch (err) {
      console.warn('⚠️  Existing Redis client failed to reconnect:', err.message);
      redisClient = null; // Reset to create new client
    }
  }

  try {
    // Read Redis password from Docker secrets
    let redisPassword = '';
    try {
      redisPassword = fs.readFileSync('/run/secrets/redis_password', 'utf8').trim();
    } catch (err) {
      console.warn('⚠️ Redis password not found in secrets, using default');
    }

    // Use 'redis' hostname in Docker, 'localhost' for local dev
    const redisHost = process.env.REDIS_HOST || 'redis';
    const redisPort = process.env.REDIS_PORT || '6379';
    const redisUrl = redisPassword 
      ? `redis://:${redisPassword}@${redisHost}:${redisPort}`
      : `redis://${redisHost}:${redisPort}`;

    redisClient = redis.createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 20) {
            console.error('❌ Redis: Too many retries, stopping reconnection');
            return new Error('Too many retries');
          }
          // Exponential backoff: 100ms, 200ms, 400ms, ..., max 5s
          const delay = Math.min(retries * 100, 5000);
          console.log(`🔄 Redis retry ${retries} in ${delay}ms`);
          return delay;
        },
        connectTimeout: 10000,
        keepAlive: 5000,
      },
      // Enable offline queue to buffer commands when disconnected
      enableOfflineQueue: true,
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis Client Error:', err.message);
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis client ready to accept commands');
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
    });

    redisClient.on('end', () => {
      console.log('⚠️  Redis connection closed');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error.message);
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
