const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const StructuralElement = require('../models/StructuralElement');
const Job = require('../models/Job');
const { auth } = require('../middleware/auth');
const cache = require('../utils/cache');

/**
 * @swagger
 * /api/grouping/elements:
 *   post:
 *     summary: Get grouped structural elements with optional sub-grouping (OPTIMIZED)
 *     tags: [Grouping]
 */
router.post('/elements', auth, async (req, res) => {
  try {
    const {
      projectId,
      subProjectId,
      status, // Section filter: active, non clearance, no_job, complete
      groupBy, // Primary grouping field
      subGroupBy, // Secondary grouping field (optional)
      page = 1,
      limit = 100,
      includeElements = false // Whether to include full element details
    } = req.body;
    
    if (!groupBy) {
      return res.status(400).json({ error: 'groupBy field is required' });
    }
    
    // Build match stage
    const matchStage = {};
    
    if (subProjectId) {
      matchStage.subProject = new mongoose.Types.ObjectId(subProjectId);
    } else if (projectId) {
      matchStage.project = new mongoose.Types.ObjectId(projectId);
    } else {
      return res.status(400).json({ 
        error: 'Either projectId or subProjectId is required' 
      });
    }
    
    // Filter by status/section
    if (status) {
      if (status === 'complete') {
        matchStage.status = { $in: ['complete', 'completed'] };
      } else {
        matchStage.status = status;
      }
    }
    
    // Generate optimized cache key
    const cacheKey = cache.generateCacheKey('grouping', { 
      projectId: projectId || '', 
      subProjectId: subProjectId || '', 
      status: status || 'all', 
      groupBy, 
      subGroupBy: subGroupBy || 'none',
      page,
      limit,
      includeElements: includeElements ? 'true' : 'false'
    });
    
    // Use cache wrapper for automatic caching
    const response = await cache.cacheWrapper(
      cacheKey,
      cache.CACHE_TTL.GROUPING,
      async () => {
        // Build aggregation pipeline
        const pipeline = [
          { $match: matchStage }
        ];
        
        // Build group stage
        const groupId = {};
        const groupStage = {
          _id: null,
          count: { $sum: 1 },
          totalSqm: { $sum: { $ifNull: ['$surfaceAreaSqm', 0] } },
          totalQty: { $sum: { $ifNull: ['$qty', 0] } },
          totalLengthMm: { $sum: { $ifNull: ['$lengthMm', 0] } }
        };
        
        // Primary grouping
        groupId[groupBy] = `$${groupBy}`;
        
        // Sub-grouping (nested)
        if (subGroupBy) {
          groupId[subGroupBy] = `$${subGroupBy}`;
        }
        
        groupStage._id = groupId;
        
        // Add sample elements to each group (limit to 5 for preview)
        groupStage.elements = {
          $push: {
            _id: '$_id',
            serialNo: '$serialNo',
            structureNumber: '$structureNumber',
            drawingNo: '$drawingNo',
            level: '$level',
            memberType: '$memberType',
            gridNo: '$gridNo',
            partMarkNo: '$partMarkNo',
            sectionSizes: '$sectionSizes',
            lengthMm: '$lengthMm',
            qty: '$qty',
            surfaceAreaSqm: '$surfaceAreaSqm',
            status: '$status',
            fireProofingWorkflow: '$fireProofingWorkflow'
          }
        };
        
        pipeline.push({ $group: groupStage });
        
        // Sort by primary group field
        const sortStage = {};
        sortStage[`_id.${groupBy}`] = 1;
        pipeline.push({ $sort: sortStage });
        
        // Add pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Count total groups (before pagination)
        const countPipeline = [...pipeline, { $count: 'total' }];
        
        // Add pagination to main pipeline
        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: parseInt(limit) });
        
        // If includeElements is true, keep all elements; otherwise limit to 5 for preview
        if (includeElements) {
          // Keep all elements in each group
          pipeline.push({
            $project: {
              _id: 1,
              count: 1,
              totalSqm: 1,
              totalQty: 1,
              totalLengthMm: 1,
              elements: 1  // Include all elements
            }
          });
        } else {
          // Limit elements array to first 5 per group (for preview)
          pipeline.push({
            $project: {
              _id: 1,
              count: 1,
              totalSqm: 1,
              totalQty: 1,
              totalLengthMm: 1,
              elements: { $slice: ['$elements', 5] }
            }
          });
        }
        
        // Execute both pipelines in parallel
        const [groupResults, countResults] = await Promise.all([
          StructuralElement.aggregate(pipeline),
          StructuralElement.aggregate(countPipeline)
        ]);
        
        const total = countResults[0]?.total || 0;
        
        // Fetch jobs for all elements in the groups
        const allElementIds = groupResults.flatMap(group => 
          group.elements.map(el => el._id)
        );
        
        // Get ALL jobs for each element (not just pending/in_progress)
        // This is critical for allowing users to see, edit, and manage all job statuses
        const jobs = await Job.find({
          structuralElement: { $in: allElementIds }
        })
        .sort({ orderIndex: 1 })
        .lean();
        
        // Create a map of elementId -> array of jobs
        const jobsMap = {};
        jobs.forEach(job => {
          const elementId = job.structuralElement.toString();
          if (!jobsMap[elementId]) {
            jobsMap[elementId] = [];
          }
          jobsMap[elementId].push(job);
        });
        
        // Add job information to elements
        groupResults.forEach(group => {
          group.elements = group.elements.map(element => {
            const elementJobs = jobsMap[element._id.toString()] || [];
            // Find the current active job (first pending or in_progress job)
            const currentJob = elementJobs.find(j => 
              j.status === 'pending' || j.status === 'in_progress'
            ) || null;
            
            return {
              ...element,
              currentJob: currentJob,
              allJobs: elementJobs  // Include all jobs for the element
            };
          });
        });
        
        // Return formatted response
        return {
          groups: groupResults,
          groupBy,
          subGroupBy,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / parseInt(limit))
          }
        };
      }
    );
    
    res.json(response);
  } catch (error) {
    console.error('Error grouping elements:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/grouping/elements/group-details:
 *   post:
 *     summary: Get all elements in a specific group
 *     tags: [Grouping]
 */
router.post('/elements/group-details', auth, async (req, res) => {
  try {
    const {
      projectId,
      subProjectId,
      status,
      groupBy,
      groupValue,
      subGroupBy,
      subGroupValue,
      page = 1,
      limit = 100
    } = req.body;
    
    // Build query
    const query = {};
    
    if (subProjectId) {
      query.subProject = subProjectId;
    } else if (projectId) {
      query.project = projectId;
    }
    
    if (status) {
      if (status === 'complete') {
        query.status = { $in: ['complete', 'completed'] };
      } else {
        query.status = status;
      }
    }
    
    // Add group filters
    if (groupBy && groupValue !== undefined) {
      query[groupBy] = groupValue;
    }
    
    if (subGroupBy && subGroupValue !== undefined) {
      query[subGroupBy] = subGroupValue;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Use lean() for better performance
    const [elements, total] = await Promise.all([
      StructuralElement.find(query)
        .select('-__v -attachments') // Exclude heavy fields
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
    console.error('Error fetching group details:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/grouping/available-fields:
 *   get:
 *     summary: Get list of available fields for grouping
 *     tags: [Grouping]
 */
router.get('/available-fields', auth, async (req, res) => {
  try {
    // Cache this as it rarely changes
    const cacheKey = 'grouping:available-fields';
    
    const fields = await cache.cacheWrapper(
      cacheKey,
      cache.CACHE_TTL.AVAILABLE_FIELDS,
      async () => {
        return [
          { value: 'status', label: 'Status' },
          { value: 'level', label: 'Level' },
          { value: 'memberType', label: 'Member Type' },
          { value: 'gridNo', label: 'Grid No' },
          { value: 'drawingNo', label: 'Drawing No' },
          { value: 'structureNumber', label: 'Structure Number' },
          { value: 'sectionSizes', label: 'Section Sizes' },
          { value: 'fireProofingWorkflow', label: 'Fire Proofing Workflow' },
          { value: 'partMarkNo', label: 'Part Mark No' },
          { value: 'sectionDepthMm', label: 'Section Depth (mm)' },
          { value: 'flangeWidthMm', label: 'Flange Width (mm)' },
          { value: 'webThicknessMm', label: 'Web Thickness (mm)' },
          { value: 'flangeThicknessMm', label: 'Flange Thickness (mm)' },
          { value: 'fireproofingThickness', label: 'Fireproofing Thickness' }
        ];
      }
    );
    
    res.json({ fields });
  } catch (error) {
    console.error('Error fetching available fields:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
