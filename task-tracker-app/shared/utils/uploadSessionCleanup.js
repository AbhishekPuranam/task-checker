const UploadSession = require('../models/UploadSession');
const StructuralElement = require('../models/StructuralElement');
const Job = require('../models/Job');
const Task = require('../models/Task');
const { invalidateCache } = require('../middleware/cache');

/**
 * Cleanup failed batches only
 * Deletes elements and jobs from failed batches, keeps successful ones
 */
async function cleanupFailedBatches(uploadSessionId) {
  const uploadSession = await UploadSession.findById(uploadSessionId);
  if (!uploadSession) {
    throw new Error('Upload session not found');
  }

  console.log(`🧹 [CLEANUP] Cleaning up failed batches for session ${uploadSession.uploadId}`);

  let elementsDeleted = 0;
  let jobsDeleted = 0;

  for (const batch of uploadSession.batches) {
    if (batch.status === 'failed') {
      console.log(`🧹 [CLEANUP] Cleaning batch ${batch.batchNumber} (${batch.elementsCreated.length} elements, ${batch.jobsCreated.length} jobs)`);

      // Delete elements created in this failed batch
      if (batch.elementsCreated.length > 0) {
        const deleteResult = await StructuralElement.deleteMany({
          _id: { $in: batch.elementsCreated }
        });
        elementsDeleted += deleteResult.deletedCount;
      }

      // Delete jobs created in this failed batch
      if (batch.jobsCreated.length > 0) {
        const deleteResult = await Job.deleteMany({
          _id: { $in: batch.jobsCreated }
        });
        jobsDeleted += deleteResult.deletedCount;
      }

      // Reset batch to pending for potential retry
      batch.status = 'pending';
      batch.elementsCreated = [];
      batch.jobsCreated = [];
      batch.duplicatesSkipped = 0;
      batch.errorMessage = null;
      batch.errorDetails = null;
    }
  }

  // Update summary
  uploadSession.updateSummary();
  await uploadSession.save();

  // Update project count
  if (elementsDeleted > 0) {
    await Task.findByIdAndUpdate(
      uploadSession.project,
      { $inc: { structuralElementsCount: -elementsDeleted } }
    );
  }

  // Invalidate cache
  await invalidateCache(`/api/structural-elements?project=${uploadSession.project}`);
  await invalidateCache(`/api/projects/${uploadSession.project}/stats`);

  console.log(`✅ [CLEANUP] Cleaned up ${elementsDeleted} elements and ${jobsDeleted} jobs from failed batches`);

  return {
    batchesCleaned: uploadSession.batches.filter(b => b.status === 'pending').length,
    elementsDeleted,
    jobsDeleted
  };
}

/**
 * Delete specific batch (successful or failed)
 */
async function deleteBatch(uploadSessionId, batchNumber) {
  const uploadSession = await UploadSession.findById(uploadSessionId);
  if (!uploadSession) {
    throw new Error('Upload session not found');
  }

  const batch = uploadSession.batches.find(b => b.batchNumber === batchNumber);
  if (!batch) {
    throw new Error(`Batch ${batchNumber} not found`);
  }

  console.log(`🗑️ [DELETE] Deleting batch ${batchNumber} (status: ${batch.status})`);

  let elementsDeleted = 0;
  let jobsDeleted = 0;

  // Delete elements
  if (batch.elementsCreated.length > 0) {
    const deleteResult = await StructuralElement.deleteMany({
      _id: { $in: batch.elementsCreated }
    });
    elementsDeleted = deleteResult.deletedCount;
  }

  // Delete jobs
  if (batch.jobsCreated.length > 0) {
    const deleteResult = await Job.deleteMany({
      _id: { $in: batch.jobsCreated }
    });
    jobsDeleted = deleteResult.deletedCount;
  }

  // Update project count
  if (elementsDeleted > 0) {
    await Task.findByIdAndUpdate(
      uploadSession.project,
      { $inc: { structuralElementsCount: -elementsDeleted } }
    );
  }

  // Mark batch as deleted (or remove it)
  batch.status = 'pending';
  batch.elementsCreated = [];
  batch.jobsCreated = [];
  batch.duplicatesSkipped = 0;

  uploadSession.updateSummary();
  await uploadSession.save();

  // Invalidate cache
  await invalidateCache(`/api/structural-elements?project=${uploadSession.project}`);
  await invalidateCache(`/api/projects/${uploadSession.project}/stats`);

  console.log(`✅ [DELETE] Deleted batch ${batchNumber} - ${elementsDeleted} elements, ${jobsDeleted} jobs`);

  return {
    elementsDeleted,
    jobsDeleted
  };
}

