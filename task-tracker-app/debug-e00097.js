const mongoose = require('mongoose');
const StructuralElement = require('./models/StructuralElement');
const Job = require('./models/Job');

mongoose.connect('mongodb://localhost:27017/task-tracker').then(async () => {
  console.log('Connected to MongoDB');
  
  try {
    console.log('=== DEBUGGING E00097 ELEMENTS ===\n');
    
    // Find all E00097 elements
    const e00097Elements = await StructuralElement.find({ 
      structureNumber: 'E00097' 
    }).select('_id structureNumber gridNo sectionSizes memberType surfaceAreaSqm');
    
    console.log(`Found ${e00097Elements.length} E00097 elements:`);
    e00097Elements.forEach((element, index) => {
      console.log(`${index + 1}. ID: ${element._id}`);
      console.log(`   Structure: ${element.structureNumber}`);
      console.log(`   Grid: ${element.gridNo}`);
      console.log(`   Section: ${element.sectionSizes}`);
      console.log(`   Member Type: ${element.memberType}`);
      console.log(`   Surface Area: ${element.surfaceAreaSqm}`);
      console.log('');
    });
    
    console.log('=== JOBS FOR E00097 ELEMENTS ===\n');
    
    // Find jobs for each E00097 element
    for (const element of e00097Elements) {
      console.log(`Jobs for Element ${element._id} (${element.structureNumber} - ${element.gridNo}):`);
      
      const jobs = await Job.find({ 
        structuralElement: element._id 
      }).select('_id jobTitle jobType status progressPercentage structuralElement');
      
      if (jobs.length === 0) {
        console.log('  ❌ No jobs found');
      } else {
        console.log(`  ✅ Found ${jobs.length} jobs:`);
        jobs.forEach((job, index) => {
          console.log(`    ${index + 1}. Job ID: ${job._id}`);
          console.log(`       Title: ${job.jobTitle}`);
          console.log(`       Type: ${job.jobType}`);
          console.log(`       Status: ${job.status}`);
          console.log(`       Progress: ${job.progressPercentage}%`);
          console.log(`       Element Ref: ${job.structuralElement}`);
          console.log('');
        });
      }
      console.log('---\n');
    }
    
    console.log('=== ALL JOBS WITH STRUCTURE NUMBER E00097 ===\n');
    
    // Alternative: Find jobs that reference E00097 in any way
    const allE00097Jobs = await Job.find({}).populate('structuralElement', 'structureNumber gridNo');
    const e00097Jobs = allE00097Jobs.filter(job => 
      job.structuralElement && job.structuralElement.structureNumber === 'E00097'
    );
    
    console.log(`Found ${e00097Jobs.length} jobs referencing E00097 elements:`);
    e00097Jobs.forEach((job, index) => {
      console.log(`${index + 1}. Job: ${job.jobTitle} (${job.jobType})`);
      console.log(`   Status: ${job.status}`);
      console.log(`   Progress: ${job.progressPercentage}%`);
      console.log(`   Element: ${job.structuralElement.structureNumber} - ${job.structuralElement.gridNo}`);
      console.log(`   Element ID: ${job.structuralElement._id}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  mongoose.disconnect();
}).catch(console.error);