const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const StructuralElement = require('../shared/models/StructuralElement');
const Job = require('../shared/models/Job');
const { auth } = require('../shared/middleware/auth');
const { cacheMiddleware, invalidateCache } = require('../shared/middleware/cache');

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
    
    console.log('🔍 Grouping request:', { projectId, subProjectId, status, groupBy, subGroupBy, page, limit });
    
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
      } else if (status === 'non_clearance') {
        // Map frontend 'non_clearance' to backend 'non clearance'
        matchStage.status = 'non clearance';
      } else {
        matchStage.status = status;
      }
    }
    
    console.log('📊 Match stage:', JSON.stringify(matchStage, null, 2));
    
    // Build aggregation pipeline
    const pipeline = [
      { $match: matchStage }
    ];
    
    // Add lookup for currentJob if grouping by it
    if (groupBy === 'currentJob' || subGroupBy === 'currentJob') {
      pipeline.push({
        $lookup: {
          from: 'jobs',
          let: { elementId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$structuralElement', '$$elementId'] },
                    { $in: ['$status', ['pending', 'in_progress']] }
                  ]
                }
              }
            },
            { $sort: { orderIndex: 1 } },
            { $limit: 1 }
          ],
          as: 'currentJobArray'
        }
      });
      
      // Add computed field for currentJob title
      pipeline.push({
        $addFields: {
          currentJob: {
            $ifNull: [
              { $arrayElemAt: ['$currentJobArray.jobTitle', 0] },
              '(Not Set)'
            ]
          }
        }
      });
    }
    
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
    
    console.log('⚙️ Executing aggregation pipeline...');
    
    // Execute both pipelines in parallel
    const [groupResults, countResults] = await Promise.all([
      StructuralElement.aggregate(pipeline),
      StructuralElement.aggregate(countPipeline)
    ]);
    
    const total = countResults[0]?.total || 0;
    
    console.log(`✅ Found ${groupResults.length} groups (total: ${total})`);
    
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
    
    console.log(`📋 Found ${jobs.length} jobs for ${allElementIds.length} elements`);
    
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
    res.json({
      groups: groupResults,
      groupBy,
      subGroupBy,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Error grouping elements:', error);
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
    
    console.log('🔍 Group details request:', { projectId, subProjectId, status, groupBy, groupValue, subGroupBy, subGroupValue });
    
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
      } else if (status === 'non_clearance') {
        // Map frontend 'non_clearance' to backend 'non clearance'
        query.status = 'non clearance';
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
    
    console.log('📊 Query:', JSON.stringify(query, null, 2));
    
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
    
    console.log(`✅ Found ${elements.length} elements (total: ${total})`);
    
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
    console.error('❌ Error fetching group details:', error);
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
router.get('/available-fields', 
  auth,
  cacheMiddleware(3600, () => 'cache:grouping:available-fields'),
  async (req, res) => {
  try {
    console.log('📋 Fetching available grouping fields...');
    
    const fields = [
      { value: 'status', label: 'Status' },
      { value: 'currentJob', label: 'Current Job' },
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
    
    console.log(`✅ Returning ${fields.length} available fields`);
    
    res.json({ fields });
  } catch (error) {
    console.error('❌ Error fetching available fields:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
