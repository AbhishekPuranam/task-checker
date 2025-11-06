const express = require('express');
const router = express.Router();
const SubProject = require('../models/SubProject');
const StructuralElement = require('../models/StructuralElement');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const cache = require('../utils/cache');

/**
 * @swagger
 * /api/subprojects:
 *   post:
 *     summary: Create a new SubProject
 *     tags: [SubProjects]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { projectId, name, code, description, metadata } = req.body;
    
    if (!projectId || !name || !code) {
      return res.status(400).json({ 
        error: 'projectId, name, and code are required' 
      });
    }
    
    const subProject = new SubProject({
      project: projectId,
      name,
      code: code.toUpperCase(),
      description,
      metadata,
      createdBy: req.user._id
    });
    
    await subProject.save();
    
    // Invalidate project cache
    await cache.invalidateProject(projectId);
    
    res.status(201).json(subProject);
  } catch (error) {
    console.error('Error creating SubProject:', error);
    
    if (error.code === 11000) {
      return res.status(409).json({ 
        error: 'SubProject code already exists for this project' 
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/subprojects/project/:projectId:
 *   get:
 *     summary: Get all SubProjects for a Project (CACHED)
 *     tags: [SubProjects]
 */
router.get('/project/:projectId', isAuthenticated, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { status, page = 1, limit = 50 } = req.query;
    
    const cacheKey = cache.generateCacheKey('subprojects', {
      projectId,
      status: status || 'all',
      page,
      limit
    });
    
    const result = await cache.cacheWrapper(
      cacheKey,
      cache.CACHE_TTL.SUBPROJECT_LIST,
      async () => {
        const query = { project: projectId };
        if (status) {
          query.status = status;
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [subProjects, total] = await Promise.all([
          SubProject.find(query)
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
          SubProject.countDocuments(query)
        ]);
        
        return {
          subProjects,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / parseInt(limit))
          }
        };
      }
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching SubProjects:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/subprojects/:id:
 *   get:
 *     summary: Get a specific SubProject
 *     tags: [SubProjects]
 */
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const subProject = await SubProject.findById(req.params.id)
      .populate('project', 'title description')
      .populate('createdBy', 'name email')
      .lean();
    
    if (!subProject) {
      return res.status(404).json({ error: 'SubProject not found' });
    }
    
    res.json(subProject);
  } catch (error) {
    console.error('Error fetching SubProject:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/subprojects/:id:
 *   put:
 *     summary: Update a SubProject
 *     tags: [SubProjects]
 */
router.put('/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { name, code, description, status, metadata } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (code) updateData.code = code.toUpperCase();
    if (description !== undefined) updateData.description = description;
    if (status) updateData.status = status;
    if (metadata) updateData.metadata = metadata;
    
    const subProject = await SubProject.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!subProject) {
      return res.status(404).json({ error: 'SubProject not found' });
    }
    
    // Invalidate caches
    await Promise.all([
      cache.invalidateSubProject(req.params.id),
      cache.invalidateProject(subProject.project)
    ]);
    
    res.json(subProject);
  } catch (error) {
    console.error('Error updating SubProject:', error);
    
    if (error.code === 11000) {
      return res.status(409).json({ 
        error: 'SubProject code already exists for this project' 
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/subprojects/:id:
 *   delete:
 *     summary: Delete a SubProject
 *     tags: [SubProjects]
 */
router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    // Check if subproject has elements
    const elementCount = await StructuralElement.countDocuments({ 
      subProject: req.params.id 
    });
    
    if (elementCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete SubProject with ${elementCount} structural elements. Please reassign or delete elements first.` 
      });
    }
    
    const subProject = await SubProject.findByIdAndDelete(req.params.id);
    
    if (!subProject) {
      return res.status(404).json({ error: 'SubProject not found' });
    }
    
    // Invalidate caches
    await Promise.all([
      cache.invalidateSubProject(req.params.id),
      cache.invalidateProject(subProject.project)
    ]);
    
    res.json({ message: 'SubProject deleted successfully', subProject });
  } catch (error) {
    console.error('Error deleting SubProject:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/subprojects/:id/statistics:
 *   get:
 *     summary: Get aggregated statistics for a SubProject
 *     tags: [SubProjects]
 */
router.get('/:id/statistics', isAuthenticated, async (req, res) => {
  try {
    const subProject = await SubProject.findById(req.params.id);
    
    if (!subProject) {
      return res.status(404).json({ error: 'SubProject not found' });
    }
    
    res.json({
      statistics: subProject.statistics,
      completionPercentage: subProject.completionPercentage,
      sqmCompletionPercentage: subProject.sqmCompletionPercentage
    });
  } catch (error) {
    console.error('Error fetching SubProject statistics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/subprojects/:id/recalculate:
 *   post:
 *     summary: Trigger recalculation of SubProject statistics
 *     tags: [SubProjects]
 */
router.post('/:id/recalculate', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const stats = await SubProject.recalculateStatistics(req.params.id);
    
    res.json({
      message: 'Statistics recalculated successfully',
      statistics: stats
    });
  } catch (error) {
    console.error('Error recalculating SubProject statistics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/subprojects/project/:projectId/statistics:
 *   get:
 *     summary: Get aggregated statistics for all SubProjects in a Project
 *     tags: [SubProjects]
 */
router.get('/project/:projectId/statistics', isAuthenticated, async (req, res) => {
  try {
    const stats = await SubProject.recalculateProjectStatistics(req.params.projectId);
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching Project statistics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/subprojects/:id/elements:
 *   get:
 *     summary: Get structural elements for a SubProject with section filtering
 *     tags: [SubProjects]
 */
router.get('/:id/elements', isAuthenticated, async (req, res) => {
  try {
    const { section, page = 1, limit = 100 } = req.query;
    
    const query = { subProject: req.params.id };
    
    // Filter by section
    if (section) {
      switch (section) {
        case 'active':
          query.status = 'active';
          break;
        case 'non_clearance':
        case 'nonClearance':
          query.status = 'non clearance';
          break;
        case 'no_job':
        case 'noJob':
          query.status = 'no_job';
          break;
        case 'complete':
          query.status = { $in: ['complete', 'completed'] };
          break;
      }
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [elements, total] = await Promise.all([
      StructuralElement.find(query)
        .select('-__v')
        .sort({ serialNo: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      StructuralElement.countDocuments(query)
    ]);
    
    res.json({
      elements,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching SubProject elements:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
