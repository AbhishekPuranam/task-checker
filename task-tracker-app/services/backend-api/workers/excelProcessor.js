const { Worker } = require('bullmq');
const fs = require('fs');
const StructuralElement = require('../models/StructuralElement');
const Task = require('../models/Task');
const { invalidateCache } = require('../middleware/cache');

// Import Excel processing functions from excel route
// We'll need to extract these to a shared module
const XLSX = require('xlsx');

/**
 * Parse Excel file
 */
function parseExcelFile(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    return data;
  } catch (error) {
    throw new Error(`Error parsing Excel file: ${error.message}`);
  }
}

/**
 * Transform Excel row to structural element
 */
function transformExcelRow(row, projectId, userId, project) {
  // Map Excel columns to database fields
  const transformed = {
    project: projectId,
    projectName: project.title || 'Untitled Project',
    siteLocation: project.location || 'Not specified',
    serialNo: row['Sl No'] || row['Serial No'] || row['S.No'],
    structureNumber: row['Structure Number'] || row['Structure No'],
    drawingNo: row['Drawing No'] || row['Drawing Number'],
    level: row['Level'] || row['Floor'],
    memberType: row['Member Type'] || row['Type'],
    gridNo: row['GridNo'] || row['Grid'] || row['Grid No'],
    partMarkNo: row['Part Mark No'] || row['Part Mark'] || row['Mark No'],
    sectionSizes: row['Section Sizes'] || row['Section'],
    lengthMm: parseFloat(row['Length in (mm)'] || row['Length']) || 0,
    qty: parseInt(row['Qty'] || row['Quantity']) || 1,
    sectionDepthMm: parseFloat(row['Section Depth (mm)D'] || row['Depth']) || 0,
    flangeWidthMm: parseFloat(row['Flange Width (mm) B'] || row['Width']) || 0,
    webThicknessMm: parseFloat(row['Thickness (mm) t Of Web'] || row['Web Thickness']) || 0,
    flangeThicknessMm: parseFloat(row['Thickness (mm) TOf Flange'] || row['Flange Thickness']) || 0,
    fireproofingThickness: parseFloat(row['Thickness of Fireproofing'] || row['Fireproofing']) || 0,
    surfaceAreaSqm: parseFloat(row['Surface Area in Sqm'] || row['Area']) || 0,
    fireProofingWorkflow: row['Fire Proofing Workflow'] || null,
    createdBy: userId,
  };

  return transformed;
}

/**
 * Create fire proofing jobs for a structural element
 */
async function createFireProofingJobs(structuralElement, userId) {
  const Job = require('../models/Job');
  
  const workflowJobs = {
    'cement_fire_proofing': [
      { title: 'Surface Preparation', order: 1 },
      { title: 'Rockwool Filling', order: 2 },
      { title: 'Adhesive coat/Primer', order: 3 },
      { title: 'Vermiculite-Cement', order: 4 },
      { title: 'Thickness inspection', order: 5 },
      { title: 'Sealer coat', order: 6 },
      { title: 'WIR', order: 7 },
    ],
    'gypsum_fire_proofing': [
      { title: 'Surface Preparation', order: 1 },
      { title: 'Rockwool Filling', order: 2 },
      { title: 'Adhesive coat/Primer', order: 3 },
      { title: 'Vermiculite-Gypsum', order: 4 },
      { title: 'Thickness inspection', order: 5 },
      { title: 'Sealer coat', order: 6 },
      { title: 'WIR', order: 7 },
    ],
    'intumescent_coatings': [
      { title: 'Surface Preparation', order: 1 },
      { title: 'Primer', order: 2 },
      { title: 'Coat -1', order: 3 },
      { title: 'Coat-2', order: 4 },
      { title: 'Coat-3', order: 5 },
      { title: 'Coat-4', order: 6 },
      { title: 'Coat-5', order: 7 },
      { title: 'Thickness inspection', order: 8 },
      { title: 'Top Coat', order: 9 },
    ],
    'refinery_fire_proofing': [
      { title: 'Scaffolding Errection', order: 1 },
      { title: 'Surface Preparation', order: 2 },
      { title: 'Primer/Adhesive coat', order: 3 },
      { title: 'Mesh', order: 4 },
      { title: 'FP 1 Coat', order: 5 },
      { title: 'FP Finish coat', order: 6 },
      { title: 'Sealer', order: 7 },
      { title: 'Top coat Primer', order: 8 },
      { title: 'Top coat', order: 9 },
      { title: 'Sealant', order: 10 },
      { title: 'Inspection', order: 11 },
      { title: 'Scaffolding -Dismantling', order: 12 },
    ],
  };

  console.log(`🔍 [JOB CREATION] Workflow: ${structuralElement.fireProofingWorkflow}`);
  const jobs = workflowJobs[structuralElement.fireProofingWorkflow] || [];
  console.log(`🔍 [JOB CREATION] Found ${jobs.length} job templates for workflow`);
  
  const createdJobs = [];

  for (const jobTemplate of jobs) {
    // Determine fireProofingType based on workflow
    let fireProofingType;
    switch (structuralElement.fireProofingWorkflow) {
      case 'cement_fire_proofing':
        fireProofingType = 'Cement';
        break;
      case 'gypsum_fire_proofing':
        fireProofingType = 'Gypsum';
        break;
      case 'intumescent_coatings':
        fireProofingType = 'Intumescent';
        break;
      case 'refinery_fire_proofing':
        fireProofingType = 'Refinery';
        break;
      default:
        fireProofingType = 'Other';
    }
    
    const job = new Job({
      structuralElement: structuralElement._id,
      project: structuralElement.project,
      jobTitle: jobTemplate.title,
      jobDescription: `${jobTemplate.title} for ${structuralElement.structureNumber}`,
      jobType: structuralElement.fireProofingWorkflow, // Required field
      orderIndex: jobTemplate.order * 100,
      fireProofingType: fireProofingType,
      status: 'pending',
      createdBy: userId,
    });

    const saved = await job.save();
    createdJobs.push(saved);
  }

  return createdJobs;
}

