const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const StructuralElement = require('../models/StructuralElement');
const Task = require('../models/Task');
const { auth, adminAuth } = require('../middleware/auth');
const { cacheMiddleware, invalidateCache, jobsCacheKeyGenerator, statsCacheKeyGenerator } = require('../middleware/cache');
const { addProgressJob } = require('../utils/queue');

// Debug middleware to log all requests
router.use((req, res, next) => {
  console.log(`=== JOBS ROUTER DEBUG: ${req.method} ${req.originalUrl} ===`);
  next();
});

/**
 * Helper function to determine structural element status based on its jobs
 * Rules:
 * 1. If element has no fireProofingWorkflow -> 'no_job'
 * 2. If any job is 'not_applicable' (non-clearance) -> 'non clearance'
 * 3. If all jobs are 'completed' -> 'complete'
 * 4. Otherwise -> 'active'
 */
async function updateStructuralElementStatus(elementId) {
  console.log(`🚨 FUNCTION ENTRY - updateStructuralElementStatus called with elementId: ${elementId}`);
  try {
    console.log(`🔄 Checking element status for ${elementId}`);
    const element = await StructuralElement.findById(elementId);
    if (!element) {
      console.log(`❌ Element ${elementId} not found`);
      return;
    }

    let newStatus = null;

    // Rule 1: No fireProofingWorkflow -> 'no_job'
    if (!element.fireProofingWorkflow) {
      newStatus = 'no_job';
      console.log(`📋 Element ${elementId}: No fireProofingWorkflow -> no_job`);
    } else {
      // Get all jobs for this element
      const jobs = await Job.find({ structuralElement: elementId });
      console.log(`📋 Element ${elementId}: Found ${jobs.length} jobs`);
      
      if (jobs.length === 0) {
        // Has workflow but no jobs created yet -> no_job
        newStatus = 'no_job';
        console.log(`📋 Element ${elementId}: No jobs found -> no_job`);
      } else {
        // Log job statuses
        const statusCounts = jobs.reduce((acc, job) => {
          acc[job.status] = (acc[job.status] || 0) + 1;
          return acc;
        }, {});
        console.log(`📋 Element ${elementId}: Job statuses:`, JSON.stringify(statusCounts));
        
        // Rule 2: If any job is 'not_applicable' -> 'non clearance'
        const hasNonClearance = jobs.some(job => job.status === 'not_applicable');
        if (hasNonClearance) {
          newStatus = 'non clearance';
          console.log(`📋 Element ${elementId}: Has not_applicable jobs -> non clearance`);
        } else {
          // Rule 3: If all jobs are 'completed' -> 'complete'
          const allCompleted = jobs.every(job => job.status === 'completed');
          if (allCompleted) {
            newStatus = 'complete';
            console.log(`📋 Element ${elementId}: All jobs completed -> complete`);
          } else {
            // Otherwise -> 'active'
            newStatus = 'active';
            console.log(`📋 Element ${elementId}: Mixed statuses -> active`);
          }
        }
      }
    }

    // Update status if changed
    if (newStatus && element.status !== newStatus) {
      await StructuralElement.findByIdAndUpdate(
        elementId,
        { status: newStatus },
        { runValidators: true }
      );
      console.log(`✅ Element ${elementId}: ${element.status} -> ${newStatus}`);
    } else {
      console.log(`ℹ️  Element ${elementId}: Status unchanged (${element.status})`);
    }
  } catch (error) {
    console.error(`❌ Error updating structural element ${elementId} status:`, error.message);
    console.error(error.stack);
  }
}

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

