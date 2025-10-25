const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const StructuralElement = require('../models/StructuralElement');
const Task = require('../models/Task');
const { auth } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/excel';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only Excel files
  if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.toLowerCase().endsWith('.xlsx') ||
      file.originalname.toLowerCase().endsWith('.xls')) {
    cb(null, true);
  } else {
    cb(new Error('Only Excel files (.xlsx, .xls) are allowed'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Column mapping for Excel import
const EXCEL_COLUMN_MAPPING = {
  'Sl No': 'serialNo',
  'Structure Number': 'structureNumber',
  'Drawing No': 'drawingNo',
  'Level': 'level',
  'Member Type': 'memberType',
  'GridNo': 'gridNo',
  'Part Mark No': 'partMarkNo',
  'Section Sizes': 'sectionSizes',
  'Length in (mm)': 'lengthMm',
  'Qty': 'qty',
  'Section Depth (mm)D': 'sectionDepthMm',
  'Flange Width (mm) B': 'flangeWidthMm',
  'Thickness (mm) t Of Web': 'webThicknessMm',
  'Thickness (mm) TOf Flange': 'flangeThicknessMm',
  'Thickness of Fireproofing': 'fireproofingThickness',
  'Surface Area in Sqm': 'surfaceAreaSqm'
};

// Parse Excel file and extract data
function parseExcelFile(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    return jsonData;
  } catch (error) {
    throw new Error(`Error parsing Excel file: ${error.message}`);
  }
}

// Transform Excel row to StructuralElement format
function transformExcelRow(row, projectId, userId, project) {
  const transformedData = {
    project: projectId,
    createdBy: userId,
    status: 'active',
    projectName: project?.title || 'Project',
    siteLocation: project?.location || 'Site'
  };

  // Map Excel columns to model fields
  for (const [excelColumn, modelField] of Object.entries(EXCEL_COLUMN_MAPPING)) {
    const value = row[excelColumn];
    if (value !== undefined && value !== null && value !== '') {
      // Convert numeric fields
      if (['lengthMm', 'qty', 'sectionDepthMm', 'flangeWidthMm', 
           'webThicknessMm', 'flangeThicknessMm', 
           'fireproofingThickness', 'surfaceAreaSqm'].includes(modelField)) {
        transformedData[modelField] = parseFloat(value) || 0;
      } else {
        transformedData[modelField] = String(value).trim();
      }
    }
  }

  return transformedData;
}

// Preview Excel file without saving
router.post('/preview', auth, upload.single('excel'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No Excel file uploaded' });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    
    // Transform and validate the first few rows for preview
    const previewData = jsonData.slice(0, 5).map((row, index) => {
      try {
        // Create a basic transformed object for preview
        const transformed = {};
        for (const [excelColumn, modelField] of Object.entries(EXCEL_COLUMN_MAPPING)) {
          const value = row[excelColumn];
          if (value !== undefined && value !== null && value !== '') {
            transformed[modelField] = value;
          }
        }
        return {
          rowIndex: index + 1,
          ...transformed
        };
      } catch (error) {
        return {
          rowIndex: index + 1,
          error: error.message
        };
      }
    });
    
    res.json({
      preview: previewData,
      totalRows: jsonData.length,
      message: `Found ${jsonData.length} rows in the Excel file`
    });
    
  } catch (error) {
    console.error('Error previewing Excel file:', error);
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Error processing Excel file', error: error.message });
  }
});

// Upload and process Excel file
router.post('/upload/:projectId', auth, upload.single('excelFile'), async (req, res) => {
  console.log('=== Excel upload request received ===');
  console.log('Project ID:', req.params.projectId);
  console.log('File uploaded:', !!req.file);
  console.log('User:', req.user.email);
  
  try {
    const { projectId } = req.params;
    
    // Verify project exists
    const project = await Task.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check if user has permission (admin or project creator)
    if (req.user.role !== 'admin' && project.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to upload to this project' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No Excel file uploaded' });
    }

    // Parse Excel file
    const excelData = parseExcelFile(req.file.path);
    
    if (!excelData || excelData.length === 0) {
      return res.status(400).json({ message: 'Excel file is empty or invalid' });
    }

    // Transform and validate data
    const structuralElements = [];
    const errors = [];
    
    console.log('Processing Excel data:', {
      totalRows: excelData.length,
      firstRow: excelData[0]
    });
    
    for (let i = 0; i < excelData.length; i++) {
      try {
        const transformedData = transformExcelRow(excelData[i], projectId, req.user.id, project);
        
        console.log(`Row ${i + 1} transformed:`, transformedData);
        
        // Basic validation
        if (!transformedData.structureNumber) {
          console.log(`Row ${i + 2} failed validation: missing structureNumber`);
          errors.push({
            row: i + 2,
            message: 'Structure Number is required'
          });
          continue;
        }
        
        structuralElements.push(transformedData);
      } catch (error) {
        console.log(`Row ${i + 2} error:`, error.message);
        errors.push({
          row: i + 2,
          message: error.message
        });
      }
    }
    
    console.log('Validation complete:', {
      validElements: structuralElements.length,
      errors: errors.length
    });

    if (errors.length > 0 && structuralElements.length === 0) {
      return res.status(400).json({ 
        message: 'All rows contain errors', 
        errors: errors.slice(0, 10) // Limit error messages
      });
    }

    // Save structural elements to database
    let savedCount = 0;
    let duplicateCount = 0;
    
    console.log(`Attempting to save ${structuralElements.length} elements`);
    
    for (const elementData of structuralElements) {
      try {
        console.log('Saving element:', elementData.structureNumber);
        
        // Check for existing element (by structure number within project)
        const existingElement = await StructuralElement.findOne({
          project: projectId,
          structureNumber: elementData.structureNumber
        });
        
        if (existingElement) {
          // Compare all data fields to check if it's truly a duplicate
          const fieldsToCompare = [
            'serialNo', 'drawingNo', 'level', 'memberType', 'gridNo', 'partMarkNo', 
            'sectionSizes', 'lengthMm', 'qty', 'sectionDepthMm', 'flangeWidthMm',
            'webThicknessMm', 'flangeThicknessMm', 'fireproofingThickness', 'surfaceAreaSqm'
          ];
          
          let isDuplicate = true;
          for (const field of fieldsToCompare) {
            const existingValue = existingElement[field];
            const newValue = elementData[field];
            
            // Convert to string for comparison, handling null/undefined
            const existingStr = (existingValue == null ? '' : String(existingValue)).trim();
            const newStr = (newValue == null ? '' : String(newValue)).trim();
            
            if (existingStr !== newStr) {
              isDuplicate = false;
              console.log(`Field ${field} differs: "${existingStr}" vs "${newStr}"`);
              break;
            }
          }
          
          if (isDuplicate) {
            console.log('True duplicate found (all fields match):', elementData.structureNumber);
            duplicateCount++;
            continue;
          } else {
            console.log('Data different but same structure number, creating new record:', elementData.structureNumber);
            // Don't skip - create new record even if structure number exists but data is different
          }
        }
        
        const structuralElement = new StructuralElement(elementData);
        const saved = await structuralElement.save();
        console.log('Successfully saved:', saved._id);
        savedCount++;
      } catch (error) {
        console.log('Save error for element:', elementData.structureNumber, error.message);
        errors.push({
          row: `Element ${elementData.structureNumber}`,
          message: error.message
        });
      }
    }
    
    console.log('Save process complete:', {
      saved: savedCount,
      duplicates: duplicateCount,
      errors: errors.length
    });

    // Clean up uploaded file
    try {
      fs.unlinkSync(req.file.path);
    } catch (error) {
      console.error('Error deleting uploaded file:', error);
    }

    // Update project with structural elements count
    await Task.findByIdAndUpdate(projectId, {
      $inc: { structuralElementsCount: savedCount }
    });

    res.json({
      message: 'Excel file processed successfully',
      summary: {
        totalRows: excelData.length,
        savedElements: savedCount,
        duplicateElements: duplicateCount,
        errors: errors.length
      },
      errors: errors.slice(0, 5) // Return first 5 errors if any
    });

  } catch (error) {
    console.error('Excel upload error:', error);
    
    // Clean up uploaded file in case of error
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (deleteError) {
        console.error('Error deleting uploaded file:', deleteError);
      }
    }
    
    res.status(500).json({ 
      message: 'Error processing Excel file', 
      error: error.message 
    });
  }
});

