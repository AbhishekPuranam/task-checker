const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  // Reference to the structural element this job is for
  structuralElement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StructuralElement',
    required: true
  },
  // Reference to the parent project
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  // Job details
  jobTitle: {
    type: String,
    required: true,
    trim: true
  },
  jobDescription: {
    type: String,
    required: true,
    trim: true
  },
  jobType: {
    type: String,
    enum: [
      'cement_fire_proofing', 
      'gypsum_fire_proofing', 
      'intumescent_coatings', 
      'refinery_fire_proofing'
    ],
    required: true
  },
  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'on_hold', 'cancelled'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  // Step tracking for predefined job sequences
  stepNumber: {
    type: Number,
    min: 1
  },
  totalSteps: {
    type: Number,
    min: 1
  },
  // Time tracking
  estimatedHours: {
    type: Number,
    min: 0
  },
  actualHours: {
    type: Number,
    min: 0
  },
  startDate: {
    type: Date
  },
  dueDate: {
    type: Date
  },
  completedDate: {
    type: Date
  },
  // Personnel
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Quality and completion tracking
  qualityCheckRequired: {
    type: Boolean,
    default: false
  },
  qualityCheckPassed: {
    type: Boolean
  },
  qualityCheckedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  qualityCheckDate: {
    type: Date
  },
  // Notes and comments
  notes: [{
    comment: {
      type: String,
      required: true
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Progress tracking
  progressPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for better query performance
jobSchema.index({ structuralElement: 1 });
jobSchema.index({ project: 1 });
jobSchema.index({ status: 1 });
jobSchema.index({ assignedTo: 1 });
jobSchema.index({ dueDate: 1 });
jobSchema.index({ createdBy: 1 });

// Virtual for overdue jobs
jobSchema.virtual('isOverdue').get(function() {
  return this.dueDate && this.status !== 'completed' && new Date() > this.dueDate;
});

// Method to add a note
jobSchema.methods.addNote = function(comment, userId) {
  this.notes.push({
    comment,
    addedBy: userId
  });
  return this.save();
};

// Method to update progress
jobSchema.methods.updateProgress = function(percentage) {
  this.progressPercentage = Math.max(0, Math.min(100, percentage));
  if (percentage === 100 && this.status === 'in_progress') {
    this.status = 'completed';
    this.completedDate = new Date();
  }
  return this.save();
};

// Static method to get jobs by structural element
jobSchema.statics.getByStructuralElement = function(structuralElementId) {
  return this.find({ structuralElement: structuralElementId })
    .populate('assignedTo', 'name email')
    .populate('createdBy', 'name email')
    .populate('qualityCheckedBy', 'name email')
    .sort({ stepNumber: 1, createdAt: 1 }); // Sort by step number first (ascending), then by creation date
};

// Static method to get jobs by project
jobSchema.statics.getByProject = function(projectId) {
  return this.find({ project: projectId })
    .populate('structuralElement')
    .populate('assignedTo', 'name email')
    .populate('createdBy', 'name email')
    .sort({ stepNumber: 1, dueDate: 1, createdAt: 1 }); // Sort by step number first, then due date, then creation date
};

// Predefined job types and their corresponding jobs in order
jobSchema.statics.getPredefinedJobs = function() {
  return {
    'cement_fire_proofing': [
      'Surface Preparation',
      'Rockwool Filling', 
      'Adhesive coat/Primer',
      'Vermiculite-Cement',
      'Thickness inspection',
      'Sealer coat',
      'WIR'
    ],
    'gypsum_fire_proofing': [
      'Surface Preparation',
      'Rockwool Filling',
      'Adhesive coat/Primer', 
      'Vermiculite-Gypsum',
      'Thickness inspection',
      'Sealer coat',
      'WIR'
    ],
    'intumescent_coatings': [
      'Surface Preparation',
      'Primer',
      'Coat -1',
      'Coat-2',
      'Coat-3', 
      'Coat-4',
      'Coat-5',
      'Thickness inspection',
      'Top Coat'
    ],
    'refinery_fire_proofing': [
      'Scaffolding Errection',
      'Surface Preparation',
      'Primer/Adhesive coat',
      'Mesh',
      'FP 1 Coat',
      'FP Finish coat',
      'Sealer',
      'Top coat Primer',
      'Top coat',
      'Sealant',
      'Inspection',
      'Scaffolding -Dismantling'
    ]
  };
};

// Static method to create predefined jobs for a job type
jobSchema.statics.createPredefinedJobs = async function(jobType, structuralElementId, projectId, createdBy) {
  const predefinedJobs = this.getPredefinedJobs();
  
  if (!predefinedJobs[jobType]) {
    throw new Error(`No predefined jobs found for job type: ${jobType}`);
  }
  
  const jobsToCreate = predefinedJobs[jobType];
  const createdJobs = [];
  
  for (let i = 0; i < jobsToCreate.length; i++) {
    const jobTitle = jobsToCreate[i];
    const stepNumber = i + 1;
    const job = new this({
      structuralElement: structuralElementId,
      project: projectId,
      jobTitle: `Step ${stepNumber}: ${jobTitle}`,
      jobDescription: `${jobTitle} - Step ${stepNumber} of ${jobsToCreate.length} for ${jobType.replace(/_/g, ' ')}`,
      jobType: jobType,
      stepNumber: stepNumber,
      totalSteps: jobsToCreate.length,
      status: i === 0 ? 'pending' : 'pending', // First job can be started, others are pending
      priority: 'medium',
      createdBy: createdBy,
      progressPercentage: 0
    });
    
    const savedJob = await job.save();
    createdJobs.push(savedJob);
  }
  
  return createdJobs;
};

// Static method to get job type display names
jobSchema.statics.getJobTypeDisplayNames = function() {
  return {
    'cement_fire_proofing': 'Cement Fire Proofing',
    'gypsum_fire_proofing': 'Gypsum Fire Proofing', 
    'intumescent_coatings': 'Intumescent Coatings',
    'refinery_fire_proofing': 'Refinery Fire Proofing'
  };
};

module.exports = mongoose.model('Job', jobSchema);