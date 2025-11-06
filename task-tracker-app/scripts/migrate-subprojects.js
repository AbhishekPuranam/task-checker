/**
 * Migration Script: Convert existing Projects to Project+SubProject structure
 * 
 * This script creates a default SubProject for each existing Project
 * and migrates all StructuralElements to that SubProject.
 */

const mongoose = require('mongoose');
const Task = require('../services/backend-api/models/Task');
const SubProject = require('../services/backend-api/models/SubProject');
const StructuralElement = require('../services/backend-api/models/StructuralElement');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/task-tracker';

async function migrateToSubProjects() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all projects
    const projects = await Task.find({}).select('_id title createdBy');
    console.log(`\n📊 Found ${projects.length} projects to migrate`);

    let migratedProjects = 0;
    let migratedElements = 0;
    let errors = 0;

    for (const project of projects) {
      try {
        console.log(`\n🔄 Processing project: ${project.title} (${project._id})`);

        // Check if default SubProject already exists
        let subProject = await SubProject.findOne({
          project: project._id,
          code: 'MAIN'
        });

        if (!subProject) {
          // Create default SubProject
          subProject = new SubProject({
            project: project._id,
            name: 'Main Project',
            code: 'MAIN',
            description: 'Default sub-project created during migration',
            status: 'active',
            createdBy: project.createdBy,
            statistics: {
              totalElements: 0,
              completedElements: 0,
              totalSqm: 0,
              completedSqm: 0,
              sections: {
                active: { count: 0, sqm: 0 },
                nonClearance: { count: 0, sqm: 0 },
                noJob: { count: 0, sqm: 0 },
                complete: { count: 0, sqm: 0 }
              }
            }
          });

          await subProject.save();
          console.log(`  ✅ Created default SubProject: ${subProject._id}`);
        } else {
          console.log(`  ℹ️  SubProject 'MAIN' already exists: ${subProject._id}`);
        }

        // Migrate all StructuralElements to this SubProject
        const updateResult = await StructuralElement.updateMany(
          {
            project: project._id,
            subProject: { $exists: false } // Only update elements without a SubProject
          },
          {
            $set: { subProject: subProject._id }
          }
        );

        console.log(`  ✅ Migrated ${updateResult.modifiedCount} structural elements`);
        migratedElements += updateResult.modifiedCount;

        // Recalculate SubProject statistics
        const stats = await SubProject.recalculateStatistics(subProject._id);
        console.log(`  ✅ Recalculated statistics:`, {
          totalElements: stats.totalElements,
          completedElements: stats.completedElements,
          totalSqm: stats.totalSqm.toFixed(2),
          completedSqm: stats.completedSqm.toFixed(2)
        });

        migratedProjects++;
      } catch (error) {
        console.error(`  ❌ Error migrating project ${project._id}:`, error.message);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Projects: ${projects.length}`);
    console.log(`✅ Successfully Migrated: ${migratedProjects}`);
    console.log(`📝 Total Elements Migrated: ${migratedElements}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('='.repeat(60));

    // Verify migration
    console.log('\n🔍 Verifying migration...');
    const elementsWithoutSubProject = await StructuralElement.countDocuments({
      subProject: { $exists: false }
    });

    if (elementsWithoutSubProject > 0) {
      console.warn(`⚠️  WARNING: ${elementsWithoutSubProject} elements still without SubProject`);
    } else {
      console.log('✅ All elements have been assigned to SubProjects');
    }

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Rollback function
async function rollbackMigration() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('⚠️  WARNING: This will delete all SubProjects and remove subProject references!');
    console.log('Press Ctrl+C to cancel within 5 seconds...');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Remove subProject field from all StructuralElements
    const updateResult = await StructuralElement.updateMany(
      {},
      { $unset: { subProject: '' } }
    );

    console.log(`✅ Removed subProject field from ${updateResult.modifiedCount} elements`);

    // Delete all SubProjects
    const deleteResult = await SubProject.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.deletedCount} SubProjects`);

    console.log('\n✅ Rollback completed successfully!');
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run migration or rollback based on command line argument
const command = process.argv[2];

if (command === 'rollback') {
  rollbackMigration().catch(err => {
    console.error('Rollback error:', err);
    process.exit(1);
  });
} else if (command === 'migrate') {
  migrateToSubProjects().catch(err => {
    console.error('Migration error:', err);
    process.exit(1);
  });
} else {
  console.log('Usage:');
  console.log('  node migrate-subprojects.js migrate   - Run migration');
  console.log('  node migrate-subprojects.js rollback  - Rollback migration');
  process.exit(1);
}
