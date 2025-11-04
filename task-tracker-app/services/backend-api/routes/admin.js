const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { cleanupOrphanedDocuments } = require('../utils/transaction');
const StructuralElement = require('../models/StructuralElement');
const Job = require('../models/Job');
const Task = require('../models/Task');

/**
 * Admin middleware - ensure user is admin
 */
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

/**
 * Cleanup orphaned documents for a specific project
 * POST /api/admin/cleanup/project/:projectId
 */
router.post('/cleanup/project/:projectId', auth, isAdmin, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { since } = req.body; // Optional: cleanup documents created after this date
    
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24 hours
    
    console.log(`🧹 [ADMIN] Cleanup requested for project ${projectId} since ${sinceDate}`);
    
    const result = await cleanupOrphanedDocuments(projectId, sinceDate);
    
    res.json({
      message: 'Cleanup completed',
      result,
      cleanedAt: new Date()
    });
  } catch (error) {
    console.error('❌ [ADMIN] Cleanup error:', error);
    res.status(500).json({ 
      message: 'Cleanup failed', 
      error: error.message 
    });
  }
});

/**
 * Cleanup all orphaned documents across all projects
 * POST /api/admin/cleanup/all
 */
router.post('/cleanup/all', auth, isAdmin, async (req, res) => {
  try {
    const { since } = req.body;
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    console.log(`🧹 [ADMIN] Global cleanup requested since ${sinceDate}`);
    
    // Find all projects
    const projects = await Task.find({});
    
    let totalCleaned = {
      cleanedElements: 0,
      cleanedJobs: 0,
      totalCleaned: 0
    };
    
    for (const project of projects) {
      const result = await cleanupOrphanedDocuments(project._id, sinceDate);
      totalCleaned.cleanedElements += result.cleanedElements;
      totalCleaned.cleanedJobs += result.cleanedJobs;
      totalCleaned.totalCleaned += result.totalCleaned;
    }
    
    res.json({
      message: 'Global cleanup completed',
      projectsProcessed: projects.length,
      result: totalCleaned,
      cleanedAt: new Date()
    });
  } catch (error) {
    console.error('❌ [ADMIN] Global cleanup error:', error);
    res.status(500).json({ 
      message: 'Global cleanup failed', 
      error: error.message 
    });
  }
});

/**
 * Get integrity report for a project
 * GET /api/admin/integrity/project/:projectId
 */
router.get('/integrity/project/:projectId', auth, isAdmin, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Count structural elements
    const totalElements = await StructuralElement.countDocuments({ project: projectId });
    
    // Count elements with workflows
    const elementsWithWorkflows = await StructuralElement.countDocuments({
      project: projectId,
      fireProofingWorkflow: { $exists: true, $ne: null }
    });
    
    // Count total jobs
    const totalJobs = await Job.countDocuments({ project: projectId });
    
    // Find elements with workflows but no jobs
    const elementsWithWorkflow = await StructuralElement.find({
      project: projectId,
      fireProofingWorkflow: { $exists: true, $ne: null }
    });
    
    let orphanedElements = 0;
    const orphanedElementsList = [];
    
    for (const element of elementsWithWorkflow) {
      const jobCount = await Job.countDocuments({
        structuralElement: element._id
      });
      
      if (jobCount === 0) {
        orphanedElements++;
        orphanedElementsList.push({
          id: element._id,
          structureNumber: element.structureNumber,
          workflow: element.fireProofingWorkflow
        });
      }
    }
    
    // Find jobs without structural elements
    const orphanedJobs = await Job.find({
      project: projectId,
      structuralElement: { $exists: false }
    });
    
    res.json({
      projectId,
      integrity: {
        totalElements,
        elementsWithWorkflows,
        totalJobs,
        orphanedElements,
        orphanedJobs: orphanedJobs.length,
        isHealthy: orphanedElements === 0 && orphanedJobs.length === 0
      },
      details: {
        orphanedElementsList: orphanedElementsList.slice(0, 10), // Show first 10
        orphanedJobsList: orphanedJobs.slice(0, 10).map(j => ({
          id: j._id,
          jobTitle: j.jobTitle,
          jobType: j.jobType
        }))
      }
    });
  } catch (error) {
    console.error('❌ [ADMIN] Integrity check error:', error);
    res.status(500).json({ 
      message: 'Integrity check failed', 
      error: error.message 
    });
  }
});

/**
 * Verify database consistency for a project
 * GET /api/admin/verify/project/:projectId
 */
router.get('/verify/project/:projectId', auth, isAdmin, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const project = await Task.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Count actual structural elements
    const actualElementCount = await StructuralElement.countDocuments({ project: projectId });
    
    // Compare with project's stored count
    const storedCount = project.structuralElementsCount || 0;
    
    const countMismatch = actualElementCount !== storedCount;
    
    // Count jobs
    const totalJobs = await Job.countDocuments({ project: projectId });
    
    res.json({
      projectId,
      projectTitle: project.title,
      verification: {
        structuralElements: {
          stored: storedCount,
          actual: actualElementCount,
          mismatch: countMismatch,
          difference: actualElementCount - storedCount
        },
        jobs: {
          total: totalJobs,
          avgJobsPerElement: actualElementCount > 0 ? (totalJobs / actualElementCount).toFixed(2) : 0
        },
        isConsistent: !countMismatch
      }
    });
  } catch (error) {
    console.error('❌ [ADMIN] Verification error:', error);
    res.status(500).json({ 
      message: 'Verification failed', 
      error: error.message 
    });
  }
});

/**
 * Fix project counts
 * POST /api/admin/fix/project/:projectId/counts
 */
router.post('/fix/project/:projectId/counts', auth, isAdmin, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const actualElementCount = await StructuralElement.countDocuments({ project: projectId });
    
    const project = await Task.findByIdAndUpdate(
      projectId,
      { structuralElementsCount: actualElementCount },
      { new: true }
    );
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    res.json({
      message: 'Project counts fixed',
      projectId,
      updatedCount: actualElementCount,
      previousCount: project.structuralElementsCount
    });
  } catch (error) {
    console.error('❌ [ADMIN] Fix counts error:', error);
    res.status(500).json({ 
      message: 'Fix counts failed', 
      error: error.message 
    });
  }
});

module.exports = router;
