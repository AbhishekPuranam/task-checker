/**
 * Shared Excel Parsing and Transformation Utilities
 * 
 * This module provides centralized Excel file parsing and row transformation
 * logic used by routes and workers.
 */

const XLSX = require('xlsx');

/**
 * Column mapping for Excel import
 */
const EXCEL_COLUMN_MAPPING = {
  'Sl No': 'serialNo',
  'Serial No': 'serialNo',
  'S.No': 'serialNo',
  'Structure Number': 'structureNumber',
  'Structure No': 'structureNumber',
  'Drawing No': 'drawingNo',
  'Drawing Number': 'drawingNo',
  'Level': 'level',
  'Floor': 'level',
  'Member Type': 'memberType',
  'Type': 'memberType',
  'GridNo': 'gridNo',
  'Grid': 'gridNo',
  'Grid No': 'gridNo',
  'Location': 'gridNo',
  'Part Mark No': 'partMarkNo',
  'Part Mark': 'partMarkNo',
  'Mark No': 'partMarkNo',
  'Section Sizes': 'sectionSizes',
  'Section': 'sectionSizes',
  'Length in (mm)': 'lengthMm',
  'Length': 'lengthMm',
  'Qty': 'qty',
  'Quantity': 'qty',
  'Section Depth (mm)D': 'sectionDepthMm',
  'Depth': 'sectionDepthMm',
  'Flange Width (mm) B': 'flangeWidthMm',
  'Width': 'flangeWidthMm',
  'Thickness (mm) t Of Web': 'webThicknessMm',
  'Web Thickness': 'webThicknessMm',
  'Thickness (mm) TOf Flange': 'flangeThicknessMm',
  'Flange Thickness': 'flangeThicknessMm',
  'Thickness of Fireproofing': 'fireproofingThickness',
  'Fireproofing': 'fireproofingThickness',
  'Surface Area in Sqm': 'surfaceAreaSqm',
  'Area': 'surfaceAreaSqm',
  'Fire Proofing Workflow': 'fireProofingWorkflow',
};

/**
 * Valid fire proofing workflow values
 */
const VALID_WORKFLOWS = [
  'cement_fire_proofing',
  'gypsum_fire_proofing',
  'intumescent_coatings',
  'refinery_fire_proofing',
];

/**
 * Parse Excel file and extract data
 * 
 * @param {String} filePath - Path to the Excel file
 * @returns {Array} Array of row objects
 * @throws {Error} If file cannot be parsed
 */
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

/**
 * Transform Excel row to StructuralElement format
 * 
 * @param {Object} row - Excel row data
 * @param {String} projectId - Project ID
 * @param {String} userId - User ID
 * @param {Object} project - Project document
 * @param {String} subProjectId - Optional SubProject ID
 * @returns {Object} Transformed data ready for StructuralElement model
 */
function transformExcelRow(row, projectId, userId, project, subProjectId = null) {
  const transformed = {
    project: projectId,
    subProject: subProjectId || null,
    projectName: project?.title || 'Untitled Project',
    siteLocation: project?.location || 'Not specified',
    createdBy: userId,
    status: 'active',
  };

  // Map all Excel columns to model fields
  for (const [excelColumn, modelField] of Object.entries(EXCEL_COLUMN_MAPPING)) {
    const value = row[excelColumn];
    
    if (value !== undefined && value !== null && value !== '') {
      // Handle numeric fields
      if (['lengthMm', 'qty', 'sectionDepthMm', 'flangeWidthMm', 
           'webThicknessMm', 'flangeThicknessMm', 
           'fireproofingThickness', 'surfaceAreaSqm'].includes(modelField)) {
        transformed[modelField] = parseFloat(value) || 0;
      } 
      // Handle fire proofing workflow validation
      else if (modelField === 'fireProofingWorkflow') {
        const trimmedValue = String(value).trim().toLowerCase().replace(/\s+/g, '_');
        if (VALID_WORKFLOWS.includes(trimmedValue)) {
          transformed[modelField] = trimmedValue;
        } else {
          throw new Error(
            `Invalid Fire Proofing Workflow: ${value}. Valid options: ${VALID_WORKFLOWS.join(', ')}`
          );
        }
      }
      // Handle string fields
      else {
        transformed[modelField] = String(value).trim();
      }
    }
  }

  return transformed;
}

/**
 * Validate Excel row has required fields
 * 
 * @param {Object} row - Excel row data
 * @param {Number} rowIndex - Row index for error messages
 * @returns {Object} { valid: Boolean, errors: Array }
 */
function validateExcelRow(row, rowIndex) {
  const errors = [];
  const requiredFields = ['Structure Number', 'Structure No'];
  
  // Check if at least one structure number field exists
  const hasStructureNumber = requiredFields.some(field => 
    row[field] !== undefined && row[field] !== null && row[field] !== ''
  );
  
  if (!hasStructureNumber) {
    errors.push(`Row ${rowIndex + 2}: Missing Structure Number`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get column name for a field (for error messages)
 */
function getColumnNameForField(fieldName) {
  for (const [excelColumn, modelField] of Object.entries(EXCEL_COLUMN_MAPPING)) {
    if (modelField === fieldName) {
      return excelColumn;
    }
  }
  return fieldName;
}

module.exports = {
  parseExcelFile,
  transformExcelRow,
  validateExcelRow,
  EXCEL_COLUMN_MAPPING,
  VALID_WORKFLOWS,
  getColumnNameForField,
};
