const { Worker } = require('bullmq');
const fs = require('fs');
const StructuralElement = require('../models/StructuralElement');
const Task = require('../models/Task');
const Job = require('../models/Job');
const UploadSession = require('../models/UploadSession');
const { invalidateCache } = require('../middleware/cache');
const { addProgressJob } = require('../utils/queue');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

/**
 * Parse Excel file
 */
function parseExcelFile(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    return data;
  } catch (error) {
    throw new Error(`Error parsing Excel file: ${error.message}`);
  }
}

/**
 * Transform Excel row to structural element
 */
function transformExcelRow(row, projectId, userId, project, subProjectId = null) {
  const transformed = {
    project: projectId,
    subProject: subProjectId, // NEW: Support for SubProject
    projectName: project.title || 'Untitled Project',
    siteLocation: project.location || 'Not specified',
    serialNo: row['Sl No'] || row['Serial No'] || row['S.No'],
    structureNumber: row['Structure Number'] || row['Structure No'],
    drawingNo: row['Drawing No'] || row['Drawing Number'],
    level: row['Level'] || row['Floor'],
    memberType: row['Member Type'] || row['Type'],
    gridNo: row['GridNo'] || row['Grid'] || row['Grid No'],
    partMarkNo: row['Part Mark No'] || row['Part Mark'] || row['Mark No'],
    sectionSizes: row['Section Sizes'] || row['Section'],
    lengthMm: parseFloat(row['Length in (mm)'] || row['Length']) || 0,
    qty: parseInt(row['Qty'] || row['Quantity']) || 1,
    sectionDepthMm: parseFloat(row['Section Depth (mm)D'] || row['Depth']) || 0,
    flangeWidthMm: parseFloat(row['Flange Width (mm) B'] || row['Width']) || 0,
    webThicknessMm: parseFloat(row['Thickness (mm) t Of Web'] || row['Web Thickness']) || 0,
    flangeThicknessMm: parseFloat(row['Thickness (mm) TOf Flange'] || row['Flange Thickness']) || 0,
    fireproofingThickness: parseFloat(row['Thickness of Fireproofing'] || row['Fireproofing']) || 0,
    surfaceAreaSqm: parseFloat(row['Surface Area in Sqm'] || row['Area']) || 0,
    fireProofingWorkflow: row['Fire Proofing Workflow'] || null,
    createdBy: userId,
  };

  return transformed;
}

/**
 * Create fire proofing jobs for a structural element
 */
async function createFireProofingJobs(structuralElement, userId, session = null) {
  const workflowJobs = {
    'cement_fire_proofing': [
      { title: 'Surface Preparation', order: 1 },
      { title: 'Rockwool Filling', order: 2 },
      { title: 'Adhesive coat/Primer', order: 3 },
      { title: 'Vermiculite-Cement', order: 4 },
      { title: 'Thickness inspection', order: 5 },
      { title: 'Sealer coat', order: 6 },
      { title: 'WIR', order: 7 },
    ],
    'gypsum_fire_proofing': [
      { title: 'Surface Preparation', order: 1 },
      { title: 'Rockwool Filling', order: 2 },
      { title: 'Adhesive coat/Primer', order: 3 },
      { title: 'Vermiculite-Gypsum', order: 4 },
      { title: 'Thickness inspection', order: 5 },
      { title: 'Sealer coat', order: 6 },
      { title: 'WIR', order: 7 },
    ],
    'intumescent_coatings': [
      { title: 'Surface Preparation', order: 1 },
      { title: 'Primer', order: 2 },
      { title: 'Coat -1', order: 3 },
      { title: 'Coat-2', order: 4 },
      { title: 'Coat-3', order: 5 },
      { title: 'Coat-4', order: 6 },
      { title: 'Coat-5', order: 7 },
      { title: 'Thickness inspection', order: 8 },
      { title: 'Top Coat', order: 9 },
    ],
    'refinery_fire_proofing': [
      { title: 'Scaffolding Errection', order: 1 },
      { title: 'Surface Preparation', order: 2 },
      { title: 'Primer/Adhesive coat', order: 3 },
      { title: 'Mesh', order: 4 },
      { title: 'FP 1 Coat', order: 5 },
      { title: 'FP Finish coat', order: 6 },
      { title: 'Sealer', order: 7 },
      { title: 'Top coat Primer', order: 8 },
      { title: 'Top coat', order: 9 },
      { title: 'Sealant', order: 10 },
      { title: 'Inspection', order: 11 },
      { title: 'Scaffolding -Dismantling', order: 12 },
    ],
  };

  const jobs = workflowJobs[structuralElement.fireProofingWorkflow] || [];
  const createdJobs = [];

  for (const jobTemplate of jobs) {
    let fireProofingType;
    switch (structuralElement.fireProofingWorkflow) {
      case 'cement_fire_proofing':
        fireProofingType = 'Cement';
        break;
      case 'gypsum_fire_proofing':
        fireProofingType = 'Gypsum';
        break;
      case 'intumescent_coatings':
        fireProofingType = 'Intumescent';
        break;
      case 'refinery_fire_proofing':
        fireProofingType = 'Refinery';
        break;
      default:
        fireProofingType = 'Other';
    }
    
    const job = new Job({
      structuralElement: structuralElement._id,
      project: structuralElement.project,
      jobTitle: jobTemplate.title,
      jobDescription: `${jobTemplate.title} for ${structuralElement.structureNumber}`,
      jobType: structuralElement.fireProofingWorkflow,
      orderIndex: jobTemplate.order * 100,
      fireProofingType: fireProofingType,
      status: 'pending',
      createdBy: userId,
    });

    const saved = await job.save({ session });
    createdJobs.push(saved);
  }

  return createdJobs;
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

    // Update batch status to failed
    uploadSession.updateBatchStatus(batchNumber, 'failed', {
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
          message: 'Finalizing upload...',
          uploadId
        });

        // Update project count
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

        // Clean up file
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.error('Error deleting file:', error);
        }

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
        console.error(`❌ [WORKER] Job ${job.id} failed:`, error);

        // Clean up file on error
        if (filePath) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            console.error('Error deleting file:', e);
          }
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
