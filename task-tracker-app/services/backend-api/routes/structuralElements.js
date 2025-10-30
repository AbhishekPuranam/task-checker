const express = require('express');
const StructuralElement = require('../models/StructuralElement');
const { auth, adminAuth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/structural/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Get all structural elements (with filtering and pagination)
router.get('/', auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      project,
      status,
      memberType,
      projectName,
      level,
      search,
      sortBy = 'serialNo',
      sortOrder = 'asc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (project) filter.project = project;
    if (status) filter.status = status;
    if (memberType) filter.memberType = memberType;
    if (projectName) filter.projectName = { $regex: projectName, $options: 'i' };
    if (level) filter.level = level;
    
    // Add search functionality
    if (search) {
      filter.$or = [
        { serialNo: { $regex: search, $options: 'i' } },
        { structureNumber: { $regex: search, $options: 'i' } },
        { drawingNo: { $regex: search, $options: 'i' } },
        { partMarkNo: { $regex: search, $options: 'i' } },
        { gridNo: { $regex: search, $options: 'i' } }
      ];
    }

    // If user is engineer, only show elements from projects they have access to
    if (req.user.role === 'engineer') {
      const Task = require('../models/Task');
      const userProjects = await Task.find({
        $or: [
          { createdBy: req.user.id },
          { assignedTo: req.user.id },
          { assignedEngineers: req.user.id }
        ]
      }).select('_id');
      
      const projectIds = userProjects.map(p => p._id);
      filter.project = { $in: projectIds };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const elements = await StructuralElement.find(filter)
      .populate('createdBy', 'name email role')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await StructuralElement.countDocuments(filter);

    res.json({
      elements,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single structural element
router.get('/:id', auth, async (req, res) => {
  try {
    const element = await StructuralElement.findById(req.params.id)
      .populate('createdBy', 'name email role');

    if (!element) {
      return res.status(404).json({ message: 'Structural element not found' });
    }

    res.json(element);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new structural element
router.post('/', auth, upload.array('attachments', 5), async (req, res) => {
  try {
    const {
      project,
      serialNo,
      structureNumber,
      drawingNo,
      level,
      memberType,
      gridNo,
      partMarkNo,
      sectionSizes,
      lengthMm,
      qty,
      sectionDepthMm,
      sectionWidthMm,
      sectionWebThicknessMm,
      sectionFlangeThicknessMm,
      unitWeightKgPerM,
      totalWeightKg,
      surfaceAreaSqm,
      projectName,
      siteLocation,
      notes
    } = req.body;

    // Check if serialNo already exists
    const existingElement = await StructuralElement.findOne({ serialNo });
    if (existingElement) {
      return res.status(400).json({ message: 'Serial number already exists' });
    }

    // Prepare attachments
    const attachments = req.files ? req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    })) : [];

    const element = new StructuralElement({
      project,
      serialNo,
      structureNumber,
      drawingNo,
      level,
      memberType,
      gridNo,
      partMarkNo,
      sectionSizes,
      lengthMm: lengthMm ? Number(lengthMm) : null,
      qty: qty ? Number(qty) : null,
      sectionDepthMm: sectionDepthMm ? Number(sectionDepthMm) : null,
      sectionWidthMm: sectionWidthMm ? Number(sectionWidthMm) : null,
      sectionWebThicknessMm: sectionWebThicknessMm ? Number(sectionWebThicknessMm) : null,
      sectionFlangeThicknessMm: sectionFlangeThicknessMm ? Number(sectionFlangeThicknessMm) : null,
      unitWeightKgPerM: unitWeightKgPerM ? Number(unitWeightKgPerM) : null,
      totalWeightKg: totalWeightKg ? Number(totalWeightKg) : null,
      surfaceAreaSqm: surfaceAreaSqm ? Number(surfaceAreaSqm) : null,
      projectName: projectName || 'Default Project',
      siteLocation: siteLocation || 'Default Site',
      notes,
      attachments,
      createdBy: req.user.id
    });

    await element.save();
    
    // Populate the element before sending response
    await element.populate('createdBy', 'name email role');

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.emit('structural-element-created', element);
    }

    res.status(201).json(element);
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Serial number already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Update structural element (admin only)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const element = await StructuralElement.findById(req.params.id);
    
    if (!element) {
      return res.status(404).json({ message: 'Structural element not found' });
    }

    // Update allowed fields
    const updateFields = [
      'structureNumber', 'drawingNo', 'level', 'memberType', 'gridNo',
      'partMarkNo', 'sectionSizes', 'lengthMm', 'quantity', 'sectionDepthMm',
      'flangeWidthMm', 'webThicknessMm', 'flangeThicknessMm', 'fireproofingThickness',
      'surfaceAreaSqm', 'projectName', 'siteLocation', 'notes', 'status'
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (['lengthMm', 'quantity', 'sectionDepthMm', 'flangeWidthMm', 'webThicknessMm', 
             'flangeThicknessMm', 'fireproofingThickness', 'surfaceAreaSqm'].includes(field)) {
          element[field] = Number(req.body[field]);
        } else {
          element[field] = req.body[field];
        }
      }
    });

    const oldStatus = element.status;
    await element.save();
    
    // If status changed, update project status
    if (req.body.status && req.body.status !== oldStatus) {
      const Task = require('../models/Task');
      const project = await Task.findById(element.project);
      if (project) {
        await project.updateProjectStatus();
      }
    }
    
    // Populate the updated element
    await element.populate('createdBy', 'name email role');

    // Emit socket event for real-time updates
    req.io.emit('structural-element-updated', element);

    res.json(element);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete structural element (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const element = await StructuralElement.findById(req.params.id);
    
    if (!element) {
      return res.status(404).json({ message: 'Structural element not found' });
    }

    // Delete associated jobs
    const Job = require('../models/Job');
    await Job.deleteMany({ structuralElement: req.params.id });

    await StructuralElement.findByIdAndDelete(req.params.id);

    // Emit socket event for real-time updates
    req.io.emit('structural-element-deleted', req.params.id);

    res.json({ message: 'Structural element and associated jobs deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Bulk delete structural elements (admin only)
router.post('/bulk-delete', adminAuth, async (req, res) => {
  try {
    const { elementIds } = req.body;
    
    if (!Array.isArray(elementIds) || elementIds.length === 0) {
      return res.status(400).json({ message: 'No element IDs provided' });
    }

    // Delete associated jobs for all elements
    const Job = require('../models/Job');
    const jobDeleteResult = await Job.deleteMany({ 
      structuralElement: { $in: elementIds } 
    });

    // Delete the structural elements
    const deleteResult = await StructuralElement.deleteMany({
      _id: { $in: elementIds }
    });

    // Emit socket event for real-time updates
    req.io.emit('structural-elements-bulk-deleted', elementIds);

    res.json({ 
      message: `${deleteResult.deletedCount} structural elements and ${jobDeleteResult.deletedCount} associated jobs deleted successfully`,
      deletedElements: deleteResult.deletedCount,
      deletedJobs: jobDeleteResult.deletedCount
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get structural elements for dropdown (engineers selecting elements for jobs)
router.get('/list/active', auth, async (req, res) => {
  try {
    const elements = await StructuralElement.find({ status: 'active' })
      .select('serialNo structureNumber drawingNo level memberType gridNo partMarkNo projectName')
      .sort({ serialNo: 1 });
    
    res.json(elements);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Bulk import structural elements (admin only)
router.post('/bulk-import', adminAuth, async (req, res) => {
  try {
    const { elements } = req.body;
    
    if (!Array.isArray(elements) || elements.length === 0) {
      return res.status(400).json({ message: 'No elements provided' });
    }

    // Add createdBy to all elements
    const elementsWithCreator = elements.map(element => ({
      ...element,
      createdBy: req.user.id
    }));

    const result = await StructuralElement.insertMany(elementsWithCreator, { 
      ordered: false // Continue inserting even if some fail
    });

    res.json({ 
      message: `${result.length} structural elements imported successfully`,
      imported: result.length 
    });
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'Some serial numbers already exist. Check for duplicates.' 
      });
    }
    res.status(500).json({ message: 'Server error during import' });
  }
});

module.exports = router;