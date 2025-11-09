const { Worker } = require('bullmq');
const fs = require('fs');
const path = require('path');
const StructuralElement = require('../models/StructuralElement');
const Task = require('../models/Task');
const Job = require('../models/Job');
const UploadSession = require('../models/UploadSession');
const { invalidateCache } = require('../middleware/cache');
const { addProgressJob } = require('../utils/queue');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { parseExcelFile, transformExcelRow } = require('../utils/excelTransform');
const { createFireProofingJobs } = require('../utils/fireProofingJobs');

/**
 * Delete Excel file safely
 */
function deleteExcelFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info('Deleted Excel file', { 
        file: path.basename(filePath),
        category: 'cleanup'
      });
      return true;
    }
  } catch (error) {
    logger.error('Failed to delete Excel file', {
      file: filePath,
      error: error.message,
      category: 'cleanup'
    });
    return false;
  }
  return false;
}

/**
 * Complete rollback - delete all created elements, jobs, and clean Redis
 */
async function completeRollback(uploadSession, projectId, subProjectId = null) {
  logger.info('Starting complete rollback', {
    uploadId: uploadSession.uploadId,
    projectId,
    subProjectId,
    category: 'rollback'
  });
  
  const deletionStats = {
    elementsDeleted: 0,
    jobsDeleted: 0,
    errors: []
  };

  try {
    // Collect all element IDs from successful batches
    const elementIds = [];
    for (const batch of uploadSession.batches) {
      if (batch.elementsCreated && batch.elementsCreated.length > 0) {
        elementIds.push(...batch.elementsCreated);
      }
    }

    if (elementIds.length > 0) {
      // Delete all jobs associated with these elements
      const jobsResult = await Job.deleteMany({
        structuralElement: { $in: elementIds }
      });
      deletionStats.jobsDeleted = jobsResult.deletedCount;
      logger.info('Deleted jobs during rollback', {
        count: jobsResult.deletedCount,
        category: 'rollback'
      });

      // Delete all elements
      const elementsResult = await StructuralElement.deleteMany({
        _id: { $in: elementIds }
      });
      deletionStats.elementsDeleted = elementsResult.deletedCount;
      logger.info('Deleted elements during rollback', {
        count: elementsResult.deletedCount,
        category: 'rollback'
      });

      // Update project count (decrement)
      if (deletionStats.elementsDeleted > 0) {
        await Task.findByIdAndUpdate(
          projectId,
          { $inc: { structuralElementsCount: -deletionStats.elementsDeleted } }
        );
        logger.info('Decremented project count', {
          projectId,
          decrement: deletionStats.elementsDeleted,
          category: 'rollback'
        });

        // Update subproject count if applicable
        if (subProjectId) {
          const SubProject = require('../models/SubProject');
          await SubProject.findByIdAndUpdate(
            subProjectId,
            { $inc: { structuralElementsCount: -deletionStats.elementsDeleted } }
          );
          logger.info('Decremented subproject count', {
            subProjectId,
            decrement: deletionStats.elementsDeleted,
            category: 'rollback'
          });
        }
      }

      // Invalidate caches
      await invalidateCache(`/api/structural-elements?project=${projectId}`);
      await invalidateCache(`/api/projects/${projectId}/stats`);
      
      if (subProjectId) {
        await invalidateCache(`/api/structural-elements?subProject=${subProjectId}`);
        await invalidateCache(`/api/subprojects/${subProjectId}/stats`);
      }
    }

    // Mark upload session as failed with rollback info
    uploadSession.status = 'failed';
    uploadSession.completedAt = new Date();
    uploadSession.updateSummary();
    await uploadSession.save();

    logger.info('Rollback completed', {
      elementsDeleted: deletionStats.elementsDeleted,
      jobsDeleted: deletionStats.jobsDeleted,
      category: 'rollback'
    });
    
  } catch (error) {
    logger.logError(error, {
      operation: 'rollback',
      uploadId: uploadSession.uploadId,
      category: 'rollback'
    });
    deletionStats.errors.push(error.message);
  }

  return deletionStats;
}

/**
 * Verify data integrity in database
 */