// Get structural elements for a project
router.get('/elements/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    // Verify project exists
    const project = await Task.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const elements = await StructuralElement.find({ project: projectId })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const totalElements = await StructuralElement.countDocuments({ project: projectId });
    
    res.json({
      elements,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalElements / limit),
        totalElements,
        hasNext: skip + limit < totalElements,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching structural elements:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Download Excel template
router.get('/template', (req, res) => {
  try {
    // Create a sample Excel template with the expected columns
    const templateData = [{
      'Sl No': 1,
      'Structure Number': 'ST-001',
      'Drawing No': 'DWG-001',
      'Level': 'Level 1',
      'Member Type': 'Beam',
      'GridNo': 'A1-B1',
      'Part Mark No': 'PM-001',
      'Section Sizes': 'IPE 200',
      'Length in (mm)': 6000,
      'Qty': 2,
      'Section Depth (mm)D': 200,
      'Flange Width (mm) B': 100,
      'Thickness (mm) t Of Web': 5.6,
      'Thickness (mm) TOf Flange': 8.5,
      'Thickness of Fireproofing': 10,
      'Surface Area in Sqm': 1.2
    }];
    
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Structural Elements');
    
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=structural_elements_template.xlsx');
    res.send(buffer);
    
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({ message: 'Error generating template', error: error.message });
  }
});

module.exports = router;