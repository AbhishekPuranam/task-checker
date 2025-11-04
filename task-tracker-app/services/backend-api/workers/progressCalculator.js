const { Worker } = require('bullmq');
const mongoose = require('mongoose');
const fs = require('fs');

let worker = null;

async function startProgressWorker() {
  // Don't start if already running
  if (worker) {
    console.log('⚠️ [PROGRESS WORKER] Already running');
    return worker;
  }

  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/tasktracker';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
      console.log('✅ [PROGRESS WORKER] Connected to MongoDB');
    }

    // Load models
    const Task = require('../models/Task');
    const StructuralElement = require('../models/StructuralElement');
    const Job = require('../models/Job');

    // Read Redis password
    let redisPassword = '';
    try {
      redisPassword = fs.readFileSync('/run/secrets/redis_password', 'utf8').trim();
    } catch (err) {
      console.warn('⚠️ [PROGRESS WORKER] Redis password not found in secrets');
    }

    const redisHost = process.env.REDIS_HOST || 'redis';
    const redisPort = process.env.REDIS_PORT || '6379';

    // Create worker
    worker = new Worker(
      'progress-calculation',
      async (job) => {
        const { projectId } = job.data;
        console.log(`📊 [PROGRESS WORKER] Calculating progress for project ${projectId}`);

        try {
          // Find the project
          const project = await Task.findById(projectId);
          if (!project) {
            throw new Error(`Project ${projectId} not found`);
          }

          // Get all structural elements for this project
          const elements = await StructuralElement.find({ project: projectId });
          
          if (elements.length === 0) {
            // No elements, set empty progress
            await Task.findByIdAndUpdate(projectId, {
              cachedProgress: {
                totalSurfaceArea: 0,
                completedSurfaceArea: 0,
                progressPercentage: 0,
                totalElements: 0,
                completedElements: 0,
                lastCalculated: new Date()
              }
            });
            console.log(`✅ [PROGRESS WORKER] Project ${project.title}: No elements`);
            return { totalElements: 0, completedElements: 0 };
          }

          const totalSurfaceArea = elements.reduce((sum, element) => 
            sum + (element.surfaceAreaSqm || 0), 0
          );

          // Get all jobs for this project
          const jobs = await Job.find({ project: projectId });
          
          let completedSurfaceArea = 0;
          let completedCount = 0;

          for (const element of elements) {
            // Find jobs for this element
            const elementJobs = jobs.filter(job => {
              const jobElementId = job.structuralElement?._id?.toString() || job.structuralElement?.toString();
              const elementId = element._id.toString();
              return jobElementId === elementId;
            });

            // Element is complete if it has jobs and all jobs are completed
            if (elementJobs.length > 0) {
              const allJobsCompleted = elementJobs.every(job => job.status === 'completed');
              
              if (allJobsCompleted) {
                completedSurfaceArea += (element.surfaceAreaSqm || 0);
                completedCount++;
              }
            }
          }

          const progressPercentage = totalSurfaceArea > 0 
            ? Math.round((completedSurfaceArea / totalSurfaceArea) * 100)
            : 0;

          const progressData = {
            totalSurfaceArea,
            completedSurfaceArea,
            progressPercentage,
            totalElements: elements.length,
            completedElements: completedCount,
            lastCalculated: new Date()
          };

          // Update project with cached progress
          await Task.findByIdAndUpdate(projectId, {
            cachedProgress: progressData
          });

          console.log(`✅ [PROGRESS WORKER] Project ${project.title}: ${completedCount}/${elements.length} elements, ${completedSurfaceArea.toFixed(2)}/${totalSurfaceArea.toFixed(2)} sqm`);
          
          return progressData;
        } catch (error) {
          console.error(`❌ [PROGRESS WORKER] Error calculating progress for project ${projectId}:`, error);
          throw error;
        }
      },
      {
        connection: {
          host: redisHost,
          port: parseInt(redisPort),
          password: redisPassword || undefined,
        },
        concurrency: 5, // Process 5 projects concurrently
      }
    );

    worker.on('completed', (job) => {
      console.log(`✅ [PROGRESS WORKER] Job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
      console.error(`❌ [PROGRESS WORKER] Job ${job?.id} failed:`, err.message);
    });

    worker.on('error', (err) => {
      console.error('❌ [PROGRESS WORKER] Worker error:', err);
    });

    console.log('✅ [PROGRESS WORKER] Progress calculation worker started');
    return worker;
  } catch (error) {
    console.error('❌ [PROGRESS WORKER] Failed to start worker:', error);
    throw error;
  }
}

async function stopProgressWorker() {
  if (worker) {
    try {
      await worker.close();
      worker = null;
      console.log('✅ [PROGRESS WORKER] Worker stopped');
    } catch (error) {
      console.error('❌ [PROGRESS WORKER] Error stopping worker:', error);
    }
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing progress worker');
  await stopProgressWorker();
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing progress worker');
  await stopProgressWorker();
});

module.exports = {
  startProgressWorker,
  stopProgressWorker,
};
