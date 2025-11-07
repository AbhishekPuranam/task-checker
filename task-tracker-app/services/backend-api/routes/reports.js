const express = require('express');
const ExcelJS = require('exceljs');
const moment = require('moment');
const StructuralElement = require('../models/StructuralElement');
const Task = require('../models/Task');
const Job = require('../models/Job');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Export structural elements to Excel
router.get('/structural-elements', adminAuth, async (req, res) => {
  try {
    const {
      projectName,
      projectId,
      status,
      memberType,
      level,
      startDate,
      endDate
    } = req.query;

    // Build filter - support both project ID and project name
    const filter = {};
    if (projectId) {
      filter.project = projectId;
    } else if (projectName) {
      filter.projectName = { $regex: projectName, $options: 'i' };
    }
    if (status) filter.status = status;
    if (memberType) filter.memberType = memberType;
    if (level) filter.level = level;
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Debug logging
    console.log('Export structural elements - Query params:', req.query);
    console.log('Export structural elements - Filter:', filter);
    
    // Fetch data
    const elements = await StructuralElement.find(filter)
      .populate('createdBy', 'name email')
      .sort({ serialNo: 1 });

    console.log('Found elements:', elements.length);
    if (elements.length > 0) {
      console.log('Sample element:', {
        _id: elements[0]._id,
        serialNo: elements[0].serialNo,
        projectName: elements[0].projectName,
        project: elements[0].project
      });
    }

    // Get all jobs for these elements to calculate status
    const elementIds = elements.map(el => el._id);
    const jobs = await Job.find({ structuralElement: { $in: elementIds } });

    // Group jobs by structural element
    const jobsByElement = {};
    jobs.forEach(job => {
      const elementId = job.structuralElement.toString();
      if (!jobsByElement[elementId]) {
        jobsByElement[elementId] = [];
      }
      jobsByElement[elementId].push(job);
    });
    
    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Structural Elements');

    // Define columns based on your Excel format
    worksheet.columns = [
      { header: 'Sl No.', key: 'serialNo', width: 10 },
      { header: 'Structure Number', key: 'structureNumber', width: 15 },
      { header: 'Drawing No', key: 'drawingNo', width: 15 },
      { header: 'Level', key: 'level', width: 10 },
      { header: 'Member Type', key: 'memberType', width: 15 },
      { header: 'Grid No', key: 'gridNo', width: 10 },
      { header: 'Part Mark No', key: 'partMarkNo', width: 15 },
      { header: 'Section Sizes', key: 'sectionSizes', width: 15 },
      { header: 'Length in (mm)', key: 'lengthMm', width: 15 },
      { header: 'Qty', key: 'quantity', width: 8 },
      { header: 'Section Depth (mm) D', key: 'sectionDepthMm', width: 18 },
      { header: 'Flange Width (mm) B', key: 'flangeWidthMm', width: 18 },
      { header: 'Thickness (mm) t Of Web', key: 'webThicknessMm', width: 20 },
      { header: 'Thickness (mm) T Of Flange', key: 'flangeThicknessMm', width: 22 },
      { header: 'Thickness of Fireproofing', key: 'fireproofingThickness', width: 20 },
      { header: 'Surface Area in Sqm', key: 'surfaceAreaSqm', width: 18 },
      { header: 'Project Name', key: 'projectName', width: 20 },
      { header: 'Site Location', key: 'siteLocation', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Created Date', key: 'createdAt', width: 15 },
      { header: 'Created By', key: 'createdBy', width: 15 },
      { header: 'Notes', key: 'notes', width: 30 }
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F81BD' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };

    // Add data rows with calculated status
    elements.forEach((element, index) => {
      const elementJobs = jobsByElement[element._id.toString()] || [];
      
      // Calculate status like frontend does
      let calculatedStatus;
      if (elementJobs.length === 0) {
        calculatedStatus = 'no jobs';
      } else {
        const hasNonClearanceJobs = elementJobs.some(job => job.status === 'not_applicable');
        const completedJobs = elementJobs.filter(job => job.status === 'completed').length;
        const totalJobs = elementJobs.length;
        const completionPercentage = (completedJobs / totalJobs) * 100;
        const avgProgress = elementJobs.reduce((sum, job) => sum + (job.progressPercentage || 0), 0) / elementJobs.length;
        
        if (hasNonClearanceJobs) {
          calculatedStatus = 'non clearance';
        } else if (completionPercentage === 100 && avgProgress === 100) {
          calculatedStatus = 'complete';
        } else if (completionPercentage > 0 || avgProgress > 0) {
          calculatedStatus = 'active';
        } else {
          calculatedStatus = 'no jobs';
        }
      }

      const row = worksheet.addRow({
        serialNo: element.serialNo,
        structureNumber: element.structureNumber,
        drawingNo: element.drawingNo,
        level: element.level,
        memberType: element.memberType,
        gridNo: element.gridNo,
        partMarkNo: element.partMarkNo,
        sectionSizes: element.sectionSizes,
        lengthMm: element.lengthMm,
        quantity: element.quantity,
        sectionDepthMm: element.sectionDepthMm,
        flangeWidthMm: element.flangeWidthMm,
        webThicknessMm: element.webThicknessMm,
        flangeThicknessMm: element.flangeThicknessMm,
        fireproofingThickness: element.fireproofingThickness,
        surfaceAreaSqm: element.surfaceAreaSqm,
        projectName: element.projectName,
        siteLocation: element.siteLocation,
        status: calculatedStatus,
        createdAt: moment(element.createdAt).format('DD/MM/YYYY'),
        createdBy: element.createdBy?.name || 'Unknown',
        notes: element.notes || ''
      });

      // Color coding based on calculated status
      if (calculatedStatus === 'complete') {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'ADD8E6' } // Light blue for completed
        };
      } else if (calculatedStatus === 'active') {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF99' } // Yellow for active elements
        };
      } else if (calculatedStatus === 'non clearance') {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFB6C1' } // Light pink for non clearance
        };
      }
    });

    // Auto-filter
    worksheet.autoFilter = {
      from: 'A1',
      to: `V${elements.length + 1}`
    };

    // Set response headers
    const filename = `structural_elements_${moment().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ message: 'Export failed' });
  }
});

// Export projects/jobs report
router.get('/projects-report', adminAuth, async (req, res) => {
  try {
    const {
      projectName,
      projectId,
      status,
      workType,
      startDate,
      endDate,
      engineerId
    } = req.query;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (workType) filter.workType = workType;
    if (engineerId) filter.createdBy = engineerId;
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Fetch jobs with populated structural elements
    const jobs = await Job.find(filter)
      .populate('structuralElement')
      .populate('createdBy', 'name email department')
      .populate('assignedTo', 'name email')
      .populate('qualityCheckedBy', 'name email')
      .sort({ createdAt: -1 });

    // Filter by project if specified
    let filteredJobs = jobs;
    if (projectId) {
      filteredJobs = jobs.filter(job => job.structuralElement?.project?.toString() === projectId);
    } else if (projectName) {
      filteredJobs = jobs.filter(job => job.structuralElement?.projectName?.includes(projectName));
    }

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Jobs Report');

    // Define columns
    worksheet.columns = [
      { header: 'Job Name', key: 'jobName', width: 25 },
      { header: 'Work Type', key: 'workType', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Priority', key: 'priority', width: 10 },
      { header: 'Quality Check', key: 'qualityCheckStatus', width: 15 },
      // Structural Element Info
      { header: 'Serial No', key: 'serialNo', width: 10 },
      { header: 'Structure Number', key: 'structureNumber', width: 15 },
      { header: 'Drawing No', key: 'drawingNo', width: 15 },
      { header: 'Level', key: 'level', width: 10 },
      { header: 'Member Type', key: 'memberType', width: 15 },
      { header: 'Grid No', key: 'gridNo', width: 10 },
      { header: 'Part Mark No', key: 'partMarkNo', width: 15 },
      { header: 'Section Sizes', key: 'sectionSizes', width: 15 },
      { header: 'Project Name', key: 'projectName', width: 20 },
      { header: 'Site Location', key: 'siteLocation', width: 15 },
      // Task Info
      { header: 'Created By', key: 'createdBy', width: 15 },
      { header: 'Assigned To', key: 'assignedTo', width: 15 },
      { header: 'Due Date', key: 'dueDate', width: 12 },
      { header: 'Created Date', key: 'createdAt', width: 12 },
      { header: 'Completed Date', key: 'completedAt', width: 12 },
      { header: 'Estimated Hours', key: 'estimatedHours', width: 15 },
      { header: 'Actual Hours', key: 'actualHours', width: 12 },
      { header: 'Work Description', key: 'workDescription', width: 30 }
    ];

    // Style header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '366092' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };

    // Add data rows
    filteredJobs.forEach((job) => {
      const element = job.structuralElement || {};
      const row = worksheet.addRow({
        jobName: job.jobTitle,
        workType: job.jobType,
        status: job.status,
        priority: job.priority,
        qualityCheckStatus: job.qualityCheckStatus,
        // Structural element data
        serialNo: element.serialNo || '',
        structureNumber: element.structureNumber || '',
        drawingNo: element.drawingNo || '',
        level: element.level || '',
        memberType: element.memberType || '',
        gridNo: element.gridNo || '',
        partMarkNo: element.partMarkNo || '',
        sectionSizes: element.sectionSizes || '',
        projectName: element.projectName || '',
        siteLocation: element.siteLocation || '',
        // Job data
        createdBy: job.createdBy?.name || '',
        assignedTo: job.assignedTo?.name || '',
        dueDate: job.dueDate ? moment(job.dueDate).format('DD/MM/YYYY') : '',
        createdAt: moment(job.createdAt).format('DD/MM/YYYY'),
        completedAt: job.completedAt ? moment(job.completedAt).format('DD/MM/YYYY') : '',
        estimatedHours: job.estimatedHours || '',
        actualHours: job.actualHours || '',
        workDescription: job.jobDescription
      });

      // Color coding based on status
      if (job.status === 'completed') {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '92D050' } // Green for completed
        };
      } else if (job.status === 'pending') {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF99' } // Yellow for pending (engineer jobs)
        };
      } else if (job.status === 'in_progress') {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFC000' } // Orange for in progress
        };
      }
    });

    // Auto-filter
    worksheet.autoFilter = {
      from: 'A1',
      to: `X${filteredJobs.length + 1}`
    };

    // Set response headers
    const filename = `jobs_report_${moment().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Jobs export error:', error);
    res.status(500).json({ message: 'Export failed' });
  }
});

