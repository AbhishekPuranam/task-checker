const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const redis = require('../utils/redis');
const { Queue } = require('bullmq');

/**
 * Basic health check - lightweight, fast response
 */
router.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'task-tracker-api',
    version: process.env.npm_package_version || '1.0.0'
  });
});

/**
 * Detailed health check - checks all dependencies
 */
router.get('/detailed', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'task-tracker-api',
    uptime: process.uptime(),
    checks: {}
  };

  try {
    // Check MongoDB
    const mongoState = mongoose.connection.readyState;
    health.checks.mongodb = {
      status: mongoState === 1 ? 'healthy' : 'unhealthy',
      state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoState],
      latency: null
    };

    if (mongoState === 1) {
      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      health.checks.mongodb.latency = Date.now() - start;
    }

    // Check Redis
    try {
      const start = Date.now();
      await redis.ping();
      health.checks.redis = {
        status: 'healthy',
        latency: Date.now() - start
      };
    } catch (error) {
      health.checks.redis = {
        status: 'unhealthy',
        error: error.message
      };
      health.status = 'degraded';
    }

    // Check BullMQ queues
    try {
      const excelQueue = new Queue('excel-processing', {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD
        }
      });

      const progressQueue = new Queue('progress-calculation', {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD
        }
      });

      const [excelCounts, progressCounts] = await Promise.all([
        excelQueue.getJobCounts(),
        progressQueue.getJobCounts()
      ]);

      health.checks.queues = {
        status: 'healthy',
        excel: excelCounts,
        progress: progressCounts
      };

      await excelQueue.close();
      await progressQueue.close();
    } catch (error) {
      health.checks.queues = {
        status: 'unhealthy',
        error: error.message
      };
      health.status = 'degraded';
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    health.checks.memory = {
      status: 'healthy',
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
    };

    // Overall status
    if (health.checks.mongodb.status === 'unhealthy') {
      health.status = 'unhealthy';
    }

  } catch (error) {
    health.status = 'unhealthy';
    health.error = error.message;
  }

  const statusCode = health.status === 'healthy' ? 200 : 
                     health.status === 'degraded' ? 200 : 503;
  
  res.status(statusCode).json(health);
});

/**
 * MongoDB-specific health check
 */
router.get('/mongodb', async (req, res) => {
  try {
    const start = Date.now();
    const mongoState = mongoose.connection.readyState;
    
    if (mongoState !== 1) {
      return res.status(503).json({
        status: 'unhealthy',
        state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoState],
        timestamp: new Date().toISOString()
      });
    }

    await mongoose.connection.db.admin().ping();
    const latency = Date.now() - start;

    // Get database stats
    const stats = await mongoose.connection.db.stats();

    res.json({
      status: 'healthy',
      latency: `${latency}ms`,
      database: mongoose.connection.db.databaseName,
      collections: stats.collections,
      dataSize: `${Math.round(stats.dataSize / 1024 / 1024)}MB`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Redis-specific health check
 */
router.get('/redis', async (req, res) => {
  try {
    const start = Date.now();
    await redis.ping();
    const latency = Date.now() - start;

    // Get Redis info
    const info = await redis.info();
    const lines = info.split('\r\n');
    const memoryLine = lines.find(l => l.startsWith('used_memory_human:'));
    const memory = memoryLine ? memoryLine.split(':')[1] : 'unknown';

    res.json({
      status: 'healthy',
      latency: `${latency}ms`,
      memory,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * BullMQ queues health check
 */
router.get('/queues', async (req, res) => {
  try {
    const excelQueue = new Queue('excel-processing', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD
      }
    });

    const progressQueue = new Queue('progress-calculation', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD
      }
    });

    const [excelCounts, progressCounts] = await Promise.all([
      excelQueue.getJobCounts(),
      progressQueue.getJobCounts()
    ]);

    await excelQueue.close();
    await progressQueue.close();

    const hasIssues = 
      excelCounts.failed > 10 || 
      progressCounts.failed > 10 ||
      excelCounts.active > 50 ||
      progressCounts.active > 50;

    res.status(hasIssues ? 503 : 200).json({
      status: hasIssues ? 'degraded' : 'healthy',
      queues: {
        excel: excelCounts,
        progress: progressCounts
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * API endpoints health check
 */
router.get('/api', async (req, res) => {
  const checks = {
    status: 'healthy',
    endpoints: {},
    timestamp: new Date().toISOString()
  };

  try {
    const Project = require('../models/Project');
    const SubProject = require('../models/SubProject');
    const StructuralElement = require('../models/StructuralElement');
    const User = require('../models/User');

    // Test critical queries with timeouts
    const timeout = 5000; // 5 seconds

    const [projectCount, subProjectCount, elementCount, userCount] = await Promise.all([
      Project.countDocuments().maxTimeMS(timeout),
      SubProject.countDocuments().maxTimeMS(timeout),
      StructuralElement.countDocuments().maxTimeMS(timeout),
      User.countDocuments().maxTimeMS(timeout)
    ]);

    checks.endpoints.projects = {
      status: 'healthy',
      count: projectCount
    };

    checks.endpoints.subprojects = {
      status: 'healthy',
      count: subProjectCount
    };

    checks.endpoints.elements = {
      status: 'healthy',
      count: elementCount
    };

    checks.endpoints.users = {
      status: 'healthy',
      count: userCount
    };

  } catch (error) {
    checks.status = 'unhealthy';
    checks.error = error.message;
  }

  const statusCode = checks.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(checks);
});

module.exports = router;
