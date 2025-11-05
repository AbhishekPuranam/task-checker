const mongoose = require('mongoose');

const UploadSessionSchema = new mongoose.Schema({
  uploadId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
    index: true
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  fileName: {
    type: String,
    required: true
  },
  
  filePath: {
    type: String,
    required: true
  },
  
  totalRows: {
    type: Number,
    required: true
  },
  
  totalBatches: {
    type: Number,
    required: true
  },
  
  batchSize: {
    type: Number,
    default: 50
  },
  
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'partial_success', 'failed'],
    default: 'in_progress',
    index: true
  },
  
  batches: [{
    batchNumber: {
      type: Number,
      required: true
    },
    startRow: {
      type: Number,
      required: true
    },
    endRow: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'success', 'failed'],
      default: 'pending'
    },
    elementsCreated: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StructuralElement'
    }],
    jobsCreated: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job'
    }],
    duplicatesSkipped: {
      type: Number,
      default: 0
    },
    errorMessage: String,
    errorDetails: mongoose.Schema.Types.Mixed,
    processedAt: Date,
    retryCount: {
      type: Number,
      default: 0
    }
  }],
  
  summary: {
    successfulBatches: {
      type: Number,
      default: 0
    },
    failedBatches: {
      type: Number,
      default: 0
    },
    pendingBatches: {
      type: Number,
      default: 0
    },
    totalElementsCreated: {
      type: Number,
      default: 0
    },
    totalJobsCreated: {
      type: Number,
      default: 0
    },
    duplicatesSkipped: {
      type: Number,
      default: 0
    }
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  completedAt: Date,
  
  lastProcessedAt: Date
}, {
  timestamps: true
});

// Indexes for efficient queries
UploadSessionSchema.index({ project: 1, status: 1 });
UploadSessionSchema.index({ createdBy: 1, createdAt: -1 });
UploadSessionSchema.index({ uploadId: 1, project: 1 });

// Methods

/**
 * Update batch status and summary
 */
UploadSessionSchema.methods.updateBatchStatus = function(batchNumber, status, data = {}) {
  const batch = this.batches.find(b => b.batchNumber === batchNumber);
  if (!batch) {
    throw new Error(`Batch ${batchNumber} not found`);
  }
  
  batch.status = status;
  batch.processedAt = new Date();
  
  if (data.elementsCreated) {
    batch.elementsCreated = data.elementsCreated;
  }
  if (data.jobsCreated) {
    batch.jobsCreated = data.jobsCreated;
  }
  if (data.duplicatesSkipped !== undefined) {
    batch.duplicatesSkipped = data.duplicatesSkipped;
  }
  if (data.errorMessage) {
    batch.errorMessage = data.errorMessage;
  }
  if (data.errorDetails) {
    batch.errorDetails = data.errorDetails;
  }
  
  // Update summary
  this.updateSummary();
  this.lastProcessedAt = new Date();
};

/**
 * Recalculate summary from batch statuses
 */
UploadSessionSchema.methods.updateSummary = function() {
  let successfulBatches = 0;
  let failedBatches = 0;
  let pendingBatches = 0;
  let totalElementsCreated = 0;
  let totalJobsCreated = 0;
  let duplicatesSkipped = 0;
  
  this.batches.forEach(batch => {
    if (batch.status === 'success') {
      successfulBatches++;
      totalElementsCreated += batch.elementsCreated.length;
      totalJobsCreated += batch.jobsCreated.length;
      duplicatesSkipped += batch.duplicatesSkipped || 0;
    } else if (batch.status === 'failed') {
      failedBatches++;
    } else if (batch.status === 'pending') {
      pendingBatches++;
    }
  });
  
  this.summary = {
    successfulBatches,
    failedBatches,
    pendingBatches,
    totalElementsCreated,
    totalJobsCreated,
    duplicatesSkipped
  };
  
  // Update overall status
  if (failedBatches === 0 && pendingBatches === 0) {
    this.status = 'completed';
    this.completedAt = new Date();
  } else if (successfulBatches > 0 && failedBatches > 0) {
    this.status = 'partial_success';
  } else if (failedBatches === this.totalBatches) {
    this.status = 'failed';
  } else {
    this.status = 'in_progress';
  }
};

/**
 * Get failed batches
 */
UploadSessionSchema.methods.getFailedBatches = function() {
  return this.batches.filter(b => b.status === 'failed');
};

/**
 * Get pending batches
 */
UploadSessionSchema.methods.getPendingBatches = function() {
  return this.batches.filter(b => b.status === 'pending');
};

/**
 * Get successful batches
 */
UploadSessionSchema.methods.getSuccessfulBatches = function() {
  return this.batches.filter(b => b.status === 'success');
};

/**
 * Mark batch for retry (reset to pending)
 */
UploadSessionSchema.methods.retryBatch = function(batchNumber) {
  const batch = this.batches.find(b => b.batchNumber === batchNumber);
  if (!batch) {
    throw new Error(`Batch ${batchNumber} not found`);
  }
  
  batch.status = 'pending';
  batch.errorMessage = null;
  batch.errorDetails = null;
  batch.retryCount++;
  
  this.updateSummary();
};

/**
 * Retry all failed batches
 */
UploadSessionSchema.methods.retryAllFailed = function() {
  this.batches.forEach(batch => {
    if (batch.status === 'failed') {
      batch.status = 'pending';
      batch.errorMessage = null;
      batch.errorDetails = null;
      batch.retryCount++;
    }
  });
  
  this.updateSummary();
};

// Static methods

/**
 * Create new upload session with batches
 */
UploadSessionSchema.statics.createSession = async function(data) {
  const { uploadId, projectId, userId, fileName, filePath, totalRows, batchSize = 50 } = data;
  
  const totalBatches = Math.ceil(totalRows / batchSize);
  const batches = [];
  
  for (let i = 0; i < totalBatches; i++) {
    batches.push({
      batchNumber: i + 1,
      startRow: i * batchSize + 1,
      endRow: Math.min((i + 1) * batchSize, totalRows),
      status: 'pending'
    });
  }
  
  const session = new this({
    uploadId,
    project: projectId,
    createdBy: userId,
    fileName,
    filePath,
    totalRows,
    totalBatches,
    batchSize,
    batches
  });
  
  session.updateSummary();
  return await session.save();
};

/**
 * Find session by upload ID
 */
UploadSessionSchema.statics.findByUploadId = function(uploadId) {
  return this.findOne({ uploadId });
};

/**
 * Get recent sessions for a project
 */
UploadSessionSchema.statics.getRecentSessions = function(projectId, limit = 10) {
  return this.find({ project: projectId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('createdBy', 'name email')
    .lean();
};

/**
 * Get sessions by user
 */
UploadSessionSchema.statics.getUserSessions = function(userId, limit = 20) {
  return this.find({ createdBy: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('project', 'title')
    .lean();
};

module.exports = mongoose.model('UploadSession', UploadSessionSchema);