/**
 * Delete entire upload session and all its data
 */
async function deleteUploadSession(uploadSessionId) {
  const uploadSession = await UploadSession.findById(uploadSessionId);
  if (!uploadSession) {
    throw new Error('Upload session not found');
  }

  console.log(`🗑️ [DELETE] Deleting entire upload session ${uploadSession.uploadId}`);

  // Collect all element IDs and job IDs from all batches
  const allElementIds = [];
  const allJobIds = [];

  uploadSession.batches.forEach(batch => {
    allElementIds.push(...batch.elementsCreated);
    allJobIds.push(...batch.jobsCreated);
  });

  console.log(`🗑️ [DELETE] Found ${allElementIds.length} elements and ${allJobIds.length} jobs to delete`);

  // Delete all elements
  let elementsDeleted = 0;
  if (allElementIds.length > 0) {
    const deleteResult = await StructuralElement.deleteMany({
      _id: { $in: allElementIds }
    });
    elementsDeleted = deleteResult.deletedCount;
  }

  // Delete all jobs
  let jobsDeleted = 0;
  if (allJobIds.length > 0) {
    const deleteResult = await Job.deleteMany({
      _id: { $in: allJobIds }
    });
    jobsDeleted = deleteResult.deletedCount;
  }

  // Update project count
  if (elementsDeleted > 0) {
    await Task.findByIdAndUpdate(
      uploadSession.project,
      { $inc: { structuralElementsCount: -elementsDeleted } }
    );
  }

  // Delete the upload session itself
  await UploadSession.deleteOne({ _id: uploadSessionId });

  // Invalidate cache
  await invalidateCache(`/api/structural-elements?project=${uploadSession.project}`);
  await invalidateCache(`/api/projects/${uploadSession.project}/stats`);

  console.log(`✅ [DELETE] Deleted upload session - ${elementsDeleted} elements, ${jobsDeleted} jobs`);

  return {
    uploadId: uploadSession.uploadId,
    elementsDeleted,
    jobsDeleted,
    batchesDeleted: uploadSession.totalBatches
  };
}

/**
 * Retry all failed batches in an upload session
 */
async function retryFailedBatches(uploadSessionId) {
  const uploadSession = await UploadSession.findById(uploadSessionId);
  if (!uploadSession) {
    throw new Error('Upload session not found');
  }

  const failedBatches = uploadSession.getFailedBatches();
  
  if (failedBatches.length === 0) {
    return {
      message: 'No failed batches to retry',
      batchesMarkedForRetry: 0
    };
  }

  console.log(`🔄 [RETRY] Marking ${failedBatches.length} failed batches for retry`);

  uploadSession.retryAllFailed();
  await uploadSession.save();

  console.log(`✅ [RETRY] ${failedBatches.length} batches marked for retry`);

  return {
    message: `${failedBatches.length} batches marked for retry`,
    batchesMarkedForRetry: failedBatches.length,
    uploadId: uploadSession.uploadId
  };
}

/**
 * Retry a specific batch
 */
async function retryBatch(uploadSessionId, batchNumber) {
  const uploadSession = await UploadSession.findById(uploadSessionId);
  if (!uploadSession) {
    throw new Error('Upload session not found');
  }

  const batch = uploadSession.batches.find(b => b.batchNumber === batchNumber);
  if (!batch) {
    throw new Error(`Batch ${batchNumber} not found`);
  }

  if (batch.status !== 'failed') {
    throw new Error(`Batch ${batchNumber} is not in failed status (current: ${batch.status})`);
  }

  // Clean up any partial data from failed batch
  if (batch.elementsCreated.length > 0 || batch.jobsCreated.length > 0) {
    await deleteBatch(uploadSessionId, batchNumber);
  }

  console.log(`🔄 [RETRY] Marking batch ${batchNumber} for retry`);

  uploadSession.retryBatch(batchNumber);
  await uploadSession.save();

  console.log(`✅ [RETRY] Batch ${batchNumber} marked for retry`);

  return {
    message: `Batch ${batchNumber} marked for retry`,
    batchNumber,
    uploadId: uploadSession.uploadId
  };
}

module.exports = {
  cleanupFailedBatches,
  deleteBatch,
  deleteUploadSession,
  retryFailedBatches,
  retryBatch
};
