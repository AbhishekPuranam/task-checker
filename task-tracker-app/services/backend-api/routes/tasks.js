const express = require('express');
const Task = require('../models/Task');
const Job = require('../models/Job');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Get project progress by surface area completion
router.get('/:id/progress', auth, async (req, res) => {
  try {
    const project = await Task.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Check access permissions
    if (req.user.role === 'engineer' && !project.assignedEngineers.includes(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const progress = await project.calculateSurfaceAreaProgress();
    
    res.json({
      projectId: project._id,
      projectTitle: project.title,
      projectStatus: project.status,
      progress
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Get all tasks (with filtering and pagination)
router.get('/', auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      priority,
      category,
      assignedTo,
      createdBy,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (createdBy) filter.createdBy = createdBy;
    
    // If user is engineer, only show projects they have access to
    if (req.user.role === 'engineer') {
      filter.$or = [
        { createdBy: req.user.id },
        { assignedTo: req.user.id },
        { assignedEngineers: req.user.id }
      ];
    }
    
    // Add search functionality
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const tasks = await Task.find(filter)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .populate('assignedEngineers', 'name email role department')
      .populate('completedBy', 'name email role')
      .populate('comments.user', 'name email')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Calculate status for each project based on jobs - excluding "no jobs" status
    const tasksWithStatus = await Promise.all(tasks.map(async (task) => {
      const jobs = await Job.find({ project: task._id });
      
      let calculatedStatus;
      if (jobs.length === 0) {
        // Don't show "no jobs" at project level - use original status or default
        calculatedStatus = task.status || 'pending';
      } else {
        const hasAnyPending = jobs.some(job => 
          job.status === 'pending' || job.status === 'in_progress' || job.status === 'on_hold'
        );
        const allCompleted = jobs.every(job => job.status === 'completed');
        
        if (allCompleted) {
          calculatedStatus = 'complete';
        } else if (hasAnyPending) {
          calculatedStatus = 'pending';
        } else {
          calculatedStatus = 'pending'; // Default if no clear status
        }
      }
      
      // Return task with calculated status
      const taskObj = task.toObject();
      taskObj.status = calculatedStatus;
      return taskObj;
    }));

    const total = await Task.countDocuments(filter);

    res.json({
      tasks: tasksWithStatus,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get project by name slug
router.get('/by-name/:projectName', auth, async (req, res) => {
  try {
    const { projectName } = req.params;
    
    // Convert slug back to title format for searching
    const searchTitle = projectName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    // Try to find by exact title match first, then by case-insensitive search
    let task = await Task.findOne({ title: searchTitle })
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .populate('completedBy', 'name email role')
      .populate('comments.user', 'name email');

    if (!task) {
      // Try case-insensitive search
      task = await Task.findOne({ 
        title: { $regex: new RegExp('^' + searchTitle + '$', 'i') } 
      })
        .populate('createdBy', 'name email role')
        .populate('assignedTo', 'name email role')
        .populate('completedBy', 'name email role')
        .populate('comments.user', 'name email');
    }

    if (!task) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json(task);
  } catch (error) {
    console.error('Error fetching project by name:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all engineers for project assignment (admin only)
router.get('/engineers', adminAuth, async (req, res) => {
  try {
    const engineers = await User.find({ role: 'engineer', isActive: true })
      .select('_id name email department')
      .sort({ name: 1 });
    
    res.json(engineers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single task
router.get('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .populate('assignedEngineers', 'name email role department')
      .populate('completedBy', 'name email role')
      .populate('comments.user', 'name email')
      .populate('statusHistory.changedBy', 'name email');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has permission to view this task
    if (req.user.role === 'engineer') {
      const hasAccess = task.createdBy._id.toString() === req.user.id ||
                       (task.assignedTo && task.assignedTo._id.toString() === req.user.id) ||
                       (task.assignedEngineers && task.assignedEngineers.includes(req.user.id));
      
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    res.json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new task (admin only)
router.post('/', adminAuth, upload.array('attachments', 5), async (req, res) => {
  try {
    const {
      title,
      description,
      priority,
      category,
      location,
      assignedTo,
      dueDate,
      estimatedHours,
      materials,
      structuralData
    } = req.body;

    // Prepare attachments
    const attachments = req.files ? req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    })) : [];

    // Parse materials if provided as JSON string
    let parsedMaterials = [];
    if (materials) {
      try {
        parsedMaterials = JSON.parse(materials);
      } catch (e) {
        parsedMaterials = [];
      }
    }

    const task = new Task({
      title,
      description,
      priority,
      category,
      location,
      assignedTo: assignedTo || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      estimatedHours,
      materials: parsedMaterials,
      attachments,
      structuralData: structuralData || {},
      createdBy: req.user.id,
      statusHistory: [{
        status: 'pending',
        changedBy: req.user.id,
        note: 'Task created'
      }]
    });

    await task.save();
    
    // Populate the task before sending response
    await task.populate('createdBy', 'name email role');
    if (assignedTo) {
      await task.populate('assignedTo', 'name email role');
    }

    // Emit socket event for real-time updates
    req.io.emit('task-created', task);

    res.status(201).json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update task (admin only)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const {
      title,
      description,
      status,
      priority,
      category,
      location,
      assignedTo,
      dueDate,
      estimatedHours,
      actualHours,
      materials
    } = req.body;

    // Track status changes
    if (status && status !== task.status) {
      task.statusHistory.push({
        status,
        changedBy: req.user.id,
        note: `Status changed from ${task.status} to ${status}`
      });
      
      if (status === 'completed') {
        task.completedAt = new Date();
        task.completedBy = req.user.id;
      }
    }

    // Update fields
    if (title) task.title = title;
    if (description) task.description = description;
    if (status) task.status = status;
    if (priority) task.priority = priority;
    if (category) task.category = category;
    if (location) task.location = location;
    if (assignedTo !== undefined) task.assignedTo = assignedTo || null;
    if (dueDate) task.dueDate = new Date(dueDate);
    if (estimatedHours) task.estimatedHours = estimatedHours;
    if (actualHours) task.actualHours = actualHours;
    if (materials) task.materials = materials;

    await task.save();
    
    // Populate the updated task
    await task.populate('createdBy', 'name email role');
    await task.populate('assignedTo', 'name email role');
    await task.populate('completedBy', 'name email role');

    // Emit socket event for real-time updates
    req.io.emit('task-updated', task);

    res.json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add comment to task
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const { text } = req.body;
    
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check permissions
    if (req.user.role === 'engineer') {
      if (task.createdBy.toString() !== req.user.id && 
          (!task.assignedTo || task.assignedTo.toString() !== req.user.id)) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    task.comments.push({
      user: req.user.id,
      text
    });

    await task.save();
    await task.populate('comments.user', 'name email');

    // Emit socket event for real-time updates
    req.io.emit('task-comment-added', {
      taskId: task._id,
      comment: task.comments[task.comments.length - 1]
    });

    res.json(task.comments[task.comments.length - 1]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete task (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    await Task.findByIdAndDelete(req.params.id);

    // Emit socket event for real-time updates
    req.io.emit('task-deleted', req.params.id);

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get task statistics (admin only)
router.get('/stats/overview', adminAuth, async (req, res) => {
  try {
    const stats = await Task.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const priorityStats = await Task.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    const categoryStats = await Task.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      statusStats: stats,
      priorityStats,
      categoryStats
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Project Access Management Endpoints

// Assign engineers to project (admin only)
router.post('/:id/assign-engineers', adminAuth, async (req, res) => {
  try {
    const { engineerIds } = req.body;
    
    if (!Array.isArray(engineerIds)) {
      return res.status(400).json({ message: 'engineerIds must be an array' });
    }

    // Validate that all provided IDs are valid engineers
    const validEngineers = await User.find({
      _id: { $in: engineerIds },
      role: 'engineer',
      isActive: true
    });

    if (validEngineers.length !== engineerIds.length) {
      return res.status(400).json({ message: 'Some engineer IDs are invalid or inactive' });
    }

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { assignedEngineers: engineerIds },
      { new: true }
    ).populate('assignedEngineers', 'name email department');

    if (!task) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json({ 
      message: 'Engineers assigned successfully',
      project: task,
      assignedEngineers: task.assignedEngineers
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get assigned engineers for a project (admin only)
router.get('/:id/assigned-engineers', adminAuth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedEngineers', 'name email department')
      .select('assignedEngineers title');

    if (!task) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json({
      projectId: task._id,
      projectTitle: task.title,
      assignedEngineers: task.assignedEngineers || []
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove engineer from project (admin only)
router.delete('/:id/remove-engineer/:engineerId', adminAuth, async (req, res) => {
  try {
    const { id: projectId, engineerId } = req.params;

    const task = await Task.findByIdAndUpdate(
      projectId,
      { $pull: { assignedEngineers: engineerId } },
      { new: true }
    ).populate('assignedEngineers', 'name email department');

    if (!task) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json({ 
      message: 'Engineer removed successfully',
      assignedEngineers: task.assignedEngineers
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Fix project status by recalculating based on actual element/job completion
router.post('/:id/fix-status', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check permissions (admin or creator)
    if (req.user.role !== 'admin' && task.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to fix this project' });
    }

    const statusBefore = task.status;
    
    // Force update project status based on current element/job state
    await task.updateProjectStatus();
    
    // Reload to get updated status
    await task.reload();
    
    res.json({
      message: 'Project status updated successfully',
      statusBefore,
      statusAfter: task.status,
      updated: statusBefore !== task.status
    });
  } catch (error) {
    console.error('Error fixing project status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;