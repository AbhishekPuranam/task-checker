const express = require('express');
const mongoose = require('mongoose');
const Task = require('../models/Task'); // Task model is used as Project model
const StructuralElement = require('../models/StructuralElement');
const Job = require('../models/Job');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');
const { addProgressJob } = require('../utils/queue');

const router = express.Router();

// Get all projects (with role-based filtering)
router.get('/', 
  auth,
  cacheMiddleware(300, (req) => {
    const userId = req.user?.id || 'anon';
    const role = req.user?.role || 'anon';
    const { limit, sortBy = 'createdAt', sortOrder = 'desc', search } = req.query;
    return `cache:projects:user:${userId}:role:${role}:limit:${limit || 'all'}:sort:${sortBy}:${sortOrder}:search:${search || 'none'}`;
  }),
  async (req, res) => {
  try {
    const { limit, sortBy = 'createdAt', sortOrder = 'desc', search } = req.query;
    
    let query = {};
    
    // **SECURITY FIX**: Engineers should only see projects assigned to them
    if (req.user.role === 'site-engineer') {
      query.assignedEngineers = req.user.id;
    }
    
    // Add search functionality if search term provided
    if (search) {
      const searchConditions = {
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { location: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]
      };
      
      // Combine with existing query (engineer filter)
      if (query.assignedEngineers) {
        query = { $and: [{ assignedEngineers: query.assignedEngineers }, searchConditions] };
      } else {
        query = searchConditions;
      }
    }
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Execute query
    let projectsQuery = Task.find(query)
      .sort(sort)
      .populate('assignedEngineers', 'name username email');
    
    if (limit && !isNaN(parseInt(limit))) {
      projectsQuery = projectsQuery.limit(parseInt(limit));
    }
    
    const projects = await projectsQuery;
    
    // Use cached progress data (calculated on-demand when elements/jobs change)
    console.log(`📊 Using cached progress for ${projects.length} projects`);
    
    const projectsWithProgress = projects.map(project => {
      const projectObj = project.toJSON();
      
      // Use cached progress if available (calculated when elements/jobs are added/updated)
      if (project.cachedProgress && project.cachedProgress.lastCalculated) {
        projectObj.progress = {
          totalSurfaceArea: project.cachedProgress.totalSurfaceArea || 0,
          completedSurfaceArea: project.cachedProgress.completedSurfaceArea || 0,
          progressPercentage: project.cachedProgress.progressPercentage || 0,
          totalElements: project.cachedProgress.totalElements || 0,
          completedElements: project.cachedProgress.completedElements || 0,
        };
      } else {
        // No cached data yet (new project with no elements), return empty progress
        projectObj.progress = {
          totalSurfaceArea: 0,
          completedSurfaceArea: 0,
          progressPercentage: 0,
          totalElements: 0,
          completedElements: 0,
        };
      }
      
      return projectObj;
    });
    
    res.json({ tasks: projectsWithProgress });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get engineers for project assignment (admin only)
router.get('/engineers', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const engineers = await User.find({ role: 'site-engineer' }, { _id: 1, name: 1, username: 1, email: 1 });
    
    res.json(engineers);
  } catch (error) {
    console.error('Error fetching engineers:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get projects assigned to current engineer (engineer only)
router.get('/my-projects', auth, async (req, res) => {
  try {
    if (req.user.role !== 'site-engineer') {
      return res.status(403).json({ message: 'Access denied. Engineers only.' });
    }
    
    const projects = await Task.find(
      { assignedEngineers: req.user.id },
      { title: 1, description: 1, location: 1, status: 1, dueDate: 1, createdAt: 1 }
    );
    
    res.json(projects);
  } catch (error) {
    console.error('Error fetching engineer projects:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get project by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const project = await Task.findById(req.params.id)
      .populate('assignedEngineers', 'name username email');
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get project by name
router.get('/by-name/:projectName', auth, async (req, res) => {
  try {
    const projectName = decodeURIComponent(req.params.projectName);
    console.log(`🔍 Looking for project: "${projectName}"`);
    
    // First try exact match
    let project = await Task.findOne({ title: projectName });
    if (project) console.log('✅ Found exact match');
    
    // If not found and projectName looks like a slug, try multiple slug-to-title conversions
    if (!project && projectName.includes('-')) {
      // Try different case variations
      const variations = [
        // Original slug with spaces
        projectName.replace(/-/g, ' '),
        // UPPERCASE
        projectName.replace(/-/g, ' ').toUpperCase(),
        // Title Case (first letter of each word capitalized)
        projectName.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' '),
        // Uppercase first letters, lowercase rest
        projectName.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
      ];
      
      console.log('📝 Trying variations:', variations);
      for (const variation of variations) {
        project = await Task.findOne({ title: variation });
        if (project) {
          console.log(`✅ Found with variation: "${variation}"`);
          break;
        }
      }
    }
    
    // If still not found, try case-insensitive regex search with flexible spacing/dashes
    if (!project) {
      console.log('🔄 Trying normalized matching...');
      // Normalize the projectName by removing all spaces and dashes, then match against normalized titles
      // This handles cases like "ncc-aiims" matching "NCC -AIIMS" or "NCC-AIIMS" or "NCC AIIMS"
      const normalized = projectName.replace(/[-\s]+/g, '').toLowerCase();
      console.log(`📊 Normalized search term: "${normalized}"`);
      
      // Find all projects and check normalized versions
      const allProjects = await Task.find({});
      console.log(`📋 Checking ${allProjects.length} projects...`);
      project = allProjects.find(p => {
        const normalizedTitle = p.title.replace(/[-\s]+/g, '').toLowerCase();
        const match = normalizedTitle === normalized;
        if (match) console.log(`✅ Match found: "${p.title}" (normalized: "${normalizedTitle}")`);
        return match;
      });
    }
    
    if (!project) {
      console.log('❌ Project not found after all attempts');
      return res.status(404).json({ message: 'Project not found' });
    }
    
    console.log(`✅ Returning project: ${project.title}`);
    res.json(project);
  } catch (error) {
    console.error('Error fetching project by name:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new project
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, location, category, priority, status, dueDate } = req.body;
    
    // Validation
    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }
    
    // Check if project with same title already exists
    const existingProject = await Task.findOne({ title: title.trim() });
    if (existingProject) {
      return res.status(400).json({ message: 'Project with this title already exists' });
    }
    
    // Create new project
    const project = new Task({
      title: title.trim(),
      description: description?.trim(),
      location: location?.trim(),
      category: category || 'project',
      priority: priority || 'medium',
      status: status || 'pending',
      dueDate: dueDate ? new Date(dueDate) : undefined,
      assignedTo: req.user.id,
      createdBy: req.user.id
    });
    
    await project.save();
    
    res.status(201).json({
      message: 'Project created successfully',
      project: project
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update project
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, description, location, category, priority, status, dueDate } = req.body;
    
    const project = await Task.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Update fields
    if (title) project.title = title.trim();
    if (description) project.description = description.trim();
    if (location !== undefined) project.location = location?.trim();
    if (category) project.category = category;
    if (priority) project.priority = priority;
    if (status) project.status = status;
    if (dueDate !== undefined) project.dueDate = dueDate ? new Date(dueDate) : null;
    
    project.updatedAt = new Date();
    
    await project.save();
    
    res.json({
      message: 'Project updated successfully',
      project: project
    });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete project
router.delete('/:id', auth, async (req, res) => {
  try {
    const project = await Task.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Also delete all related structural elements and jobs
    await StructuralElement.deleteMany({ project: req.params.id });
    await Job.deleteMany({ project: req.params.id });
    
    await Task.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Project and all related data deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get project statistics (admin only)
router.get('/stats/overview', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const totalProjects = await Task.countDocuments();
    const completedProjects = await Task.countDocuments({ status: 'completed' });
    const pendingProjects = await Task.countDocuments({ status: 'pending' });
    const inProgressProjects = await Task.countDocuments({ status: 'in-progress' });
    
    // Get total surface area from all structural elements
    const structuralElements = await StructuralElement.find();
    const totalSurfaceArea = structuralElements.reduce((sum, element) => {
      return sum + (element.structuralData?.surfaceAreaSqm || 0);
    }, 0);
    
    res.json({
      totalProjects,
      completedProjects,
      pendingProjects,
      inProgressProjects,
      totalSurfaceArea
    });
  } catch (error) {
    console.error('Error fetching project statistics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get assigned engineers for a project
router.get('/:id/assigned-engineers', auth, async (req, res) => {
  try {
    const project = await Task.findById(req.params.id).populate('assignedEngineers', '_id name username email');
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    res.json(project.assignedEngineers || []);
  } catch (error) {
    console.error('Error fetching assigned engineers:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Assign engineers to a project (admin only)
router.put('/:id/assign-engineers', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admins only.' });
    }

    const { engineerUsernames } = req.body;

    // Convert usernames to ObjectIds
    const engineers = await User.find({ username: { $in: engineerUsernames } }, '_id');
    const engineerIds = engineers.map(eng => eng._id);

    const updatedProject = await Task.findByIdAndUpdate(
      req.params.id,
      { assignedEngineers: engineerIds },
      { new: true }
    ).populate('assignedEngineers', 'name username email');

    if (!updatedProject) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json(updatedProject);
  } catch (error) {
    console.error('Error assigning engineers:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove engineer from project (admin only)
router.delete('/:id/remove-engineer/:engineerId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const project = await Task.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    project.assignedEngineers = project.assignedEngineers.filter(
      engineerId => engineerId.toString() !== req.params.engineerId
    );
    
    await project.save();
    
    res.json({ message: 'Engineer removed successfully' });
  } catch (error) {
    console.error('Error removing engineer:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;