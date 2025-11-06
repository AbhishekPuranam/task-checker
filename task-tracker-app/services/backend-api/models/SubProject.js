const mongoose = require('mongoose');

const subProjectSchema = new mongoose.Schema({
  // Link to parent project (Task model)
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
    index: true
  },
  
  // SubProject basic information
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  code: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  
  description: {
    type: String,
    trim: true
  },
  
  status: {
    type: String,
    enum: ['active', 'on_hold', 'completed', 'cancelled'],
    default: 'active',
    index: true
  },
  
  // Aggregated statistics - calculated by background worker
  statistics: {
    // Total elements counts
    totalElements: {
      type: Number,
      default: 0
    },
    completedElements: {
      type: Number,
      default: 0
    },
    
    // Total surface area
    totalSqm: {
      type: Number,
      default: 0
    },
    completedSqm: {
      type: Number,
      default: 0
    },
    
    // Section-wise counts
    sections: {
      active: {
        count: { type: Number, default: 0 },
        sqm: { type: Number, default: 0 }
      },
      nonClearance: {
        count: { type: Number, default: 0 },
        sqm: { type: Number, default: 0 }
      },
      noJob: {
        count: { type: Number, default: 0 },
        sqm: { type: Number, default: 0 }
      },
      complete: {
        count: { type: Number, default: 0 },
        sqm: { type: Number, default: 0 }
      }
    },
    
    // Last aggregation update
    lastCalculated: {
      type: Date
    }
  },
  
  // Admin who created this subproject
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Additional metadata
  metadata: {
    startDate: Date,
    targetCompletionDate: Date,
    actualCompletionDate: Date,
    notes: String
  }
}, {
  timestamps: true
});

// Compound index for unique subproject codes within a project
subProjectSchema.index({ project: 1, code: 1 }, { unique: true });
subProjectSchema.index({ project: 1, status: 1 });
subProjectSchema.index({ createdBy: 1 });

// Virtual for completion percentage
subProjectSchema.virtual('completionPercentage').get(function() {
  if (this.statistics.totalElements === 0) return 0;
  return Math.round((this.statistics.completedElements / this.statistics.totalElements) * 100);
});

// Virtual for sqm completion percentage
subProjectSchema.virtual('sqmCompletionPercentage').get(function() {
  if (this.statistics.totalSqm === 0) return 0;
  return Math.round((this.statistics.completedSqm / this.statistics.totalSqm) * 100);
});

// Ensure virtuals are included in JSON/Object conversions
subProjectSchema.set('toJSON', { virtuals: true });
subProjectSchema.set('toObject', { virtuals: true });

// Static method to recalculate statistics for a specific subproject
subProjectSchema.statics.recalculateStatistics = async function(subProjectId) {
  const StructuralElement = mongoose.model('StructuralElement');
  
  // Aggregation pipeline to calculate all statistics
  const pipeline = [
    { $match: { subProject: mongoose.Types.ObjectId(subProjectId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalSqm: { $sum: { $ifNull: ['$surfaceAreaSqm', 0] } }
      }
    }
  ];
  
  const results = await StructuralElement.aggregate(pipeline);
  
  // Initialize statistics object
  const stats = {
    totalElements: 0,
    completedElements: 0,
    totalSqm: 0,
    completedSqm: 0,
    sections: {
      active: { count: 0, sqm: 0 },
      nonClearance: { count: 0, sqm: 0 },
      noJob: { count: 0, sqm: 0 },
      complete: { count: 0, sqm: 0 }
    },
    lastCalculated: new Date()
  };
  
  // Process aggregation results
  results.forEach(result => {
    const status = result._id;
    const count = result.count;
    const sqm = result.totalSqm;
    
    stats.totalElements += count;
    stats.totalSqm += sqm;
    
    if (status === 'complete' || status === 'completed') {
      stats.completedElements += count;
      stats.completedSqm += sqm;
      stats.sections.complete.count += count;
      stats.sections.complete.sqm += sqm;
    } else if (status === 'active') {
      stats.sections.active.count += count;
      stats.sections.active.sqm += sqm;
    } else if (status === 'non clearance') {
      stats.sections.nonClearance.count += count;
      stats.sections.nonClearance.sqm += sqm;
    } else if (status === 'no_job') {
      stats.sections.noJob.count += count;
      stats.sections.noJob.sqm += sqm;
    }
  });
  
  // Update the subproject with new statistics
  await this.findByIdAndUpdate(subProjectId, { statistics: stats });
  
  return stats;
};

// Static method to recalculate project-level statistics
subProjectSchema.statics.recalculateProjectStatistics = async function(projectId) {
  const pipeline = [
    { $match: { project: mongoose.Types.ObjectId(projectId) } },
    {
      $group: {
        _id: null,
        totalElements: { $sum: '$statistics.totalElements' },
        completedElements: { $sum: '$statistics.completedElements' },
        totalSqm: { $sum: '$statistics.totalSqm' },
        completedSqm: { $sum: '$statistics.completedSqm' },
        activeSections: { $sum: '$statistics.sections.active.count' },
        activeSqm: { $sum: '$statistics.sections.active.sqm' },
        nonClearanceSections: { $sum: '$statistics.sections.nonClearance.count' },
        nonClearanceSqm: { $sum: '$statistics.sections.nonClearance.sqm' },
        noJobSections: { $sum: '$statistics.sections.noJob.count' },
        noJobSqm: { $sum: '$statistics.sections.noJob.sqm' },
        completeSections: { $sum: '$statistics.sections.complete.count' },
        completeSqm: { $sum: '$statistics.sections.complete.sqm' }
      }
    }
  ];
  
  const results = await this.aggregate(pipeline);
  
  if (results.length === 0) {
    return {
      totalElements: 0,
      completedElements: 0,
      totalSqm: 0,
      completedSqm: 0,
      sections: {
        active: { count: 0, sqm: 0 },
        nonClearance: { count: 0, sqm: 0 },
        noJob: { count: 0, sqm: 0 },
        complete: { count: 0, sqm: 0 }
      }
    };
  }
  
  const result = results[0];
  return {
    totalElements: result.totalElements || 0,
    completedElements: result.completedElements || 0,
    totalSqm: result.totalSqm || 0,
    completedSqm: result.completedSqm || 0,
    sections: {
      active: { count: result.activeSections || 0, sqm: result.activeSqm || 0 },
      nonClearance: { count: result.nonClearanceSections || 0, sqm: result.nonClearanceSqm || 0 },
      noJob: { count: result.noJobSections || 0, sqm: result.noJobSqm || 0 },
      complete: { count: result.completeSections || 0, sqm: result.completeSqm || 0 }
    }
  };
};

module.exports = mongoose.model('SubProject', subProjectSchema);
