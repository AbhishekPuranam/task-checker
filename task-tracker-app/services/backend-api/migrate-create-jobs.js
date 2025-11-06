#!/usr/bin/env node
/**
 * Migration Script: Create Jobs for Existing Structural Elements
 * 
 * This script creates predefined jobs for all structural elements that:
 * 1. Have a fireProofingWorkflow defined
 * 2. Don't have any jobs created yet
 * 
 * Run with: node scripts/migrate-create-jobs.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const StructuralElement = require('./models/StructuralElement');
const Job = require('./models/Job');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://tasktracker-mongodb:27017/tasktracker';

async function migrateJobs() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Find all structural elements with fireProofingWorkflow but no jobs
    console.log('\n📊 Finding structural elements without jobs...');
    
    const elements = await StructuralElement.find({
      fireProofingWorkflow: { $exists: true, $ne: null }
    }).lean();

    console.log(`Found ${elements.length} elements with fireProofingWorkflow`);

    let elementsProcessed = 0;
    let jobsCreated = 0;
    let elementsSkipped = 0;

    for (const element of elements) {
      try {
        // Check if jobs already exist for this element
        const existingJobsCount = await Job.countDocuments({
          structuralElement: element._id
        });

        if (existingJobsCount > 0) {
          elementsSkipped++;
          console.log(`⏭️  Skipping ${element.structureNumber} - already has ${existingJobsCount} jobs`);
          continue;
        }

        // Create predefined jobs
        console.log(`📝 Creating jobs for ${element.structureNumber} (${element.fireProofingWorkflow})...`);
        
        const createdJobs = await Job.createPredefinedJobs(
          element.fireProofingWorkflow,
          element._id,
          element.project,
          element.createdBy
        );

        jobsCreated += createdJobs.length;
        elementsProcessed++;

        console.log(`   ✅ Created ${createdJobs.length} jobs for ${element.structureNumber}`);

      } catch (error) {
        console.error(`   ❌ Error processing ${element.structureNumber}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`Total elements found:           ${elements.length}`);
    console.log(`Elements processed:             ${elementsProcessed}`);
    console.log(`Elements skipped (had jobs):    ${elementsSkipped}`);
    console.log(`Total jobs created:             ${jobsCreated}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

// Run migration
console.log('🚀 Starting job migration...');
console.log('='.repeat(60));
migrateJobs();
