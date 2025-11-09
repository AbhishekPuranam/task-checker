/**
 * Shared Fire Proofing Jobs Creation Logic
 * 
 * This module provides a centralized location for fire proofing job templates
 * and creation logic, eliminating duplication across routes and workers.
 */

const Job = require('../models/Job');

/**
 * Job templates for different fire proofing workflows
 */
const JOB_TEMPLATES = {
  cement_fire_proofing: [
    { title: 'Surface Preparation', order: 1 },
    { title: 'Rockwool Filling', order: 2 },
    { title: 'Adhesive coat/Primer', order: 3 },
    { title: 'Vermiculite-Cement', order: 4 },
    { title: 'Thickness inspection', order: 5 },
    { title: 'Sealer coat', order: 6 },
    { title: 'WIR', order: 7 },
  ],
  gypsum_fire_proofing: [
    { title: 'Surface Preparation', order: 1 },
    { title: 'Rockwool Filling', order: 2 },
    { title: 'Adhesive coat/Primer', order: 3 },
    { title: 'Vermiculite-Gypsum', order: 4 },
    { title: 'Thickness inspection', order: 5 },
    { title: 'Sealer coat', order: 6 },
    { title: 'WIR', order: 7 },
  ],
  intumescent_coatings: [
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
  refinery_fire_proofing: [
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

/**
 * Get fire proofing type from workflow
 */
function getFireProofingType(workflow) {
  const typeMap = {
    cement_fire_proofing: 'Cement',
    gypsum_fire_proofing: 'Gypsum',
    intumescent_coatings: 'Intumescent',
    refinery_fire_proofing: 'Refinery',
  };
  
  return typeMap[workflow] || 'Other';
}

/**
 * Create fire proofing jobs for a structural element
 * 
 * @param {Object} structuralElement - The structural element document
 * @param {String} userId - ID of the user creating the jobs
 * @param {Object} session - Optional Mongoose session for transactions
 * @returns {Promise<Array>} Array of created job documents
 */
async function createFireProofingJobs(structuralElement, userId, session = null) {
  if (!structuralElement.fireProofingWorkflow) {
    return [];
  }

  const jobTemplates = JOB_TEMPLATES[structuralElement.fireProofingWorkflow];
  
  if (!jobTemplates) {
    throw new Error(`Unknown fire proofing workflow: ${structuralElement.fireProofingWorkflow}`);
  }

  const createdJobs = [];
  const fireProofingType = getFireProofingType(structuralElement.fireProofingWorkflow);

  for (const jobTemplate of jobTemplates) {
    const job = new Job({
      structuralElement: structuralElement._id,
      project: structuralElement.project,
      subProject: structuralElement.subProject || null,
      jobTitle: jobTemplate.title,
      jobDescription: `${jobTemplate.title} for ${structuralElement.structureNumber || 'element'}`,
      jobType: structuralElement.fireProofingWorkflow,
      orderIndex: jobTemplate.order * 100,
      fireProofingType: fireProofingType,
      status: 'pending',
      createdBy: userId,
    });

    const saved = await job.save({ session });
    createdJobs.push(saved);
  }

  return createdJobs;
}

/**
 * Validate fire proofing workflow
 */
function isValidWorkflow(workflow) {
  return workflow && JOB_TEMPLATES.hasOwnProperty(workflow);
}

/**
 * Get available workflows
 */
function getAvailableWorkflows() {
  return Object.keys(JOB_TEMPLATES);
}

module.exports = {
  createFireProofingJobs,
  JOB_TEMPLATES,
  getFireProofingType,
  isValidWorkflow,
  getAvailableWorkflows,
};