async function verifyUploadIntegrity(uploadSession, projectId, subProjectId = null) {
  logger.info('Verifying upload integrity', {
    uploadId: uploadSession.uploadId,
    projectId,
    subProjectId,
    category: 'verification'
  });
  
  try {
    const summary = uploadSession.summary;
    
    // Count actual elements in database
    const query = { project: projectId };
    if (subProjectId) {
      query.subProject = subProjectId;
    }
    
    // Get element IDs from successful batches
    const elementIds = [];
    for (const batch of uploadSession.batches) {
      if (batch.status === 'success' && batch.elementsCreated) {
        elementIds.push(...batch.elementsCreated);
      }
    }
    
    const actualElements = await StructuralElement.countDocuments({
      _id: { $in: elementIds }
    });
    
    const actualJobs = await Job.countDocuments({
      structuralElement: { $in: elementIds }
    });
    
    const isValid = (actualElements === summary.totalElementsCreated) &&
                    (actualJobs === summary.totalJobsCreated);
    
    logger.info('Data integrity verification', {
      expected: { elements: summary.totalElementsCreated, jobs: summary.totalJobsCreated },
      actual: { elements: actualElements, jobs: actualJobs },
      isValid,
      category: 'verification'
    });
    
    return {
      isValid,
      expected: {
        elements: summary.totalElementsCreated,
        jobs: summary.totalJobsCreated
      },
      actual: {
        elements: actualElements,
        jobs: actualJobs
      }
    };
    
  } catch (error) {
    logger.logError(error, {
      operation: 'verifyUploadIntegrity',
      uploadId: uploadSession.uploadId,
      category: 'verification'
    });
    return {
      isValid: false,
      error: error.message
    };
  }
}

/**
 * Process a single batch with its own transaction
 */
async function processBatch(uploadSession, batchNumber, excelData, project, userId, subProjectId = null) {
  const batch = uploadSession.batches.find(b => b.batchNumber === batchNumber);
  if (!batch) {
    throw new Error(`Batch ${batchNumber} not found`);
  }

  // Start a new transaction for this batch only
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const elementsCreated = [];
    const jobsCreated = [];
    let duplicatesSkipped = 0;

    // Get rows for this batch (array indices are 0-based, but startRow/endRow are 1-based)
    const batchRows = excelData.slice(batch.startRow - 1, batch.endRow);

    console.log(`📦 [BATCH ${batchNumber}] Processing ${batchRows.length} rows (${batch.startRow}-${batch.endRow})`);

    for (const row of batchRows) {
      try {
        const elementData = transformExcelRow(row, project._id, userId, project, subProjectId);

        console.log(`🔍 [DEBUG] SubProjectId passed to transform: ${subProjectId}, elementData.subProject: ${elementData.subProject}`);

        if (!elementData.structureNumber) {
          console.warn(`⚠️ [BATCH ${batchNumber}] Skipping row - no structure number`);
          continue;
        }

        // Check for duplicate
        const duplicateQuery = {
          project: project._id,
          structureNumber: elementData.structureNumber,
          drawingNo: elementData.drawingNo,
          level: elementData.level,
          memberType: elementData.memberType,
          gridNo: elementData.gridNo,
          partMarkNo: elementData.partMarkNo,
        };
        
        // If subProjectId is provided, check duplicates within subproject
        if (subProjectId) {
          duplicateQuery.subProject = subProjectId;
        }
        
        const existingElement = await StructuralElement.findOne(duplicateQuery).session(session);

        if (existingElement) {
          console.log(`⚠️ [BATCH ${batchNumber}] Skipping duplicate: ${elementData.structureNumber}`);
          duplicatesSkipped++;
          continue;
        }

        // Create element
        const structuralElement = new StructuralElement(elementData);
        const savedElement = await structuralElement.save({ session });
        elementsCreated.push(savedElement._id);

        // Create jobs if workflow assigned
        if (savedElement.fireProofingWorkflow) {
          const jobs = await createFireProofingJobs(savedElement, userId, session);
          jobsCreated.push(...jobs.map(j => j._id));
        }
      } catch (error) {
        console.error(`❌ [BATCH ${batchNumber}] Error processing row:`, error.message);
        throw error; // Fail entire batch if one row fails
      }
    }

    // Commit this batch's transaction
    await session.commitTransaction();
    console.log(`✅ [BATCH ${batchNumber}] Transaction committed - ${elementsCreated.length} elements, ${jobsCreated.length} jobs`);

    // Update batch status
    uploadSession.updateBatchStatus(batchNumber, 'success', {
      elementsCreated,
      jobsCreated,
      duplicatesSkipped
    });

    await uploadSession.save();

    return {
      success: true,
      elementsCreated: elementsCreated.length,
      jobsCreated: jobsCreated.length,
      duplicatesSkipped
    };

  } catch (error) {
    // Rollback this batch's transaction
    await session.abortTransaction();
    console.error(`❌ [BATCH ${batchNumber}] Transaction rolled back:`, error.message);

    // Update batch status to failed and CLEAR any partial data since transaction was rolled back
    uploadSession.updateBatchStatus(batchNumber, 'failed', {
      elementsCreated: [],  // Clear since rollback removed these
      jobsCreated: [],      // Clear since rollback removed these
      duplicatesSkipped: 0, // Reset since batch failed
      errorMessage: error.message,
      errorDetails: { stack: error.stack }
    });

    await uploadSession.save();

    return {
      success: false,
      error: error.message
    };

  } finally {
    session.endSession();
  }
}