// Bulk create predefined jobs for multiple structural elements
router.post('/bulk-create', auth, async (req, res) => {
  try {
    const { elementIds, jobType } = req.body;

    // Validate required fields
    if (!elementIds || !Array.isArray(elementIds) || elementIds.length === 0) {
      return res.status(400).json({ 
        message: 'Element IDs array is required and cannot be empty' 
      });
    }

    if (!jobType) {
      return res.status(400).json({ 
        message: 'Job type is required' 
      });
    }

    // Verify all structural elements exist and get their project info
    const elements = await StructuralElement.find({ 
      _id: { $in: elementIds } 
    }).populate('project');

    if (elements.length !== elementIds.length) {
      return res.status(404).json({ 
        message: 'Some structural elements were not found' 
      });
    }

    const results = [];
    const errors = [];

    // Process each element
    for (const element of elements) {
      try {
        // Check if jobs of this type already exist for this element
        const existingJobs = await Job.find({
          structuralElement: element._id,
          jobType: jobType
        });

        if (existingJobs.length > 0) {
          errors.push({
            elementId: element._id,
            structureNumber: element.structureNumber,
            message: `Jobs of type '${jobType}' already exist`
          });
          continue;
        }

        // Create predefined jobs for this element
        const createdJobs = await Job.createPredefinedJobs(
          jobType,
          element._id,
          element.project._id,
          req.user.id
        );

        results.push({
          elementId: element._id,
          structureNumber: element.structureNumber,
          jobsCreated: createdJobs.length,
          jobs: createdJobs
        });

      } catch (error) {
        errors.push({
          elementId: element._id,
          structureNumber: element.structureNumber,
          message: error.message
        });
      }
    }

    const successCount = results.length;
    const errorCount = errors.length;
    const totalJobsCreated = results.reduce((sum, result) => sum + result.jobsCreated, 0);

    // Invalidate cache for this project
    await invalidateCache(`cache:jobs:project:${project}:*`);
    await invalidateCache(`cache:stats:project:${project}`);

    res.status(200).json({
      message: `Bulk job creation completed. Successfully processed ${successCount}/${elementIds.length} elements.`,
      summary: {
        totalElements: elementIds.length,
        successCount,
        errorCount,
        totalJobsCreated
      },
      results,
      errors
    });

  } catch (error) {
    console.error('Error in bulk job creation:', error);
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
      jobType,
      parentFireproofingType,
      orderIndex
    } = req.body;

    console.log('🚀 Creating job with data:', {
      structuralElement,
      project,
      jobTitle,
      jobType,
      parentFireproofingType,
      orderIndex: orderIndex || 'not provided'
    });

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

    // Determine the order index
    let finalOrderIndex;
    if (orderIndex !== undefined && orderIndex !== null) {
      // Use the provided orderIndex from frontend calculation
      finalOrderIndex = orderIndex;
      console.log('📍 Using provided orderIndex:', finalOrderIndex);
    } else {
      // Fallback to auto-increment behavior
      const existingJobs = await Job.find({ structuralElement }).sort({ orderIndex: -1 }).limit(1);
      finalOrderIndex = existingJobs.length > 0 ? (existingJobs[0].orderIndex || 0) + 10 : 100;
      console.log('📍 Auto-generated orderIndex:', finalOrderIndex);
    }

    // Create the job with simplified fields
    const job = new Job({
      structuralElement,
      project,
      jobTitle,
      jobDescription: jobTitle, // Use job title as description
      jobType,
      parentFireproofingType, // For custom jobs, track parent workflow
      priority: 'medium', // Default priority
      orderIndex: finalOrderIndex, // Use calculated order index
      createdBy: req.user.id
    });

    console.log('💾 Saving job with orderIndex:', finalOrderIndex);
    await job.save();
    
    // Populate the response
    await job.populate([
      { path: 'structuralElement', select: 'structureNumber memberType partMarkNo' },
      { path: 'assignedTo', select: 'name email' },
      { path: 'createdBy', select: 'name email' }
    ]);

    // Invalidate cache for this project
    await invalidateCache(`cache:jobs:project:${job.project}:*`);
    await invalidateCache(`cache:stats:project:${job.project}`);

    res.status(201).json(job);
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all jobs (with filters) - NO CACHING to prevent confusion with job status updates
router.get('/', auth, async (req, res) => {
  try {
    const startTime = Date.now();
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
      
      const projectIds = userProjects.map(p => p._id.toString());
      
      // If a specific project is requested, verify access and use it
      if (project) {
        if (projectIds.includes(project.toString())) {
          filter.project = project;
        } else {
          // User doesn't have access to the requested project
          return res.json({
            jobs: [],
            pagination: {
              currentPage: parseInt(page),
              totalPages: 0,
              totalJobs: 0,
              hasNext: false,
              hasPrev: false
            }
          });
        }
      } else {
        // No specific project requested, show all accessible projects
        filter.project = { $in: projectIds };
      }
    } else {
      // Admin can see all projects, use project filter if provided
      if (project) filter.project = project;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const jobs = await Job.find(filter)
      .populate('structuralElement', 'structureNumber memberType partMarkNo gridNo')
      .populate('project', 'title projectName')
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(); // Use lean() for faster queries when not modifying documents

    const totalJobs = await Job.countDocuments(filter);
    
    const queryTime = Date.now() - startTime;
    console.log(`Jobs query completed in ${queryTime}ms - Found ${jobs.length} jobs (total: ${totalJobs})`);

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

// Get job statistics for a project (fast aggregation) - NO CACHING
router.get('/stats/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const mongoose = require('mongoose');
    
    const stats = await Job.aggregate([
      { $match: { project: new mongoose.Types.ObjectId(projectId) } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          not_applicable: {
            $sum: { $cond: [{ $eq: ['$status', 'not_applicable'] }, 1, 0] }
          },
          pending: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$status', 'pending'] },
                    { $eq: ['$status', 'in_progress'] },
                    { $eq: ['$status', null] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    res.json(stats[0] || { total: 0, completed: 0, not_applicable: 0, pending: 0 });
  } catch (error) {
    console.error('Error fetching job stats:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get job groups with aggregated counts (optimized for large datasets)
router.get('/groups', auth, async (req, res) => {
  try {
    const { project } = req.query;

    if (!project) {
      return res.status(400).json({ message: 'Project ID is required' });
    }

    // Build filter for user access control
    const mongoose = require('mongoose');
    const filter = { project: new mongoose.Types.ObjectId(project) };
    
    if (req.user.role !== 'admin') {
      const userProjects = await Task.find({
        $or: [
          { createdBy: req.user.id },
          { assignedTo: req.user.id },
          { assignedEngineers: req.user.id }
        ]
      }).select('_id');
      
      const projectIds = userProjects.map(p => p._id.toString());
      if (!projectIds.includes(project)) {
        return res.status(403).json({ message: 'Access denied to this project' });
      }
    }

    // MongoDB aggregation pipeline for efficient grouping
    const pipeline = [
      { $match: filter },
      {
        $lookup: {
          from: 'structuralelements',
          localField: 'structuralElement',
          foreignField: '_id',
          as: 'structuralElementData'
        }
      },
      {
        $addFields: {
          section: { $arrayElemAt: ['$structuralElementData.gridNo', 0] },
          memberType: { $arrayElemAt: ['$structuralElementData.memberType', 0] }
        }
      },
      {
        $group: {
          _id: {
            section: '$section',
            jobType: '$jobType'
          },
          totalJobs: { $sum: 1 },
          pendingJobs: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          completedJobs: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          nonClearanceJobs: {
            $sum: { $cond: [{ $eq: ['$status', 'non clearance'] }, 1, 0] }
          },
          lastUpdated: { $max: '$updatedAt' }
        }
      },
      {
        $project: {
          _id: 0,
          groupKey: {
            $concat: [
              { $ifNull: ['$_id.section', 'Unknown Section'] },
              ' - ',
              { $ifNull: ['$_id.jobType', 'Unknown Type'] }
            ]
          },
          section: { $ifNull: ['$_id.section', 'Unknown Section'] },
          jobType: { $ifNull: ['$_id.jobType', 'Unknown Type'] },
          totalJobs: 1,
          pendingJobs: 1,
          completedJobs: 1,
          nonClearanceJobs: 1,
          lastUpdated: 1
        }
      },
      { $sort: { section: 1, jobType: 1 } }
    ];

    const groups = await Job.aggregate(pipeline);

    // Get total job count for this project
    const totalJobs = await Job.countDocuments(filter);

    res.json({
      groups,
      totalJobs,
      groupCount: groups.length
    });
  } catch (error) {
    console.error('Error fetching job groups:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get jobs for a specific group (with pagination)
router.get('/group-jobs', auth, async (req, res) => {
  try {
    const { project, section, jobType, page = 1, limit = 50 } = req.query;

    if (!project || !section || !jobType) {
      return res.status(400).json({ message: 'Project, section, and jobType are required' });
    }

    // Build filter
    const filter = { 
      project: project,
      jobType: jobType
    };

    // Add section filter (need to lookup structural element)
    const jobs = await Job.find(filter)
      .populate('structuralElement', 'gridNo memberType partMarkNo structureNumber')
      .populate('project', 'title')
      .populate('createdBy', 'name email')
      .sort({ orderIndex: 1, stepNumber: 1, createdAt: -1 })
      .lean();

    // Filter by section after population (more efficient than complex aggregation for single group)
    const filteredJobs = jobs.filter(job => 
      (job.structuralElement?.gridNo || 'Unknown Section') === section
    );

    // Apply pagination to filtered results
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedJobs = filteredJobs.slice(skip, skip + parseInt(limit));

    res.json({
      jobs: paginatedJobs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(filteredJobs.length / parseInt(limit)),
        totalJobs: filteredJobs.length,
        hasNext: skip + parseInt(limit) < filteredJobs.length,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Error fetching group jobs:', error);
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

// Reorder jobs via drag and drop
router.put('/reorder', auth, async (req, res) => {
  try {
    const { structuralElement, jobOrder } = req.body;

    // Validate input
    if (!structuralElement || !Array.isArray(jobOrder)) {
      return res.status(400).json({ message: 'Structural element ID and job order array are required' });
    }

    console.log('=== JOB REORDER DEBUG ===');
    console.log('Structural Element:', structuralElement);
    console.log('New Job Order:', jobOrder);

    // Get all jobs for this structural element
    const allJobs = await Job.find({ structuralElement });
    
    if (allJobs.length === 0) {
      return res.status(404).json({ message: 'No jobs found for this structural element' });
    }

    console.log('Found jobs:', allJobs.length);

    // Update orderIndex for all jobs based on the new order
    const updatePromises = [];
    
    jobOrder.forEach((jobId, index) => {
      const job = allJobs.find(j => j._id.toString() === jobId);
      if (job) {
        const newOrderIndex = index + 1;
        if (job.orderIndex !== newOrderIndex) {
          console.log(`Updating job ${job.jobTitle} from order ${job.orderIndex} to ${newOrderIndex}`);
          updatePromises.push(
            Job.findByIdAndUpdate(jobId, { orderIndex: newOrderIndex })
          );
        }
      }
    });

    await Promise.all(updatePromises);

    res.json({ 
      success: true, 
      message: 'Jobs reordered successfully' 
    });

  } catch (error) {
    console.error('Error reordering jobs:', error);
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
    
    console.log(`=== UPDATE JOB DEBUG: jobId=${jobId}, updates=`, JSON.stringify(updates));
    console.log(`=== UPDATE JOB DEBUG: user=`, JSON.stringify({ id: req.user.id, role: req.user.role }));

    // Find the job
    const job = await Job.findById(jobId);
    if (!job) {
      console.log(`=== UPDATE JOB DEBUG: Job not found for jobId=${jobId}`);
      return res.status(404).json({ message: 'Job not found' });
    }
    
    console.log(`=== UPDATE JOB DEBUG: Found job, createdBy=${job.createdBy}, assignedTo=${job.assignedTo}`);

    // Check permissions - admin, creator, assigned user, or site-engineer can update
    const canUpdate = req.user.role === 'admin' || 
                     req.user.role === 'site-engineer' ||
                     job.createdBy.toString() === req.user.id || 
                     (job.assignedTo && job.assignedTo.toString() === req.user.id);
    
    if (!canUpdate) {
      console.log(`=== UPDATE JOB DEBUG: Permission denied for user ${req.user.id}`);
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

    // Invalidate cache for this project
    await invalidateCache(`cache:jobs:project:${updatedJob.project}:*`);
    await invalidateCache(`cache:jobs:project:all:*`); // Also invalidate 'all' project cache
    await invalidateCache(`cache:stats:project:${updatedJob.project}`);
    
    // Invalidate structural element job cache
    if (updatedJob.structuralElement) {
      await invalidateCache(`cache:structural:jobs:${updatedJob.structuralElement._id || updatedJob.structuralElement}`);
      await invalidateCache(`cache:structural:summary:${updatedJob.project}:*`);
    }

    console.log('🚀 BEFORE STATUS UPDATE CHECK - updatedJob.structuralElement:', updatedJob.structuralElement);

    // Update structural element status based on job statuses (non-blocking)
    if (updatedJob.structuralElement) {
      const elementId = updatedJob.structuralElement._id || updatedJob.structuralElement;
      console.log('🎯 CALLING updateStructuralElementStatus with elementId:', elementId);
      updateStructuralElementStatus(elementId).catch(err => 
        console.error('❌ Failed to update structural element status:', err)
      );
    } else {
      console.log('⚠️ NO STRUCTURAL ELEMENT FOUND ON UPDATED JOB');
    }

    // Trigger progress calculation if job was just completed
    if (updates.status === 'completed' && job.status !== 'completed') {
      console.log(`📊 Job completed, triggering progress calculation for project ${updatedJob.project}`);
      addProgressJob(updatedJob.project.toString()).catch(err => 
        console.error('Failed to queue progress job:', err)
      );
    }

    console.log(`=== UPDATE JOB DEBUG: Job updated successfully, id=${updatedJob._id}, status=${updatedJob.status}`);
    res.json(updatedJob);
  } catch (error) {
    console.error('Error updating job:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Move job up or down in order
router.put('/:id/move', auth, async (req, res) => {
  try {
    const jobId = req.params.id;
    const { direction, structuralElement } = req.body;

    console.log('=== JOB MOVE DEBUG ===');
    console.log('Job ID:', jobId);
    console.log('Direction:', direction);
    console.log('Structural Element:', structuralElement);

    // Validate input
    if (!direction || !['up', 'down'].includes(direction)) {
      return res.status(400).json({ message: 'Direction must be "up" or "down"' });
    }

    if (!structuralElement) {
      return res.status(400).json({ message: 'Structural element ID is required' });
    }

    // Find the job to move
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    console.log('Found job:', job.jobTitle, 'Step:', job.stepNumber);

    // Check permissions
    if (req.user.role !== 'admin' && 
        job.createdBy.toString() !== req.user.id && 
        (!job.assignedTo || job.assignedTo.toString() !== req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to move this job' });
    }

    // Get all jobs for this structural element
    const allJobs = await Job.find({ 
      structuralElement: structuralElement 
    });
    
    console.log('All jobs for element:', allJobs.length);
    allJobs.forEach(j => console.log(`  - ${j.jobTitle} (Step: ${j.stepNumber})`));
    
    // Separate jobs with step numbers and custom jobs, then sort each group
    const regularJobs = allJobs
      .filter(job => job.stepNumber != null)
      .sort((a, b) => (a.stepNumber || 0) - (b.stepNumber || 0));
    
    const customJobs = allJobs
      .filter(job => job.stepNumber == null)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    console.log('Regular jobs:', regularJobs.length, 'Custom jobs:', customJobs.length);
    
    // Combine them - regular jobs first, then custom jobs
    const sortedJobs = [...regularJobs, ...customJobs];

    // Find the current job's position in the sorted array
    const currentIndex = sortedJobs.findIndex(j => j._id.toString() === jobId);
    if (currentIndex === -1) {
      return res.status(404).json({ message: 'Job not found in structural element jobs' });
    }

    // Calculate new position
    let newIndex;
    if (direction === 'up') {
      if (currentIndex === 0) {
        return res.status(400).json({ message: 'Job is already at the top' });
      }
      newIndex = currentIndex - 1;
    } else {
      if (currentIndex === sortedJobs.length - 1) {
        return res.status(400).json({ message: 'Job is already at the bottom' });
      }
      newIndex = currentIndex + 1;
    }

    // Swap positions
    const jobToMove = sortedJobs[currentIndex];
    const jobAtNewPosition = sortedJobs[newIndex];

    console.log('Current job:', jobToMove.jobTitle, 'Step:', jobToMove.stepNumber);
    console.log('Target job:', jobAtNewPosition.jobTitle, 'Step:', jobAtNewPosition.stepNumber);

    // If both jobs have step numbers, swap them
    if (jobToMove.stepNumber && jobAtNewPosition.stepNumber) {
      const tempStep = jobToMove.stepNumber;
      console.log(`Swapping steps: ${jobToMove.stepNumber} <-> ${jobAtNewPosition.stepNumber}`);
      await Job.findByIdAndUpdate(jobToMove._id, { stepNumber: jobAtNewPosition.stepNumber });
      await Job.findByIdAndUpdate(jobAtNewPosition._id, { stepNumber: tempStep });
      console.log('Step numbers swapped successfully');
    } else {
      // For jobs without step numbers (custom jobs), we'll update their creation order
      // by slightly adjusting their createdAt timestamp
      const now = new Date();
      if (direction === 'up') {
        // Move the job slightly before the previous job
        const prevJobDate = new Date(jobAtNewPosition.createdAt);
        const newDate = new Date(prevJobDate.getTime() - 1000); // 1 second before
        await Job.findByIdAndUpdate(jobToMove._id, { createdAt: newDate });
      } else {
        // Move the job slightly after the next job
        const nextJobDate = new Date(jobAtNewPosition.createdAt);
        const newDate = new Date(nextJobDate.getTime() + 1000); // 1 second after
        await Job.findByIdAndUpdate(jobToMove._id, { createdAt: newDate });
      }
    }

    res.json({ 
      success: true, 
      message: `Job moved ${direction} successfully` 
    });

  } catch (error) {
    console.error('Error moving job:', error);
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
    
    // Invalidate relevant caches
    await invalidateCache(`cache:jobs:project:${updatedJob.project}:*`);
    await invalidateCache(`cache:stats:project:${updatedJob.project}`);
    if (updatedJob.structuralElement) {
      await invalidateCache(`cache:structural:jobs:${updatedJob.structuralElement}`);
      await invalidateCache(`cache:structural:summary:${updatedJob.project}:*`);
    }
    
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

// PATCH /:id/status - Update only job status (for quick status changes)
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const jobId = req.params.id;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }
    
    const validStatuses = ['pending', 'in_progress', 'completed', 'on_hold', 'cancelled', 'not_applicable'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    // Find the job
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Check permissions
    const canUpdate = req.user.role === 'admin' || 
                     req.user.role === 'site-engineer' ||
                     job.createdBy.toString() === req.user.id || 
                     (job.assignedTo && job.assignedTo.toString() === req.user.id);
    
    if (!canUpdate) {
      return res.status(403).json({ message: 'Not authorized to update this job' });
    }

    // Update status and related fields
    const updates = { status };
    if (status === 'completed') {
      updates.completedDate = new Date();
      updates.progressPercentage = 100;
    } else if (status === 'not_applicable' || status === 'cancelled') {
      updates.completedDate = new Date();
    }

    const updatedJob = await Job.findByIdAndUpdate(
      jobId,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate([
      { path: 'structuralElement', select: 'structureNumber memberType partMarkNo status' },
      { path: 'assignedTo', select: 'name email' },
      { path: 'createdBy', select: 'name email' }
    ]);

    // Invalidate cache
    await invalidateCache(`cache:jobs:project:${updatedJob.project}:*`);
    await invalidateCache(`cache:stats:project:${updatedJob.project}`);
    if (updatedJob.structuralElement) {
      await invalidateCache(`cache:structural:jobs:${updatedJob.structuralElement._id || updatedJob.structuralElement}`);
      await invalidateCache(`cache:structural:summary:${updatedJob.project}:*`);
    }

    // Trigger progress calculation if job was completed
    if (status === 'completed') {
      addProgressJob(updatedJob.project.toString()).catch(err => 
        console.error('Failed to queue progress job:', err)
      );
    }

    res.json(updatedJob);
  } catch (error) {
    console.error('Error updating job status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /custom - Create a custom job and insert it at specific position
router.post('/custom', auth, async (req, res) => {
  try {
    const {
      structuralElement,
      project,
      jobTitle,
      jobDescription,
      parentFireproofingType,
      insertAfterJobId, // Insert after this job (optional)
      assignedTo,
      dueDate,
      priority = 'medium'
    } = req.body;

    // Validate required fields
    if (!structuralElement || !project || !jobTitle || !jobDescription) {
      return res.status(400).json({ 
        message: 'structuralElement, project, jobTitle, and jobDescription are required' 
      });
    }

    // Verify structural element exists
    const element = await StructuralElement.findById(structuralElement);
    if (!element) {
      return res.status(404).json({ message: 'Structural element not found' });
    }

    // Get all jobs for this element to determine orderIndex
    const existingJobs = await Job.find({ structuralElement })
      .sort({ orderIndex: 1 })
      .lean();

    let newOrderIndex = 0;

    if (insertAfterJobId) {
      // Find the job to insert after
      const insertAfterJob = existingJobs.find(j => j._id.toString() === insertAfterJobId);
      if (!insertAfterJob) {
        return res.status(404).json({ message: 'Job to insert after not found' });
      }

      // Set new order index between the job and the next one
      const insertAfterIndex = insertAfterJob.orderIndex;
      const nextJob = existingJobs.find(j => j.orderIndex > insertAfterIndex);
      
      if (nextJob) {
        // Insert between two jobs - use average
        newOrderIndex = (insertAfterIndex + nextJob.orderIndex) / 2;
      } else {
        // Insert at the end
        newOrderIndex = insertAfterIndex + 1;
      }
    } else {
      // Insert at the end
      if (existingJobs.length > 0) {
        const maxOrderIndex = Math.max(...existingJobs.map(j => j.orderIndex));
        newOrderIndex = maxOrderIndex + 1;
      }
    }

    // Create the custom job
    const customJob = new Job({
      structuralElement,
      project,
      jobTitle,
      jobDescription,
      jobType: 'custom',
      parentFireproofingType: parentFireproofingType || element.fireProofingWorkflow,
      status: 'pending',
      priority,
      orderIndex: newOrderIndex,
      createdBy: req.user.id,
      assignedTo: assignedTo || null,
      dueDate: dueDate || null
    });

    await customJob.save();

    // Populate the job
    const populatedJob = await Job.findById(customJob._id).populate([
      { path: 'structuralElement', select: 'structureNumber memberType partMarkNo' },
      { path: 'assignedTo', select: 'name email' },
      { path: 'createdBy', select: 'name email' }
    ]);

    // Invalidate cache
    await invalidateCache(`cache:jobs:project:${project}:*`);
    await invalidateCache(`cache:stats:project:${project}`);
    await invalidateCache(`cache:structural:jobs:${structuralElement}`);
    await invalidateCache(`cache:structural:summary:${project}:*`);

    res.status(201).json(populatedJob);
  } catch (error) {
    console.error('Error creating custom job:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// DELETE /:id - Delete a job (only custom jobs)
router.delete('/:id', auth, async (req, res) => {
  try {
    const jobId = req.params.id;

    // Find the job
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Only allow deletion of custom jobs
    if (job.jobType !== 'custom') {
      return res.status(403).json({ message: 'Only custom jobs can be deleted' });
    }

    // Check permissions
    const canDelete = req.user.role === 'admin' || 
                     req.user.role === 'site-engineer' ||
                     job.createdBy.toString() === req.user.id;
    
    if (!canDelete) {
      return res.status(403).json({ message: 'Not authorized to delete this job' });
    }

    const projectId = job.project;
    const structuralElementId = job.structuralElement;

    // Delete the job
    await Job.findByIdAndDelete(jobId);

    // Invalidate cache
    await invalidateCache(`cache:jobs:project:${projectId}:*`);
    await invalidateCache(`cache:stats:project:${projectId}`);
    await invalidateCache(`cache:structural:jobs:${structuralElementId}`);
    await invalidateCache(`cache:structural:summary:${projectId}:*`);

    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Refresh structural element status based on jobs
router.post('/refresh-element-status/:elementId', auth, async (req, res) => {
  try {
    const elementId = req.params.elementId;
    
    console.log(`🔄 Manual refresh element status requested for: ${elementId}`);
    
    // Call the update function and wait for it
    await updateStructuralElementStatus(elementId);
    
    // Get updated element
    const element = await StructuralElement.findById(elementId);
    if (!element) {
      return res.status(404).json({ message: 'Element not found' });
    }
    
    // Invalidate ALL related caches to ensure UI refreshes
    await invalidateCache(`cache:structural:summary:${element.project}:*`);
    await invalidateCache(`cache:grouping:*`); // Invalidate all grouping cache
    await invalidateCache(`cache:structural:elements:*`); // Invalidate element lists
    
    // Recalculate subproject statistics if element belongs to a subproject
    if (element.subProject) {
      console.log(`📊 Recalculating statistics for subproject: ${element.subProject}`);
      const SubProject = require('../models/SubProject');
      await SubProject.recalculateStatistics(element.subProject);
      console.log(`✅ Subproject statistics updated`);
    }
    
    console.log(`✅ Element ${elementId} status updated to: ${element.status}, caches invalidated`);
    
    res.json({ 
      message: 'Element status refreshed successfully',
      status: element.status 
    });
  } catch (error) {
    console.error('Error refreshing element status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;