/**
 * Create and start Excel processing worker
 */
function createExcelWorker() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  const worker = new Worker(
    'excel-processing',
    async (job) => {
      console.log(`🔄 [WORKER] Processing job ${job.id}`);
      
      const { filePath, projectId, userId, userEmail } = job.data;
      
      console.log(`📊 [WORKER] Job ${job.id} data:`, { filePath, projectId, userId, userEmail });
      
      try {
        // Stage 1: Parse Excel (0-10%)
        await job.updateProgress({ stage: 'parsing', percent: 0, message: 'Parsing Excel file...' });
        
        console.log(`📄 [WORKER] Parsing file: ${filePath}`);
        const excelData = parseExcelFile(filePath);
        console.log(`✅ [WORKER] Parsed ${excelData?.length || 0} rows from Excel`);
        
        if (!excelData || excelData.length === 0) {
          throw new Error('Excel file is empty or invalid');
        }
        
        await job.updateProgress({ 
          stage: 'parsing', 
          percent: 10, 
          message: `Found ${excelData.length} rows` 
        });
        
        // Stage 2: Load project (10-15%)
        await job.updateProgress({ stage: 'loading', percent: 10, message: 'Loading project...' });
        
        console.log(`🔍 [WORKER] Loading project: ${projectId}`);
        const project = await Task.findById(projectId);
        if (!project) {
          throw new Error('Project not found');
        }
        console.log(`✅ [WORKER] Project loaded: ${project.title}`);
        
        await job.updateProgress({ stage: 'validating', percent: 15, message: 'Validating data...' });
        
        // Stage 3: Transform and validate (15-40%)
        const structuralElements = [];
        const errors = [];
        
        for (let i = 0; i < excelData.length; i++) {
          if (i % 10 === 0 || i === excelData.length - 1) {
            const percent = 15 + (i / excelData.length) * 25;
            await job.updateProgress({
              stage: 'validating',
              percent,
              message: `Validating row ${i + 1} of ${excelData.length}`,
              processed: i,
              total: excelData.length
            });
          }
          
          try {
            const transformedData = transformExcelRow(excelData[i], projectId, userId, project);
            
            if (!transformedData.structureNumber) {
              errors.push({ row: i + 2, message: 'Structure Number is required' });
              continue;
            }
            
            structuralElements.push(transformedData);
          } catch (error) {
            errors.push({ row: i + 2, message: error.message });
          }
        }
        
        if (errors.length > 0 && structuralElements.length === 0) {
          throw new Error(`All rows contain errors. First error: ${errors[0].message}`);
        }
        
        console.log(`✅ [WORKER] Validation complete - ${structuralElements.length} valid, ${errors.length} errors`);
        
        await job.updateProgress({ 
          stage: 'saving', 
          percent: 40, 
          message: `Saving ${structuralElements.length} elements...`,
          validated: structuralElements.length,
          errors: errors.length
        });
        
        // Stage 4: Save to database (40-90%)
        let savedCount = 0;
        let duplicateCount = 0;
        let totalJobsCreated = 0;
        
        for (let idx = 0; idx < structuralElements.length; idx++) {
          const elementData = structuralElements[idx];
          
          if (idx % 5 === 0 || idx === structuralElements.length - 1) {
            const percent = 40 + (idx / structuralElements.length) * 50;
            await job.updateProgress({
              stage: 'saving',
              percent,
              message: `Processing element ${idx + 1} of ${structuralElements.length}`,
              saved: savedCount,
              jobsCreated: totalJobsCreated
            });
          }
          
          try {
            // Check for duplicate - must match ALL fields
            const existingElement = await StructuralElement.findOne({
              project: projectId,
              structureNumber: elementData.structureNumber,
              drawingNo: elementData.drawingNo,
              level: elementData.level,
              memberType: elementData.memberType,
              gridNo: elementData.gridNo,
              partMarkNo: elementData.partMarkNo,
              sectionSizes: elementData.sectionSizes,
              lengthMm: elementData.lengthMm,
              qty: elementData.qty,
              sectionDepthMm: elementData.sectionDepthMm,
              flangeWidthMm: elementData.flangeWidthMm,
              webThicknessMm: elementData.webThicknessMm,
              flangeThicknessMm: elementData.flangeThicknessMm,
              fireproofingThickness: elementData.fireproofingThickness,
              surfaceAreaSqm: elementData.surfaceAreaSqm,
              fireProofingWorkflow: elementData.fireProofingWorkflow
            });
            
            if (existingElement) {
              // Exact duplicate found - all fields match
              console.log(`⚠️  [WORKER] Skipping exact duplicate: ${elementData.structureNumber}`);
              duplicateCount++;
              continue;
            }
            
            const structuralElement = new StructuralElement(elementData);
            const saved = await structuralElement.save();
            
            // Create fire proofing jobs if workflow assigned
            if (saved.fireProofingWorkflow) {
              console.log(`🔧 [WORKER] Creating jobs for ${saved.structureNumber} with workflow: ${saved.fireProofingWorkflow}`);
              try {
                const createdJobs = await createFireProofingJobs(saved, userId);
                totalJobsCreated += createdJobs.length;
                console.log(`✅ [WORKER] Created ${createdJobs.length} jobs for ${saved.structureNumber}`);
              } catch (jobError) {
                console.error(`❌ [WORKER] Error creating jobs for ${saved.structureNumber}:`, jobError.message);
              }
            } else {
              console.log(`⚠️  [WORKER] No workflow assigned for ${saved.structureNumber}`);
            }
            
            savedCount++;
          } catch (error) {
            console.error(`❌ [WORKER] Error saving element ${elementData.structureNumber}:`, error.message);
            errors.push({
              row: `Element ${elementData.structureNumber}`,
              message: error.message
            });
          }
        }
        
        console.log(`✅ [WORKER] Saved ${savedCount} elements, ${duplicateCount} duplicates, ${totalJobsCreated} jobs created`);
        
        // Stage 5: Finalize (90-100%)
        await job.updateProgress({ 
          stage: 'finalizing', 
          percent: 90, 
          message: 'Finalizing...' 
        });
        
        // Update project count
        await Task.findByIdAndUpdate(projectId, {
          $inc: { structuralElementsCount: savedCount }
        });
        
        // Invalidate cache
        await invalidateCache(`cache:jobs:project:${projectId}:*`);
        await invalidateCache(`cache:stats:project:${projectId}`);
        
        // Clean up file
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.error('Error deleting file:', error);
        }
        
        await job.updateProgress({ 
          stage: 'completed', 
          percent: 100, 
          message: `Complete! Saved ${savedCount} elements, created ${totalJobsCreated} jobs` 
        });
        
        console.log(`✅ [WORKER] Job ${job.id} completed successfully`);
        
        return {
          success: true,
          savedElements: savedCount,
          duplicateElements: duplicateCount,
          jobsCreated: totalJobsCreated,
          errors: errors.slice(0, 5),
          totalRows: excelData.length
        };
        
      } catch (error) {
        console.error(`❌ [WORKER] Job ${job.id} failed:`, error);
        
        // Clean up file on error
        if (filePath) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            console.error('Error deleting file:', e);
          }
        }
        
        throw error;
      }
    },
    {
      connection: {
        host: redisUrl.includes('://') ? new URL(redisUrl).hostname : redisUrl,
        port: redisUrl.includes('://') ? parseInt(new URL(redisUrl).port || '6379') : 6379,
      },
      concurrency: 2, // Process 2 Excel files simultaneously
      limiter: {
        max: 5, // Max 5 jobs
        duration: 60000, // per 60 seconds
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`✅ [WORKER] Job ${job.id} has completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ [WORKER] Job ${job.id} has failed with error:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('❌ [WORKER] Worker error:', err);
  });

  console.log('✅ [WORKER] Excel processing worker started');
  
  return worker;
}

module.exports = { createExcelWorker };