/**
 * Create and start batch-based Excel processing worker
 */
function createBatchExcelWorker() {
  const fs = require('fs');
  let redisPassword = '';
  try {
    redisPassword = fs.readFileSync('/run/secrets/redis_password', 'utf8').trim();
  } catch (err) {
    console.warn('⚠️ Redis password not found in secrets');
  }

  const redisHost = process.env.REDIS_HOST || 'redis';
  const redisPort = process.env.REDIS_PORT || '6379';
  const BATCH_SIZE = parseInt(process.env.EXCEL_BATCH_SIZE) || 50;
  const MAX_CONCURRENCY = parseInt(process.env.EXCEL_CONCURRENCY) || 2;

  const worker = new Worker(
    'excel-processing',
    async (job) => {
      const startTime = Date.now();
      console.log(`🔄 [WORKER] Processing job ${job.id} with batch-based approach`);

      const { filePath, projectId, userId, userEmail, subProjectId } = job.data;

      try {
        // Stage 1: Parse Excel (0-10%)
        await job.updateProgress({ stage: 'parsing', percent: 0, message: 'Parsing Excel file...' });

        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
        }

        const excelData = parseExcelFile(filePath);
        if (!excelData || excelData.length === 0) {
          throw new Error('Excel file is empty or invalid');
        }

        console.log(`✅ [WORKER] Parsed ${excelData.length} rows from Excel`);

        // Stage 2: Load project (10-15%)
        await job.updateProgress({ stage: 'loading', percent: 10, message: 'Loading project...' });

        const project = await Task.findById(projectId);
        if (!project) {
          throw new Error('Project not found');
        }

        // Stage 3: Create upload session (15-20%)
        await job.updateProgress({ stage: 'preparing', percent: 15, message: 'Creating upload session...' });

        const uploadId = uuidv4();
        const uploadSession = await UploadSession.createSession({
          uploadId,
          projectId,
          userId,
          fileName: filePath.split('/').pop(),
          filePath,
          totalRows: excelData.length,
          batchSize: BATCH_SIZE
        });

        console.log(`✅ [WORKER] Upload session created: ${uploadId} with ${uploadSession.totalBatches} batches`);

        await job.updateProgress({
          stage: 'processing',
          percent: 20,
          message: `Processing ${uploadSession.totalBatches} batches...`,
          uploadId,
          totalBatches: uploadSession.totalBatches
        });

        // Stage 4: Process batches (20-90%)
        const pendingBatches = uploadSession.getPendingBatches();
        let processedBatches = 0;

        for (const batch of pendingBatches) {
          const batchPercent = 20 + ((processedBatches / uploadSession.totalBatches) * 70);
          
          await job.updateProgress({
            stage: 'processing',
            percent: batchPercent,
            message: `Processing batch ${batch.batchNumber}/${uploadSession.totalBatches}`,
            currentBatch: batch.batchNumber,
            totalBatches: uploadSession.totalBatches,
            uploadId
          });

          // Process batch with its own transaction
          const result = await processBatch(uploadSession, batch.batchNumber, excelData, project, userId, subProjectId);

          processedBatches++;

          console.log(`📊 [WORKER] Batch ${batch.batchNumber}/${uploadSession.totalBatches} - ${result.success ? 'SUCCESS' : 'FAILED'}`);
        }

        // Refresh upload session from DB to get latest summary
        await uploadSession.save();
        const summary = uploadSession.summary;

        console.log(`✅ [WORKER] All batches processed - ${summary.successfulBatches} succeeded, ${summary.failedBatches} failed`);

        // Stage 5: Finalize (90-100%)
        await job.updateProgress({
          stage: 'finalizing',
          percent: 90,
          message: 'Finalizing and verifying upload...',
          uploadId
        });

        // Update upload session status to completed/partial_success/failed
        uploadSession.updateSummary();  // Recalculate status based on batch results
        await uploadSession.save();     // Save the final status
        
        console.log(`📊 [WORKER] Upload session final status: ${uploadSession.status}`);

        // DECISION POINT: Check if upload was successful enough to keep
        const shouldKeepUpload = summary.successfulBatches > 0 && summary.totalElementsCreated > 0;
        const hasFailures = summary.failedBatches > 0;

        if (!shouldKeepUpload) {
          // Complete failure - rollback everything
          console.log(`❌ [WORKER] Upload completely failed - initiating full rollback`);
          
          await completeRollback(uploadSession, projectId, subProjectId);
          
          // Delete Excel file
          deleteExcelFile(filePath);
          
          throw new Error(`Upload failed: No elements were created successfully. All ${summary.failedBatches} batches failed.`);
        }

        if (hasFailures) {
          // Partial success - user must decide whether to keep or rollback
          console.log(`⚠️ [WORKER] Partial success detected - ${summary.failedBatches} batches failed`);
          
          // Keep the data but mark status appropriately
          uploadSession.status = 'partial_success';
          await uploadSession.save();
          
          // Don't delete file yet - user might want to retry failed batches
          console.log(`📄 [WORKER] Keeping Excel file for potential retry: ${path.basename(filePath)}`);
        } else {
          // Complete success - verify and cleanup
          console.log(`✅ [WORKER] Upload completely successful - verifying data integrity`);
          
          // Verify data integrity
          const verification = await verifyUploadIntegrity(uploadSession, projectId, subProjectId);
          
          if (!verification.isValid) {
            console.error(`❌ [VERIFY] Data integrity check failed - initiating rollback`);
            console.error(`Expected: ${verification.expected.elements} elements, ${verification.expected.jobs} jobs`);
            console.error(`Actual: ${verification.actual.elements} elements, ${verification.actual.jobs} jobs`);
            
            await completeRollback(uploadSession, projectId, subProjectId);
            deleteExcelFile(filePath);
            
            throw new Error(`Data integrity verification failed. Rolled back all changes.`);
          }
          
          console.log(`✅ [VERIFY] Data integrity confirmed - safe to cleanup Excel file`);
          
          // Delete Excel file since data is verified in database
          deleteExcelFile(filePath);
        }

        // Update project count (only if elements were created)
        if (summary.totalElementsCreated > 0) {
          await Task.findByIdAndUpdate(
            projectId,
            { $inc: { structuralElementsCount: summary.totalElementsCreated } }
          );
          
          // Update subproject count if subProjectId is provided
          if (subProjectId) {
            const SubProject = require('../models/SubProject');
            await SubProject.findByIdAndUpdate(
              subProjectId,
              { $inc: { structuralElementsCount: summary.totalElementsCreated } }
            );
          }
        }

        // Invalidate cache
        await invalidateCache(`/api/structural-elements?project=${projectId}`);
        await invalidateCache(`/api/projects/${projectId}/stats`);
        
        // NEW: Invalidate subproject cache and trigger aggregation if subProjectId is provided
        if (subProjectId && summary.totalElementsCreated > 0) {
          await invalidateCache(`/api/structural-elements?subProject=${subProjectId}`);
          await invalidateCache(`/api/subprojects/${subProjectId}/stats`);
          
          const { scheduleBatchAggregation } = require('../utils/aggregationQueue');
          scheduleBatchAggregation(subProjectId).catch(err =>
            console.error('[WORKER] Failed to queue aggregation job:', err)
          );
        }

        // Trigger progress calculation
        if (summary.totalElementsCreated > 0) {
          addProgressJob(projectId).catch(err =>
            console.error('[WORKER] Failed to queue progress job:', err)
          );
        }

        // Excel file already deleted above based on success/failure status
        
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
        const statusMessage = summary.failedBatches === 0
          ? `✅ Complete! ${summary.totalElementsCreated} elements, ${summary.totalJobsCreated} jobs created in ${processingTime}s`
          : `⚠️ Partial success: ${summary.successfulBatches} batches succeeded, ${summary.failedBatches} failed. ${summary.totalElementsCreated} elements created.`;

        await job.updateProgress({
          stage: 'completed',
          percent: 100,
          message: statusMessage,
          uploadId
        });

        console.log(`✅ [WORKER] Job ${job.id} completed in ${processingTime}s`);

        return {
          success: true,
          uploadId,
          uploadSession: {
            ...summary,
            status: uploadSession.status
          },
          processingTime: `${processingTime}s`
        };

      } catch (error) {
        console.error(`❌ [WORKER] Job ${job.id} failed with error:`, {
          errorMessage: error.message,
          errorType: error.constructor.name,
          uploadId: job.data.uploadId,
          projectId: projectId,
          subProjectId: subProjectId,
          userId: userId,
          filePath: filePath ? path.basename(filePath) : 'unknown',
          stack: error.stack
        });

        // Try to rollback and cleanup if upload session exists
        if (job.data.uploadId) {
          try {
            const failedSession = await UploadSession.findOne({ uploadId: job.data.uploadId });
            if (failedSession) {
              // Perform complete rollback if any elements were created
              const summary = failedSession.summary;
              
              console.log(`📊 [WORKER] Upload session status before cleanup:`, {
                uploadId: job.data.uploadId,
                status: failedSession.status,
                totalBatches: summary.totalBatches,
                successfulBatches: summary.successfulBatches,
                failedBatches: summary.failedBatches,
                elementsCreated: summary.totalElementsCreated,
                jobsCreated: summary.totalJobsCreated
              });
              
              if (summary && summary.totalElementsCreated > 0) {
                console.log(`🔄 [WORKER] Initiating rollback for failed upload: ${job.data.uploadId}`);
                await completeRollback(failedSession, projectId, subProjectId);
              } else {
                // Just mark as failed if nothing was created
                failedSession.status = 'failed';
                failedSession.completedAt = new Date();
                failedSession.updateSummary();
                await failedSession.save();
                console.log(`📊 [WORKER] Marked upload session ${job.data.uploadId} as failed (no rollback needed)`);
              }
            } else {
              console.warn(`⚠️ [WORKER] Upload session ${job.data.uploadId} not found for cleanup`);
            }
          } catch (sessionError) {
            console.error(`❌ [WORKER] Failed to handle upload session cleanup:`, {
              uploadId: job.data.uploadId,
              errorMessage: sessionError.message,
              stack: sessionError.stack
            });
          }
        }

        // Clean up Excel file on error
        if (filePath) {
          console.log(`🗑️ [WORKER] Cleaning up Excel file: ${path.basename(filePath)}`);
          deleteExcelFile(filePath);
        }

        throw error;
      }
    },
    {
      connection: {
        host: redisHost,
        port: parseInt(redisPort),
        password: redisPassword || undefined,
      },
      concurrency: MAX_CONCURRENCY,
      limiter: {
        max: 10,
        duration: 60000,
      },
    }
  );

  worker.on('completed', (job, returnvalue) => {
    console.log(`✅ [WORKER] Job ${job.id} completed:`, returnvalue);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ [WORKER] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('❌ [WORKER] Worker error:', err);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`⚠️ [WORKER] Job ${jobId} has stalled and will be reprocessed`);
  });

  console.log(`✅ [WORKER] Batch-based Excel processing worker started with concurrency: ${MAX_CONCURRENCY}, batch size: ${BATCH_SIZE}`);

  return worker;
}

module.exports = { createBatchExcelWorker };
