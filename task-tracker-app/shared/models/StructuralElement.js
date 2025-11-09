const mongoose = require('mongoose');

const structuralElementSchema = new mongoose.Schema({
  // Link to parent project (for backward compatibility)
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task', // Using existing Task model as Project
    required: true,
    index: true
  },
  
  // Link to SubProject (new hierarchy)
  subProject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubProject',
    required: false, // Optional for backward compatibility
    index: true
  },
  
  // Excel column data
  serialNo: {
    type: String,
    trim: true
  },
  structureNumber: {
    type: String,
    trim: true
  },
  drawingNo: {
    type: String,
    trim: true
  },
  level: {
    type: String,
    trim: true
  },
  memberType: {
    type: String,
    trim: true
  },
  gridNo: {
    type: String,
    trim: true
  },
  partMarkNo: {
    type: String,
    trim: true
  },
  sectionSizes: {
    type: String,
    trim: true
  },
  lengthMm: {
    type: Number
  },
  qty: {
    type: Number
  },
  sectionDepthMm: {
    type: Number
  },
  flangeWidthMm: {
    type: Number
  },
  webThicknessMm: {
    type: Number
  },
  flangeThicknessMm: {
    type: Number
  },
  fireproofingThickness: {
    type: Number
  },
  surfaceAreaSqm: {
    type: Number
  },
  // Fire Proofing Workflow assignment
  fireProofingWorkflow: {
    type: String,
    enum: [
      'cement_fire_proofing', 
      'gypsum_fire_proofing', 
      'intumescent_coatings', 
      'refinery_fire_proofing'
    ],
    trim: true
  },
  // Status tracking
  status: {
    type: String,
    enum: ['active', 'complete', 'completed', 'non clearance', 'no_job', 'on_hold', 'cancelled'],
    default: 'active',
    index: true
  },
  // Date when status was changed to complete
  completedDate: {
    type: Date,
    index: true
  },
  // Admin who created this entry
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Project/Site information
  projectName: {
    type: String,
    required: true
  },
  siteLocation: {
    type: String,
    required: false
  },
  // Additional notes
  notes: {
    type: String
  },
  // File attachments (drawings, specs, etc.)
  attachments: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
// IMPORTANT: Updated duplicate prevention strategy
// 1. For elements WITH subProject: Check duplicates within subproject only
// 2. For elements WITHOUT subProject (legacy): Check duplicates within project only
// This allows the same element to exist in different subprojects

// Compound indexes for fast queries
structuralElementSchema.index({ subProject: 1, status: 1 }); // Fast subproject filtering
structuralElementSchema.index({ subProject: 1, level: 1 }); // Fast level grouping within subproject
structuralElementSchema.index({ subProject: 1, memberType: 1 }); // Fast member type grouping
structuralElementSchema.index({ subProject: 1, drawingNo: 1 }); // Fast drawing number lookup
structuralElementSchema.index({ subProject: 1, gridNo: 1 }); // Fast grid number lookup
structuralElementSchema.index({ subProject: 1, partMarkNo: 1 }); // Fast part mark lookup
structuralElementSchema.index({ subProject: 1, fireProofingWorkflow: 1 }); // Fast workflow filtering

// Project-level indexes (for backward compatibility and cross-subproject queries)
structuralElementSchema.index({ project: 1, status: 1 });
structuralElementSchema.index({ project: 1, structureNumber: 1 });
structuralElementSchema.index({ project: 1, serialNo: 1 }); // Non-unique, allows duplicates across subprojects

// General indexes for search and filtering
structuralElementSchema.index({ drawingNo: 1 });
structuralElementSchema.index({ level: 1 });
structuralElementSchema.index({ memberType: 1 });
structuralElementSchema.index({ gridNo: 1 });
structuralElementSchema.index({ partMarkNo: 1 });
structuralElementSchema.index({ status: 1 });
structuralElementSchema.index({ createdBy: 1 });
structuralElementSchema.index({ projectName: 1 });
structuralElementSchema.index({ fireProofingWorkflow: 1 });

module.exports = mongoose.model('StructuralElement', structuralElementSchema);