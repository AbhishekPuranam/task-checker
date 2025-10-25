const express = require('express');
const mongoose = require('mongoose');
const Task = require('../models/Task'); // Task model is used as Project model
const StructuralElement = require('../models/StructuralElement');
const Job = require('../models/Job');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get all projects
router.get('/', auth, async (req, res) => {
  try {
    const { limit, sortBy = 'createdAt', sortOrder = 'desc', search } = req.query;
    
    let query = {};
    
    // Add search functionality if search term provided
    if (search) {
      query = {
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { location: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]
      };
    }
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Execute query
    let projectsQuery = Task.find(query).sort(sort);
    
    if (limit && !isNaN(parseInt(limit))) {
      projectsQuery = projectsQuery.limit(parseInt(limit));
    }
    
    const projects = await projectsQuery;
    
    res.json({ tasks: projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get project by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const project = await Task.findById(req.params.id);
    
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
    
    // First try exact match
    let project = await Task.findOne({ title: projectName });
    
    // If not found and projectName looks like a slug, try to find by converting slug to title
    if (!project && projectName.includes('-')) {
      const titleFromSlug = projectName
        .split('-')
        .map(word => word.toUpperCase())
        .join(' ');
      project = await Task.findOne({ title: titleFromSlug });
    }
    
    // If still not found, try case-insensitive search
    if (!project) {
      project = await Task.findOne({ 
        title: { $regex: new RegExp(`^${projectName.replace(/[-\s]/g, '\\s*')}$`, 'i') }
      });
    }
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
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
    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required' });
    }
    
    // Check if project with same title already exists
    const existingProject = await Task.findOne({ title: title.trim() });
    if (existingProject) {
      return res.status(400).json({ message: 'Project with this title already exists' });
    }
    
    // Create new project
    const project = new Task({
      title: title.trim(),
      description: description.trim(),
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

// Get engineers for project assignment (admin only)
router.get('/engineers', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const User = require('../models/User');
    const engineers = await User.find({ role: 'site-engineer' }, { _id: 1, name: 1, username: 1, email: 1 });
    
    res.json(engineers);
  } catch (error) {
    console.error('Error fetching engineers:', error);
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

// Assign engineers to project (admin only)
router.post('/:id/assign-engineers', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const { engineerIds } = req.body;
    
    const project = await Task.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    project.assignedEngineers = engineerIds;
    await project.save();
    
    res.json({ message: 'Engineers assigned successfully' });
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