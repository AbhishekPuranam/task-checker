const express = require('express');
const ExcelJS = require('exceljs');
const moment = require('moment');
const StructuralElement = require('../models/StructuralElement');
const Task = require('../models/Task');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Export structural elements to Excel
router.get('/structural-elements', adminAuth, async (req, res) => {
  try {
    const {
      projectName,
      status,
      memberType,
      level,
      startDate,
      endDate
    } = req.query;

    // Build filter
    const filter = {};
    if (projectName) filter.projectName = { $regex: projectName, $options: 'i' };
    if (status) filter.status = status;
    if (memberType) filter.memberType = memberType;
    if (level) filter.level = level;
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Fetch data
    const elements = await StructuralElement.find(filter)
      .populate('createdBy', 'name email')
      .sort({ serialNo: 1 });

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

    // Add data rows
    elements.forEach((element, index) => {
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
        status: element.status,
        createdAt: moment(element.createdAt).format('DD/MM/YYYY'),
        createdBy: element.createdBy?.name || 'Unknown',
        notes: element.notes || ''
      });

      // Color coding based on status (like your original Excel)
      if (element.status === 'completed') {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'ADD8E6' } // Light blue for completed (admin work)
        };
      } else if (element.status === 'active') {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF99' } // Yellow for new/active elements
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

    // Fetch tasks with populated structural elements
    const tasks = await Task.find(filter)
      .populate('structuralElement')
      .populate('createdBy', 'name email department')
      .populate('assignedTo', 'name email')
      .populate('completedBy', 'name email')
      .sort({ createdAt: -1 });

    // Filter by project if specified
    const filteredTasks = projectName 
      ? tasks.filter(task => task.structuralElement?.projectName?.includes(projectName))
      : tasks;

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Tasks Report');

    // Define columns
    worksheet.columns = [
      { header: 'Job Name', key: 'jobName', width: 25 },
      { header: 'Work Type', key: 'workType', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Priority', key: 'priority', width: 10 },
      { header: 'Progress %', key: 'progressPercentage', width: 12 },
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
    filteredTasks.forEach((task) => {
      const element = task.structuralElement || {};
      const row = worksheet.addRow({
        jobName: task.jobName,
        workType: task.workType,
        status: task.status,
        priority: task.priority,
        progressPercentage: task.progressPercentage,
        qualityCheckStatus: task.qualityCheckStatus,
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
        // Task data
        createdBy: task.createdBy?.name || '',
        assignedTo: task.assignedTo?.name || '',
        dueDate: task.dueDate ? moment(task.dueDate).format('DD/MM/YYYY') : '',
        createdAt: moment(task.createdAt).format('DD/MM/YYYY'),
        completedAt: task.completedAt ? moment(task.completedAt).format('DD/MM/YYYY') : '',
        estimatedHours: task.estimatedHours || '',
        actualHours: task.actualHours || '',
        workDescription: task.workDescription
      });

      // Color coding based on status
      if (task.status === 'completed') {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '92D050' } // Green for completed
        };
      } else if (task.status === 'pending') {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF99' } // Yellow for pending (engineer jobs)
        };
      } else if (task.status === 'in_progress') {
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
      to: `X${filteredTasks.length + 1}`
    };

    // Set response headers
    const filename = `tasks_report_${moment().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Tasks export error:', error);
    res.status(500).json({ message: 'Export failed' });
  }
});

// Combined report (structural elements with their associated jobs)
router.get('/combined-report', adminAuth, async (req, res) => {
  try {
    const { projectName } = req.query;
    
    // Build filter
    const filter = {};
    if (projectName) filter.projectName = { $regex: projectName, $options: 'i' };

    // Fetch structural elements
    const elements = await StructuralElement.find(filter)
      .populate('createdBy', 'name email')
      .sort({ serialNo: 1 });

    // Get all tasks for these elements
    const elementIds = elements.map(el => el._id);
    const tasks = await Task.find({ structuralElement: { $in: elementIds } })
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email')
      .populate('completedBy', 'name email');

    // Group tasks by structural element
    const tasksByElement = {};
    tasks.forEach(task => {
      const elementId = task.structuralElement.toString();
      if (!tasksByElement[elementId]) {
        tasksByElement[elementId] = [];
      }
      tasksByElement[elementId].push(task);
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
    summarySheet.addRow({ metric: 'Total Jobs/Tasks', count: tasks.length });
    summarySheet.addRow({ metric: 'Completed Jobs', count: tasks.filter(t => t.status === 'completed').length });
    summarySheet.addRow({ metric: 'Pending Jobs', count: tasks.filter(t => t.status === 'pending').length });
    summarySheet.addRow({ metric: 'In Progress Jobs', count: tasks.filter(t => t.status === 'in_progress').length });

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
      { header: 'Progress %', key: 'progress', width: 12 },
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
      const elementTasks = tasksByElement[element._id.toString()] || [];
      
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
          progress: 0,
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
            jobName: task.jobName,
            workType: task.workType,
            status: task.status,
            progress: task.progressPercentage,
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

module.exports = router;