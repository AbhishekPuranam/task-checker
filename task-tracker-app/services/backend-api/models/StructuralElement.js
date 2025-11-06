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
// IMPORTANT: Compound unique index to prevent duplicate serialNo within the same project
// Different projects CAN have elements with the same serialNo
structuralElementSchema.index({ project: 1, serialNo: 1 }, { unique: true });
structuralElementSchema.index({ project: 1, structureNumber: 1 });
structuralElementSchema.index({ subProject: 1, status: 1 }); // New index for SubProject queries
structuralElementSchema.index({ subProject: 1, serialNo: 1 }); // New index for SubProject queries
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