const mongoose = require('mongoose');

/**
 * Transaction wrapper for database operations with automatic rollback
 * Ensures atomicity for complex multi-collection operations
 */
class DatabaseTransaction {
  constructor() {
    this.session = null;
    this.createdDocuments = {
      structuralElements: [],
      jobs: [],
    };
    this.originalCacheState = [];
    this.isActive = false;
  }

  /**
   * Start a new transaction session
   */
  async start() {
    try {
      this.session = await mongoose.startSession();
      this.session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary'
      });
      this.isActive = true;
      console.log('🔄 [TRANSACTION] Started new transaction');
      return this.session;
    } catch (error) {
      console.error('❌ [TRANSACTION] Failed to start transaction:', error.message);
      throw new Error(`Failed to start transaction: ${error.message}`);
    }
  }

  /**
   * Track created structural elements
   */
  trackStructuralElement(elementId) {
    this.createdDocuments.structuralElements.push(elementId);
  }

  /**
   * Track created jobs
   */
  trackJob(jobId) {
    this.createdDocuments.jobs.push(jobId);
  }

  /**
   * Get transaction session for use in mongoose operations
   */
  getSession() {
    if (!this.isActive || !this.session) {
      throw new Error('Transaction is not active');
    }
    return this.session;
  }

  /**
   * Commit the transaction
   */
  async commit() {
    if (!this.isActive || !this.session) {
      throw new Error('No active transaction to commit');
    }

    try {
      await this.session.commitTransaction();
      console.log(`✅ [TRANSACTION] Committed successfully - Created ${this.createdDocuments.structuralElements.length} structural elements and ${this.createdDocuments.jobs.length} jobs`);
      this.isActive = false;
      return {
        structuralElements: this.createdDocuments.structuralElements.length,
        jobs: this.createdDocuments.jobs.length
      };
    } catch (error) {
      console.error('❌ [TRANSACTION] Commit failed:', error.message);
      await this.rollback();
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Rollback the transaction
   */
  async rollback() {
    if (!this.session) {
      console.warn('⚠️ [TRANSACTION] No session to rollback');
      return;
    }

    try {
      if (this.isActive) {
        await this.session.abortTransaction();
        console.log(`🔙 [TRANSACTION] Rolled back - Prevented ${this.createdDocuments.structuralElements.length} structural elements and ${this.createdDocuments.jobs.length} jobs from being saved`);
      }
      this.isActive = false;
    } catch (error) {
      console.error('❌ [TRANSACTION] Rollback error:', error.message);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Cleanup session resources
   */
  async cleanup() {
    if (this.session) {
      try {
        await this.session.endSession();
        console.log('🧹 [TRANSACTION] Session cleaned up');
      } catch (error) {
        console.error('⚠️ [TRANSACTION] Error during cleanup:', error.message);
      }
      this.session = null;
    }
    this.createdDocuments = {
      structuralElements: [],
      jobs: [],
    };
  }

  /**
   * Get transaction statistics
   */
  getStats() {
    return {
      isActive: this.isActive,
      structuralElements: this.createdDocuments.structuralElements.length,
      jobs: this.createdDocuments.jobs.length,
      totalOperations: this.createdDocuments.structuralElements.length + this.createdDocuments.jobs.length
    };
  }
}

/**
 * Execute a function within a transaction with automatic rollback on error
 * @param {Function} operation - Async function that receives the transaction object
 * @returns {Promise} Result of the operation
 */
async function executeInTransaction(operation) {
  const transaction = new DatabaseTransaction();
  
  try {
    await transaction.start();
    const result = await operation(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    console.error('❌ [TRANSACTION] Operation failed, rolling back:', error.message);
    await transaction.rollback();
    throw error;
  }
}

/**
 * Cleanup orphaned documents from failed uploads
 * @param {string} projectId - Project ID to clean up
 * @param {Date} since - Clean up documents created after this date
 */
async function cleanupOrphanedDocuments(projectId, since) {
  const StructuralElement = require('../models/StructuralElement');
  const Job = require('../models/Job');
  
  try {
    console.log(`🧹 [CLEANUP] Starting cleanup for project ${projectId} since ${since}`);
    
    // Find structural elements without associated jobs (potential orphans)
    const orphanedElements = await StructuralElement.find({
      project: projectId,
      createdAt: { $gte: since },
    });

    let cleanedElements = 0;
    let cleanedJobs = 0;

    for (const element of orphanedElements) {
      // Check if element has associated jobs
      const jobCount = await Job.countDocuments({
        structuralElement: element._id
      });

      // If element has fireProofingWorkflow but no jobs, it's orphaned
      if (element.fireProofingWorkflow && jobCount === 0) {
        await StructuralElement.findByIdAndDelete(element._id);
        cleanedElements++;
      }
    }

    // Also clean orphaned jobs (jobs without structural elements)
    const result = await Job.deleteMany({
      project: projectId,
      createdAt: { $gte: since },
      structuralElement: { $exists: false }
    });
    cleanedJobs = result.deletedCount || 0;

    console.log(`✅ [CLEANUP] Cleaned ${cleanedElements} orphaned elements and ${cleanedJobs} orphaned jobs`);
    
    return {
      cleanedElements,
      cleanedJobs,
      totalCleaned: cleanedElements + cleanedJobs
    };
  } catch (error) {
    console.error('❌ [CLEANUP] Cleanup failed:', error.message);
    throw error;
  }
}

module.exports = {
  DatabaseTransaction,
  executeInTransaction,
  cleanupOrphanedDocuments,
};
