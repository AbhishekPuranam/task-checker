const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const StructuralElement = require('../models/StructuralElement');
const Task = require('../models/Task');
const { auth, adminAuth } = require('../middleware/auth');

// Cleanup endpoint - delete all jobs (for development/testing)
router.delete('/cleanup', async (req, res) => {
  try {
    const result = await Job.deleteMany({});
    res.json({ 
      success: true, 
      message: `Deleted ${result.deletedCount} jobs from the database` 
    });
  } catch (error) {
    console.error('Error deleting jobs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get available job types and their display names
router.get('/job-types', auth, async (req, res) => {
  try {
    const jobTypes = Job.getJobTypeDisplayNames();
    const predefinedJobs = Job.getPredefinedJobs();
    
    res.json({
      jobTypes,
      predefinedJobs
    });
  } catch (error) {
    console.error('Error getting job types:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create predefined jobs for a job type
router.post('/create-predefined', auth, async (req, res) => {
  try {
    const { jobType, structuralElement, project } = req.body;

    // Validate required fields
    if (!jobType || !structuralElement || !project) {
      return res.status(400).json({ 
        message: 'Job type, structural element, and project are required' 
      });
    }

    // Verify structural element exists
    const element = await StructuralElement.findById(structuralElement);
    if (!element) {
      return res.status(404).json({ message: 'Structural element not found' });
    }

    // Verify project exists and matches the structural element's project
    const projectDoc = await Task.findById(project);
    if (!projectDoc) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (element.project.toString() !== project) {
      return res.status(400).json({ 
        message: 'Structural element does not belong to this project' 
      });
    }

    // Check if predefined jobs exist for this job type
    const predefinedJobs = Job.getPredefinedJobs();
    if (!predefinedJobs[jobType]) {
      return res.status(400).json({ 
        message: `No predefined jobs available for job type: ${jobType}` 
      });
    }

    // Check if jobs already exist for this structural element and job type
    const existingJobs = await Job.find({ 
      structuralElement, 
      jobType 
    });

    if (existingJobs.length > 0) {
      return res.status(400).json({ 
        message: `Jobs of type '${jobType}' already exist for this structural element` 
      });
    }

    // Create predefined jobs
    const createdJobs = await Job.createPredefinedJobs(
      jobType, 
      structuralElement, 
      project, 
      req.user.id
    );

    // Populate the response
    const populatedJobs = await Job.find({ 
      _id: { $in: createdJobs.map(job => job._id) } 
    }).populate([
      { path: 'structuralElement', select: 'structureNumber memberType partMarkNo' },
      { path: 'assignedTo', select: 'name email' },
      { path: 'createdBy', select: 'name email' }
    ]).sort({ createdAt: 1 });

    res.status(201).json({
      message: `Successfully created ${createdJobs.length} predefined jobs for ${jobType}`,
      jobType,
      jobsCreated: createdJobs.length,
      jobs: populatedJobs
    });
  } catch (error) {
    console.error('Error creating predefined jobs:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create a new job for a structural element
router.post('/', auth, async (req, res) => {
  try {
    const {
      structuralElement,
      project,
      jobTitle,
      jobType
    } = req.body;

    // Validate required fields
    if (!jobTitle || !jobType) {
      return res.status(400).json({ message: 'Job title and job type are required' });
    }

    // Verify structural element exists
    const element = await StructuralElement.findById(structuralElement);
    if (!element) {
      return res.status(404).json({ message: 'Structural element not found' });
    }

    // Verify project exists and matches the structural element's project
    const projectDoc = await Task.findById(project);
    if (!projectDoc) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (element.project.toString() !== project) {
      return res.status(400).json({ message: 'Structural element does not belong to this project' });
    }

    // Create the job with simplified fields
    const job = new Job({
      structuralElement,
      project,
      jobTitle,
      jobDescription: jobTitle, // Use job title as description
      jobType,
      priority: 'medium', // Default priority
      createdBy: req.user.id
    });

    await job.save();
    
    // Populate the response
    await job.populate([
      { path: 'structuralElement', select: 'structureNumber memberType partMarkNo' },
      { path: 'assignedTo', select: 'name email' },
      { path: 'createdBy', select: 'name email' }
    ]);

    res.status(201).json(job);
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all jobs (with filters)
router.get('/', auth, async (req, res) => {
  try {
    const {
      project,
      structuralElement,
      status,
      assignedTo,
      jobType,
      page = 1,
      limit = 20
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (project) filter.project = project;
    if (structuralElement) filter.structuralElement = structuralElement;
    if (status) filter.status = status;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (jobType) filter.jobType = jobType;

    // If not admin, only show jobs for projects user has access to
    if (req.user.role !== 'admin') {
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

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const jobs = await Job.find(filter)
      .populate('structuralElement', 'structureNumber memberType partMarkNo')
      .populate('project', 'title projectName')
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalJobs = await Job.countDocuments(filter);

    res.json({
      jobs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalJobs / parseInt(limit)),
        totalJobs,
        hasNext: skip + parseInt(limit) < totalJobs,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get jobs by structural element
router.get('/by-element/:elementId', auth, async (req, res) => {
  try {
    const { elementId } = req.params;
    
    // Verify structural element exists
    const element = await StructuralElement.findById(elementId);
    if (!element) {
      return res.status(404).json({ message: 'Structural element not found' });
    }

    const jobs = await Job.getByStructuralElement(elementId);
    res.json(jobs);
  } catch (error) {
    console.error('Error fetching jobs by element:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get jobs by project
router.get('/by-project/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Verify project exists
    const project = await Task.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const jobs = await Job.getByProject(projectId);
    res.json(jobs);
  } catch (error) {
    console.error('Error fetching jobs by project:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get a specific job
router.get('/:id', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('structuralElement')
      .populate('project', 'title projectName')
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('qualityCheckedBy', 'name email')
      .populate('notes.addedBy', 'name email');

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update a job
router.put('/:id', auth, async (req, res) => {
  try {
    const jobId = req.params.id;
    const updates = req.body;

    // Find the job
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Check permissions - only creator, assigned user, or admin can update
    if (req.user.role !== 'admin' && 
        job.createdBy.toString() !== req.user.id && 
        (!job.assignedTo || job.assignedTo.toString() !== req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to update this job' });
    }

    // Handle status changes
    if (updates.status === 'completed' && job.status !== 'completed') {
      updates.completedDate = new Date();
      updates.progressPercentage = 100;
    }

    // Handle progress updates
    if (updates.progressPercentage !== undefined) {
      updates.progressPercentage = Math.max(0, Math.min(100, updates.progressPercentage));
      if (updates.progressPercentage === 100 && job.status !== 'completed') {
        updates.status = 'completed';
        updates.completedDate = new Date();
      }
    }

    // Update the job
    const updatedJob = await Job.findByIdAndUpdate(
      jobId,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate([
      { path: 'structuralElement', select: 'structureNumber memberType partMarkNo' },
      { path: 'assignedTo', select: 'name email' },
      { path: 'createdBy', select: 'name email' },
      { path: 'qualityCheckedBy', select: 'name email' }
    ]);

    res.json(updatedJob);
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add a note to a job
router.post('/:id/notes', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ message: 'Comment is required' });
    }

    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    await job.addNote(comment.trim(), req.user.id);
    
    // Return updated job with populated notes
    const updatedJob = await Job.findById(id)
      .populate('notes.addedBy', 'name email');
    
    res.json(updatedJob);
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update job progress
router.patch('/:id/progress', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { progressPercentage } = req.body;

    if (progressPercentage === undefined || progressPercentage < 0 || progressPercentage > 100) {
      return res.status(400).json({ message: 'Progress percentage must be between 0 and 100' });
    }

    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Check permissions
    if (req.user.role !== 'admin' && 
        job.createdBy.toString() !== req.user.id && 
        (!job.assignedTo || job.assignedTo.toString() !== req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to update this job' });
    }

    await job.updateProgress(progressPercentage);
    
    const updatedJob = await Job.findById(id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email');
    
    res.json(updatedJob);
  } catch (error) {
    console.error('Error updating progress:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete a job
router.delete('/:id', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Check permissions - only creator or admin can delete
    if (req.user.role !== 'admin' && job.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this job' });
    }

    await Job.findByIdAndDelete(req.params.id);
    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get job statistics for dashboard
router.get('/stats/dashboard', auth, async (req, res) => {
  try {
    const { projectId } = req.query;
    const filter = {};
    
    if (projectId) {
      filter.project = projectId;
    }

    // If not admin, filter by user's accessible projects
    if (req.user.role !== 'admin') {
      const userProjects = await Task.find({
        $or: [
          { createdBy: req.user.id },
          { assignedUsers: req.user.id }
        ]
      }).select('_id');
      
      const projectIds = userProjects.map(p => p._id);
      filter.project = { $in: projectIds };
    }

    const [
      totalJobs,
      completedJobs,
      inProgressJobs,
      pendingJobs,
      overdueJobs,
      jobsByType,
      jobsByPriority
    ] = await Promise.all([
      Job.countDocuments(filter),
      Job.countDocuments({ ...filter, status: 'completed' }),
      Job.countDocuments({ ...filter, status: 'in_progress' }),
      Job.countDocuments({ ...filter, status: 'pending' }),
      Job.countDocuments({ 
        ...filter, 
        dueDate: { $lt: new Date() }, 
        status: { $nin: ['completed', 'cancelled'] } 
      }),
      Job.aggregate([
        { $match: filter },
        { $group: { _id: '$jobType', count: { $sum: 1 } } }
      ]),
      Job.aggregate([
        { $match: filter },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ])
    ]);

    res.json({
      totalJobs,
      completedJobs,
      inProgressJobs,
      pendingJobs,
      overdueJobs,
      completionRate: totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0,
      jobsByType: jobsByType.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      jobsByPriority: jobsByPriority.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Error fetching job statistics:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;