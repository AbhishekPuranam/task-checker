const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  // Basic task information
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: false
  },
  category: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  
  // Link to structural element (optional - for referencing existing structural elements)
  structuralElement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StructuralElement',
    required: false
  },
  
  // Direct structural engineering data (from your Excel format)
  structuralData: {
    serialNo: String,
    structureNumber: String,
    drawingNo: String,
    level: String,
    memberType: String,
    gridNo: String,
    partMarkNo: String,
    sectionSizes: String,
    lengthMm: Number,
    qty: Number,
    sectionDepthMm: Number,
    flangeWidthMm: Number,
    webThicknessMm: Number,
    flangeThicknessMm: Number,
    fireproofingThickness: Number,
    surfaceAreaSqm: Number
  },
  
  // Legacy fields for compatibility
  jobName: {
    type: String,
    trim: true
  },
  workDescription: {
    type: String
  },
  workType: {
    type: String,
    enum: ['fabrication', 'erection', 'welding', 'painting', 'inspection', 'fireproofing', 'repair', 'other'],
    required: false
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  // Work progress tracking
  progressPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  qualityCheckStatus: {
    type: String,
    enum: ['pending', 'passed', 'failed', 'not_applicable'],
    default: 'pending'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Project access control - engineers who can access this project
  assignedEngineers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  dueDate: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  estimatedHours: {
    type: Number,
    min: 0
  },
  actualHours: {
    type: Number,
    min: 0
  },
  materials: [{
    name: String,
    quantity: Number,
    unit: String,
    cost: Number
  }],
  attachments: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  statusHistory: [{
    status: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
taskSchema.index({ status: 1 });
taskSchema.index({ createdBy: 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ category: 1 });
taskSchema.index({ priority: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ createdAt: -1 });

// Virtual for color coding (like your Excel system)
taskSchema.virtual('colorCode').get(function() {
  if (this.status === 'completed') return 'blue'; // Admin completed work
  if (this.status === 'pending' && this.createdBy) return 'yellow'; // New jobs by engineers
  if (this.status === 'in_progress') return 'orange';
  if (this.status === 'cancelled') return 'red';
  return 'gray';
});

// Surface area progress calculation methods
taskSchema.methods.calculateSurfaceAreaProgress = async function() {
  const StructuralElement = mongoose.model('StructuralElement');
  
  try {
    // Get all structural elements for this project
    const elements = await StructuralElement.find({ project: this._id });
    
    if (elements.length === 0) {
      return {
        totalSurfaceArea: 0,
        completedSurfaceArea: 0,
        progressPercentage: 0,
        totalElements: 0,
        completedElements: 0
      };
    }
    
    const totalSurfaceArea = elements.reduce((sum, element) => 
      sum + (element.surfaceAreaSqm || 0), 0
    );
    
    const completedElements = elements.filter(element => 
      element.status === 'completed'
    );
    
    const completedSurfaceArea = completedElements.reduce((sum, element) => 
      sum + (element.surfaceAreaSqm || 0), 0
    );
    
    const progressPercentage = totalSurfaceArea > 0 
      ? Math.round((completedSurfaceArea / totalSurfaceArea) * 100)
      : 0;
    
    return {
      totalSurfaceArea,
      completedSurfaceArea,
      progressPercentage,
      totalElements: elements.length,
      completedElements: completedElements.length
    };
  } catch (error) {
    console.error('Error calculating surface area progress:', error);
    return {
      totalSurfaceArea: 0,
      completedSurfaceArea: 0,
      progressPercentage: 0,
      totalElements: 0,
      completedElements: 0
    };
  }
};

// Auto-update project status based on element completion
taskSchema.methods.updateProjectStatus = async function() {
  const StructuralElement = mongoose.model('StructuralElement');
  const Job = mongoose.model('Job');
  
  try {
    const elements = await StructuralElement.find({ project: this._id });
    
    if (elements.length === 0) {
      return this; // No elements, keep current status
    }
    
    // Check if ALL elements are truly completed (all their jobs are done)
    let allElementsComplete = true;
    
    for (const element of elements) {
      const jobs = await Job.find({ structuralElement: element._id });
      
      // If element has no jobs, it's not complete
      if (jobs.length === 0) {
        allElementsComplete = false;
        break;
      }
      
      // If any job in this element is not completed, element is not complete
      const allJobsComplete = jobs.every(job => job.status === 'completed');
      if (!allJobsComplete) {
        allElementsComplete = false;
        break;
      }
    }
    
    // Only mark project as completed if ALL elements have ALL their jobs completed
    if (allElementsComplete && this.status !== 'completed') {
      this.status = 'completed';
      this.completedAt = new Date();
      
      // Add to status history
      this.statusHistory.push({
        status: 'completed',
        timestamp: new Date(),
        note: 'Auto-completed: All structural elements and their jobs completed'
      });
      
      await this.save();
      console.log(`✅ Project ${this.title} marked as completed - all elements and jobs done`);
    }
    // If project was marked complete but shouldn't be, change it back to pending
    else if (!allElementsComplete && this.status === 'completed') {
      this.status = 'pending';
      
      // Add to status history
      this.statusHistory.push({
        status: 'pending',
        timestamp: new Date(),
        note: 'Auto-reverted: Not all elements/jobs are completed'
      });
      
      await this.save();
      console.log(`🔄 Project ${this.title} reverted to pending - incomplete elements/jobs found`);
    }
    
    return this;
  } catch (error) {
    console.error('Error updating project status:', error);
    return this;
  }
};

// Ensure virtual fields are serialized
taskSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Task', taskSchema);