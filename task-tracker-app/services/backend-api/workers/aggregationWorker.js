const { Worker } = require('bullmq');
const mongoose = require('mongoose');
const SubProject = require('../models/SubProject');
const StructuralElement = require('../models/StructuralElement');

// Redis connection for BullMQ
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: process.env.REDIS_DB || 0
};

/**
 * Worker for calculating SubProject and Project statistics
 */
const aggregationWorker = new Worker(
  'aggregation-queue',
  async (job) => {
    const { type, subProjectId, projectId } = job.data;
    
    console.log(`[Aggregation Worker] Processing job ${job.id}: type=${type}`);
    
    try {
      if (type === 'subproject' && subProjectId) {
        // Calculate SubProject statistics
        const stats = await SubProject.recalculateStatistics(subProjectId);
        console.log(`[Aggregation Worker] Updated SubProject ${subProjectId}:`, stats);
        
        // Also trigger project-level calculation
        const subProject = await SubProject.findById(subProjectId).select('project');
        if (subProject && subProject.project) {
          const projectStats = await SubProject.recalculateProjectStatistics(subProject.project);
          console.log(`[Aggregation Worker] Updated Project ${subProject.project}:`, projectStats);
        }
        
        return { success: true, subProjectId, stats };
      } else if (type === 'project' && projectId) {
        // Calculate Project-level statistics (aggregate all SubProjects)
        const stats = await SubProject.recalculateProjectStatistics(projectId);
        console.log(`[Aggregation Worker] Updated Project ${projectId}:`, stats);
        
        return { success: true, projectId, stats };
      } else {
        throw new Error('Invalid job type or missing ID');
      }
    } catch (error) {
      console.error(`[Aggregation Worker] Error processing job ${job.id}:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000 // Max 10 jobs per second
    }
  }
);

aggregationWorker.on('completed', (job) => {
  console.log(`[Aggregation Worker] Job ${job.id} completed successfully`);
});

aggregationWorker.on('failed', (job, err) => {
  console.error(`[Aggregation Worker] Job ${job.id} failed:`, err);
});

aggregationWorker.on('error', (err) => {
  console.error('[Aggregation Worker] Worker error:', err);
});

console.log('✅ Aggregation worker started successfully');

module.exports = aggregationWorker;