// Combined report (structural elements with their associated jobs)
router.get('/combined-report', adminAuth, async (req, res) => {
  try {
    const { projectName, projectId } = req.query;
    
    // Build filter - support both project ID and project name
    const filter = {};
    if (projectId) {
      filter.project = projectId;
    } else if (projectName) {
      filter.projectName = { $regex: projectName, $options: 'i' };
    }

    // Fetch structural elements
    const elements = await StructuralElement.find(filter)
      .populate('createdBy', 'name email')
      .sort({ serialNo: 1 });

    // Get all jobs for these elements
    const elementIds = elements.map(el => el._id);
    console.log('Section export - Element IDs sample:', elementIds.slice(0, 3));
    
    const jobs = await Job.find({ structuralElement: { $in: elementIds } })
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email')
      .populate('qualityCheckedBy', 'name email');

    console.log('Section export - Jobs found:', jobs.length);
    if (jobs.length > 0) {
      console.log('Section export - Sample job:', {
        _id: jobs[0]._id,
        structuralElement: jobs[0].structuralElement,
        status: jobs[0].status,
        jobTitle: jobs[0].jobTitle
      });
    }

    // Group jobs by structural element
    const jobsByElement = {};
    jobs.forEach(job => {
      const elementId = job.structuralElement.toString();
      if (!jobsByElement[elementId]) {
        jobsByElement[elementId] = [];
      }
      jobsByElement[elementId].push(job);
    });

    // Create workbook with multiple sheets
    const workbook = new ExcelJS.Workbook();
    
    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 25 },
      { header: 'Count', key: 'count', width: 15 }
    ];
    
    summarySheet.addRow({ metric: 'Total Structural Elements', count: elements.length });
    summarySheet.addRow({ metric: 'Total Jobs/Tasks', count: jobs.length });
    summarySheet.addRow({ metric: 'Completed Jobs', count: jobs.filter(t => t.status === 'completed').length });
    summarySheet.addRow({ metric: 'Pending Jobs', count: jobs.filter(t => t.status === 'pending').length });
    summarySheet.addRow({ metric: 'In Progress Jobs', count: jobs.filter(t => t.status === 'in_progress').length });

    // Main data sheet
    const dataSheet = workbook.addWorksheet('Detailed Report');
    dataSheet.columns = [
      { header: 'Serial No', key: 'serialNo', width: 10 },
      { header: 'Structure Number', key: 'structureNumber', width: 15 },
      { header: 'Drawing No', key: 'drawingNo', width: 15 },
      { header: 'Level', key: 'level', width: 10 },
      { header: 'Member Type', key: 'memberType', width: 15 },
      { header: 'Grid No', key: 'gridNo', width: 10 },
      { header: 'Part Mark No', key: 'partMarkNo', width: 15 },
      { header: 'Job Name', key: 'jobName', width: 25 },
      { header: 'Work Type', key: 'workType', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Engineer', key: 'engineer', width: 15 },
      { header: 'Created Date', key: 'createdDate', width: 12 }
    ];

    // Style headers
    [summarySheet, dataSheet].forEach(sheet => {
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '366092' }
      };
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    });

    // Add detailed data
    elements.forEach(element => {
      const elementTasks = jobsByElement[element._id.toString()] || [];
      
      if (elementTasks.length === 0) {
        // Element with no jobs
        const row = dataSheet.addRow({
          serialNo: element.serialNo,
          structureNumber: element.structureNumber,
          drawingNo: element.drawingNo,
          level: element.level,
          memberType: element.memberType,
          gridNo: element.gridNo,
          partMarkNo: element.partMarkNo,
          jobName: 'No jobs assigned',
          workType: '',
          status: 'No work',
          engineer: '',
          createdDate: ''
        });
        
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F2F2F2' } // Gray for no jobs
        };
      } else {
        // Element with jobs
        elementTasks.forEach(task => {
          const row = dataSheet.addRow({
            serialNo: element.serialNo,
            structureNumber: element.structureNumber,
            drawingNo: element.drawingNo,
            level: element.level,
            memberType: element.memberType,
            gridNo: element.gridNo,
            partMarkNo: element.partMarkNo,
            jobName: task.jobTitle,
            workType: task.jobType,
            status: task.status,
            engineer: task.createdBy?.name || '',
            createdDate: moment(task.createdAt).format('DD/MM/YYYY')
          });

          // Color coding
          if (task.status === 'completed') {
            row.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'ADD8E6' } // Blue for completed (admin work done)
            };
          } else if (task.status === 'pending') {
            row.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFF99' } // Yellow for new jobs by engineers
            };
          }
        });
      }
    });

    // Set response headers
    const filename = `combined_report_${moment().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Combined export error:', error);
    res.status(500).json({ message: 'Export failed' });
  }
});

// Export section-specific report
router.get('/section-report', adminAuth, async (req, res) => {
  try {
    const { projectName, projectId, section } = req.query;
    
    if ((!projectName && !projectId) || !section) {
      return res.status(400).json({ message: 'Project identifier and section are required' });
    }

    // Get project info if using projectId
    let actualProjectName = projectName;
    if (projectId && !projectName) {
      const Task = require('../models/Task');
      const project = await Task.findById(projectId);
      actualProjectName = project ? (project.name || project.title || 'Unknown Project') : 'Unknown Project';
    }

    // Build filter for elements - support both project ID and project name
    const elementFilter = {};
    if (projectId) {
      elementFilter.project = projectId;
    } else if (projectName) {
      elementFilter.projectName = { $regex: projectName, $options: 'i' };
    }
    
    console.log('Section export - Query params:', req.query);
    console.log('Section export - Element filter:', elementFilter);
    console.log('Section export - Actual project name:', actualProjectName);
    
    // For 'non clearance' section, first find elements with not_applicable jobs
    let targetElementIds = [];
    if (section === 'non clearance') {
      // Find elements that have jobs with status 'not_applicable'
      const nonClearanceJobs = await Job.find({ 
        ...elementFilter,
        status: 'not_applicable' 
      }).distinct('structuralElement');
      targetElementIds = nonClearanceJobs;
      console.log('Section export - Elements with non-clearance jobs:', targetElementIds.length);
    }
    
    // Fetch structural elements based on section
    const fetchFilter = targetElementIds.length > 0 
      ? { ...elementFilter, _id: { $in: targetElementIds } }
      : elementFilter;
      
    const allElements = await StructuralElement.find(fetchFilter)
      .populate('createdBy', 'name email')
      .sort({ serialNo: 1 });

    console.log('Section export - Found elements:', allElements.length);

    // Get all jobs for these elements (only fetch status field for performance)
    const elementIds = allElements.map(el => el._id);
    console.log('Section export - Element IDs sample:', elementIds.slice(0, 3));
    
    const jobs = await Job.find({ structuralElement: { $in: elementIds } })
      .select('structuralElement status progressPercentage')
      .lean();

    // Group jobs by structural element
    const jobsByElement = {};
    jobs.forEach(job => {
      const elementId = job.structuralElement.toString();
      if (!jobsByElement[elementId]) {
        jobsByElement[elementId] = [];
      }
      jobsByElement[elementId].push(job);
    });

    // Calculate status for each element and filter by section
    const elementsWithStatus = allElements.map((element) => {
      const elementJobs = jobsByElement[element._id.toString()] || [];
      
      let calculatedStatus;
      if (elementJobs.length === 0) {
        calculatedStatus = 'no jobs';
      } else {
        // Check if any jobs are marked as not_applicable (non clearance)
        const hasNonClearanceJobs = elementJobs.some(job => job.status === 'not_applicable');
        
        // Calculate completion percentage based on jobs
        const completedJobs = elementJobs.filter(job => job.status === 'completed').length;
        const totalJobs = elementJobs.length;
        const completionPercentage = (completedJobs / totalJobs) * 100;
        
        // Calculate average progress percentage
        const avgProgress = elementJobs.reduce((sum, job) => sum + (job.progressPercentage || 0), 0) / elementJobs.length;
        
        // Calculate status based on job completion and non-clearance jobs
        if (hasNonClearanceJobs) {
          calculatedStatus = 'non clearance'; // Has non-clearance jobs
        } else if (completionPercentage === 100 && avgProgress === 100) {
          calculatedStatus = 'complete'; // Mark complete when all jobs done
        } else if (completionPercentage > 0 || avgProgress > 0) {
          calculatedStatus = 'active'; // Some work done but not complete
        } else {
          calculatedStatus = 'no jobs'; // No work started - treat same as no jobs
        }
      }
      
      return { ...element.toObject(), status: calculatedStatus, jobs: elementJobs };
    });

    console.log('Section export - Elements with calculated status:', elementsWithStatus.length);
    console.log('Section export - Status distribution:', {
      'no jobs': elementsWithStatus.filter(el => el.status === 'no jobs').length,
      'active': elementsWithStatus.filter(el => el.status === 'active').length,
      'complete': elementsWithStatus.filter(el => el.status === 'complete').length,
      'non clearance': elementsWithStatus.filter(el => el.status === 'non clearance').length
    });

    // Filter elements by section
    const sectionElements = elementsWithStatus.filter(el => el.status === section);
    
    console.log('Section export - Elements in section "' + section + '":', sectionElements.length);

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${section.toUpperCase()} Section`);

    // Define columns
    worksheet.columns = [
      { header: 'Sl No.', key: 'serialNo', width: 10 },
      { header: 'Structure Number', key: 'structureNumber', width: 15 },
      { header: 'Drawing No', key: 'drawingNo', width: 15 },
      { header: 'Level', key: 'level', width: 10 },
      { header: 'Member Type', key: 'memberType', width: 15 },
      { header: 'Grid No', key: 'gridNo', width: 10 },
      { header: 'Part Mark No', key: 'partMarkNo', width: 15 },
      { header: 'Section Sizes', key: 'sectionSizes', width: 15 },
      { header: 'Length in (mm)', key: 'lengthMm', width: 15 },
      { header: 'Qty', key: 'quantity', width: 8 },
      { header: 'Surface Area in Sqm', key: 'surfaceAreaSqm', width: 18 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Job Count', key: 'jobCount', width: 10 },
      { header: 'Current Job', key: 'currentJob', width: 25 },
      { header: 'Job Status', key: 'jobStatus', width: 12 },
      { header: 'Completed Date', key: 'completedDate', width: 15 },
      { header: 'Notes', key: 'notes', width: 30 }
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F81BD' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };

    // Add data rows
    sectionElements.forEach((element) => {
      const jobs = element.jobs || [];
      // Find the most relevant current job:
      // 1. Prioritize in_progress jobs
      // 2. Then pending jobs with progress > 0
      // 3. Then any pending jobs
      // 4. Then any other active jobs
      // 5. Finally, the first job as fallback
      const currentJob = jobs.find(job => job.status === 'in_progress') || 
                        jobs.find(job => job.status === 'pending' && job.progressPercentage > 0) ||
                        jobs.find(job => job.status === 'pending') ||
                        jobs.find(job => job.status !== 'completed' && job.status !== 'cancelled') ||
                        jobs[0];
      
      // Find the latest completion date from all jobs
      let completedDate = '';
      if (element.status === 'complete' && jobs.length > 0) {
        const completedDates = jobs
          .filter(job => job.completedDate)
          .map(job => new Date(job.completedDate));
        
        if (completedDates.length > 0) {
          const latestDate = new Date(Math.max(...completedDates));
          completedDate = moment(latestDate).format('DD/MM/YYYY');
        }
      }
      
      const row = worksheet.addRow({
        serialNo: element.serialNo,
        structureNumber: element.structureNumber,
        drawingNo: element.drawingNo,
        level: element.level,
        memberType: element.memberType,
        gridNo: element.gridNo,
        partMarkNo: element.partMarkNo,
        sectionSizes: element.sectionSizes,
        lengthMm: element.lengthMm,
        quantity: element.quantity,
        surfaceAreaSqm: element.surfaceAreaSqm,
        status: element.status,
        jobCount: jobs.length,
        currentJob: currentJob ? currentJob.jobTitle : 'No jobs',
        jobStatus: currentJob ? currentJob.status : '',
        completedDate: completedDate,
        notes: element.notes || ''
      });

      // Color coding based on status
      if (element.status === 'complete') {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'ADD8E6' } // Light blue for completed
        };
      } else if (element.status === 'active') {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF99' } // Yellow for active elements
        };
      } else if (element.status === 'non clearance') {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFB6C1' } // Light pink for non clearance
        };
      }
    });

    // Auto-filter
    worksheet.autoFilter = {
      from: 'A1',
      to: `R${sectionElements.length + 1}`
    };

    // Add summary at the top
    worksheet.insertRow(1, []);
    worksheet.insertRow(1, [`${section.toUpperCase()} SECTION REPORT - ${(actualProjectName || 'Unknown Project').toUpperCase()}`]);
    worksheet.insertRow(1, [`Generated on: ${moment().format('DD/MM/YYYY HH:mm:ss')}`]);
    worksheet.insertRow(1, [`Total Elements in Section: ${sectionElements.length}`]);
    worksheet.insertRow(1, []);
    
    // Style summary rows
    worksheet.getRow(2).font = { bold: true, size: 14 };
    worksheet.getRow(4).font = { bold: true };
    
    // Merge cells for title
    worksheet.mergeCells('A2:R2');
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    // Set response headers
    const filename = `${section}_section_${(actualProjectName || 'project').replace(/[^a-zA-Z0-9]/g, '_')}_${moment().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheettml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Section export error:', error);
    res.status(500).json({ message: 'Export failed' });
  }
});

// Debug route to check data
router.get('/debug-data', adminAuth, async (req, res) => {
  try {
    const { projectId, projectName } = req.query;
    
    // Get all elements for debugging
    const allElements = await StructuralElement.find({}).limit(5);
    
    // Get elements by project ID if provided
    let elementsByProjectId = [];
    if (projectId) {
      elementsByProjectId = await StructuralElement.find({ project: projectId });
    }
    
    // Get elements by project name if provided
    let elementsByProjectName = [];
    if (projectName) {
      elementsByProjectName = await StructuralElement.find({ 
        projectName: { $regex: projectName, $options: 'i' } 
      });
    }
    
    res.json({
      totalElements: await StructuralElement.countDocuments(),
      sampleElements: allElements.map(el => ({
        _id: el._id,
        serialNo: el.serialNo,
        projectName: el.projectName,
        project: el.project,
        structureNumber: el.structureNumber
      })),
      elementsByProjectId: elementsByProjectId.length,
      elementsByProjectName: elementsByProjectName.length,
      query: { projectId, projectName }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= NEW: PROJECT/SUBPROJECT EXCEL REPORTS =============

/**
 * Generate Excel report for entire Project (all SubProjects)
 * GET /api/reports/excel/project/:projectId?status=active|non%20clearance|no_job|complete
 */
router.get('/excel/project/:projectId', adminAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { status } = req.query; // Filter: active, non clearance, no_job, complete
    
    const SubProject = require('../models/SubProject');
    
    // Set response headers for Excel file
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=project-${projectId}-${status || 'all'}-${Date.now()}.xlsx`
    );
    
    // Create workbook
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: res,
      useStyles: true,
      useSharedStrings: true
    });
    
    // Get all subprojects
    const subProjects = await SubProject.find({ project: projectId })
      .select('name code')
      .sort({ name: 1 })
      .lean();
    
    // Build query
    const query = { project: projectId };
    if (status) {
      if (status === 'complete') {
        query.status = { $in: ['complete', 'completed'] };
      } else {
        query.status = status;
      }
    }
    
    // Create summary worksheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'SubProject Code', key: 'code', width: 20 },
      { header: 'SubProject Name', key: 'name', width: 30 },
      { header: 'Total Elements', key: 'totalElements', width: 15 },
      { header: 'Total SQM', key: 'totalSqm', width: 15 }
    ];
    
    // Add subproject summaries
    for (const subProject of subProjects) {
      const count = await StructuralElement.countDocuments({
        ...query,
        subProject: subProject._id
      });
      
      const stats = await StructuralElement.aggregate([
        { $match: { ...query, subProject: subProject._id } },
        { $group: { _id: null, totalSqm: { $sum: '$surfaceAreaSqm' } } }
      ]);
      
      summarySheet.addRow({
        code: subProject.code,
        name: subProject.name,
        totalElements: count,
        totalSqm: stats[0]?.totalSqm || 0
      }).commit();
    }
    
    // Create detailed worksheet
    const detailSheet = workbook.addWorksheet('Detailed Elements');
    detailSheet.columns = [
      { header: 'SubProject', key: 'subProject', width: 20 },
      { header: 'Serial No', key: 'serialNo', width: 15 },
      { header: 'Structure Number', key: 'structureNumber', width: 20 },
      { header: 'Drawing No', key: 'drawingNo', width: 20 },
      { header: 'Level', key: 'level', width: 15 },
      { header: 'Member Type', key: 'memberType', width: 20 },
      { header: 'Grid No', key: 'gridNo', width: 15 },
      { header: 'Part Mark No', key: 'partMarkNo', width: 20 },
      { header: 'Section Sizes', key: 'sectionSizes', width: 20 },
      { header: 'Length (mm)', key: 'lengthMm', width: 15 },
      { header: 'Qty', key: 'qty', width: 10 },
      { header: 'Section Depth (mm)', key: 'sectionDepthMm', width: 18 },
      { header: 'Flange Width (mm)', key: 'flangeWidthMm', width: 18 },
      { header: 'Web Thickness (mm)', key: 'webThicknessMm', width: 20 },
      { header: 'Flange Thickness (mm)', key: 'flangeThicknessMm', width: 22 },
      { header: 'Fireproofing Thickness', key: 'fireproofingThickness', width: 22 },
      { header: 'Surface Area (SQM)', key: 'surfaceAreaSqm', width: 18 },
      { header: 'Fire Proofing Workflow', key: 'fireProofingWorkflow', width: 25 },
      { header: 'Status', key: 'status', width: 15 }
    ];
    
    // Stream elements in batches
    const BATCH_SIZE = 500;
    let skip = 0;
    let hasMore = true;
    
    while (hasMore) {
      const elements = await StructuralElement.find(query)
        .populate('subProject', 'code name')
        .sort({ subProject: 1, serialNo: 1 })
        .skip(skip)
        .limit(BATCH_SIZE)
        .lean();
      
      if (elements.length === 0) {
        hasMore = false;
        break;
      }
      
      for (const element of elements) {
        detailSheet.addRow({
          subProject: element.subProject?.code || 'N/A',
          serialNo: element.serialNo,
          structureNumber: element.structureNumber,
          drawingNo: element.drawingNo,
          level: element.level,
          memberType: element.memberType,
          gridNo: element.gridNo,
          partMarkNo: element.partMarkNo,
          sectionSizes: element.sectionSizes,
          lengthMm: element.lengthMm,
          qty: element.qty,
          sectionDepthMm: element.sectionDepthMm,
          flangeWidthMm: element.flangeWidthMm,
          webThicknessMm: element.webThicknessMm,
          flangeThicknessMm: element.flangeThicknessMm,
          fireproofingThickness: element.fireproofingThickness,
          surfaceAreaSqm: element.surfaceAreaSqm,
          fireProofingWorkflow: element.fireProofingWorkflow,
          status: element.status
        }).commit();
      }
      
      skip += BATCH_SIZE;
      
      if (elements.length < BATCH_SIZE) {
        hasMore = false;
      }
    }
    
    await workbook.commit();
  } catch (error) {
    console.error('Error generating project Excel report:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

/**
 * Generate Excel report for a specific SubProject
 * GET /api/reports/excel/subproject/:subProjectId?status=active|non%20clearance|no_job|complete
 */
router.get('/excel/subproject/:subProjectId', adminAuth, async (req, res) => {
  try {
    const { subProjectId } = req.params;
    const { status } = req.query;
    
    const SubProject = require('../models/SubProject');
    
    // Get subproject details
    const subProject = await SubProject.findById(subProjectId)
      .populate('project', 'title')
      .lean();
    
    if (!subProject) {
      return res.status(404).json({ error: 'SubProject not found' });
    }
    
    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=subproject-${subProject.code}-${status || 'all'}-${Date.now()}.xlsx`
    );
    
    // Create workbook
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: res,
      useStyles: true,
      useSharedStrings: true
    });
    
    // Add metadata worksheet
    const metaSheet = workbook.addWorksheet('SubProject Info');
    metaSheet.columns = [
      { header: 'Field', key: 'field', width: 30 },
      { header: 'Value', key: 'value', width: 50 }
    ];
    
    metaSheet.addRow({ field: 'Project', value: subProject.project?.title || 'N/A' }).commit();
    metaSheet.addRow({ field: 'SubProject Code', value: subProject.code }).commit();
    metaSheet.addRow({ field: 'SubProject Name', value: subProject.name }).commit();
    metaSheet.addRow({ field: 'Status', value: subProject.status }).commit();
    metaSheet.addRow({ field: 'Total Elements', value: subProject.statistics.totalElements }).commit();
    metaSheet.addRow({ field: 'Completed Elements', value: subProject.statistics.completedElements }).commit();
    metaSheet.addRow({ field: 'Total SQM', value: subProject.statistics.totalSqm }).commit();
    metaSheet.addRow({ field: 'Completed SQM', value: subProject.statistics.completedSqm }).commit();
    metaSheet.addRow({ field: 'Report Generated', value: new Date().toISOString() }).commit();
    
    // Build query
    const query = { subProject: subProjectId };
    if (status) {
      if (status === 'complete') {
        query.status = { $in: ['complete', 'completed'] };
      } else {
        query.status = status;
      }
    }
    
    // Create elements worksheet
    const elementsSheet = workbook.addWorksheet('Structural Elements');
    elementsSheet.columns = [
      { header: 'Serial No', key: 'serialNo', width: 15 },
      { header: 'Structure Number', key: 'structureNumber', width: 20 },
      { header: 'Drawing No', key: 'drawingNo', width: 20 },
      { header: 'Level', key: 'level', width: 15 },
      { header: 'Member Type', key: 'memberType', width: 20 },
      { header: 'Grid No', key: 'gridNo', width: 15 },
      { header: 'Part Mark No', key: 'partMarkNo', width: 20 },
      { header: 'Section Sizes', key: 'sectionSizes', width: 20 },
      { header: 'Length (mm)', key: 'lengthMm', width: 15 },
      { header: 'Qty', key: 'qty', width: 10 },
      { header: 'Section Depth (mm)', key: 'sectionDepthMm', width: 18 },
      { header: 'Flange Width (mm)', key: 'flangeWidthMm', width: 18 },
      { header: 'Web Thickness (mm)', key: 'webThicknessMm', width: 20 },
      { header: 'Flange Thickness (mm)', key: 'flangeThicknessMm', width: 22 },
      { header: 'Fireproofing Thickness', key: 'fireproofingThickness', width: 22 },
      { header: 'Surface Area (SQM)', key: 'surfaceAreaSqm', width: 18 },
      { header: 'Fire Proofing Workflow', key: 'fireProofingWorkflow', width: 25 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Completed Date', key: 'completedDate', width: 20 }
    ];
    
    // Stream elements in batches
    const BATCH_SIZE = 500;
    let skip = 0;
    let hasMore = true;
    
    while (hasMore) {
      const elements = await StructuralElement.find(query)
        .sort({ serialNo: 1 })
        .skip(skip)
        .limit(BATCH_SIZE)
        .lean();
      
      if (elements.length === 0) {
        hasMore = false;
        break;
      }
      
      for (const element of elements) {
        elementsSheet.addRow({
          serialNo: element.serialNo,
          structureNumber: element.structureNumber,
          drawingNo: element.drawingNo,
          level: element.level,
          memberType: element.memberType,
          gridNo: element.gridNo,
          partMarkNo: element.partMarkNo,
          sectionSizes: element.sectionSizes,
          lengthMm: element.lengthMm,
          qty: element.qty,
          sectionDepthMm: element.sectionDepthMm,
          flangeWidthMm: element.flangeWidthMm,
          webThicknessMm: element.webThicknessMm,
          flangeThicknessMm: element.flangeThicknessMm,
          fireproofingThickness: element.fireproofingThickness,
          surfaceAreaSqm: element.surfaceAreaSqm,
          fireProofingWorkflow: element.fireProofingWorkflow,
          status: element.status,
          completedDate: element.completedDate ? new Date(element.completedDate).toLocaleDateString() : ''
        }).commit();
      }
      
      skip += BATCH_SIZE;
      
      if (elements.length < BATCH_SIZE) {
        hasMore = false;
      }
    }
    
    await workbook.commit();
  } catch (error) {
    console.error('Error generating subproject Excel report:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

module.exports = router;