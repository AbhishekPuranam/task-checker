const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/tasktracker')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define StructuralElement model
const structuralElementSchema = new mongoose.Schema({
  memberNumber: String,
  memberType: String,
  memberWeight: Number,
  surfaceAreaSqm: Number,
  quantity: Number,
  status: String,
  jobs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job'
  }]
});

const StructuralElement = mongoose.model('StructuralElement', structuralElementSchema);

// Define Job model
const jobSchema = new mongoose.Schema({
  structuralElementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StructuralElement'
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'not_applicable'],
    default: 'pending'
  }
});

const Job = mongoose.model('Job', jobSchema);

async function debugSurfaceArea() {
  try {
    console.log('🔍 Debugging Surface Area Calculations\n');
    
    // Get all structural elements with jobs
    const elements = await StructuralElement.find({}).populate('jobs').lean();
    console.log(`📊 Total Elements Found: ${elements.length}\n`);
    
    // Calculate status for each element (same logic as frontend)
    const elementsWithStatus = elements.map(element => {
      const jobs = element.jobs || [];
      let calculatedStatus;
      
      if (jobs.length === 0) {
        calculatedStatus = 'no jobs';
      } else {
        // Check if any jobs are marked as not_applicable (non clearance)
        const hasNonClearanceJobs = jobs.some(job => job.status === 'not_applicable');
        
        const totalJobs = jobs.length;
        const completedJobs = jobs.filter(job => job.status === 'completed').length;
        
        const completionPercentage = (completedJobs / totalJobs) * 100;
        
        if (totalJobs > 0) {
          if (hasNonClearanceJobs) {
            calculatedStatus = 'non clearance'; // Has non-clearance jobs
          } else if (completionPercentage === 100) {
            calculatedStatus = 'complete'; // Mark complete when all jobs done
          } else if (completionPercentage > 0) {
            calculatedStatus = 'active'; // Some work done but not complete
          } else {
            calculatedStatus = 'no jobs'; // No jobs started yet
          }
        } else {
          calculatedStatus = 'no jobs';
        }
      }
      
      return {
        ...element,
        status: calculatedStatus
      };
    });
    
    // Group by status and calculate surface areas
    const statusGroups = {
      'non clearance': [],
      'no jobs': [],
      'active': [],
      'complete': []
    };
    
    elementsWithStatus.forEach(element => {
      const status = element.status || 'no jobs';
      if (statusGroups[status]) {
        statusGroups[status].push(element);
      } else {
        console.log(`⚠️  Unknown status: ${status} for element ${element.memberNumber}`);
      }
    });
    
    // Calculate and display surface areas for each section
    let totalCalculated = 0;
    
    console.log('📋 Surface Area by Status Section:');
    console.log('=====================================\n');
    
    Object.entries(statusGroups).forEach(([status, elements]) => {
      const sectionSurfaceArea = elements.reduce((sum, el) => sum + (el.surfaceAreaSqm || 0), 0);
      totalCalculated += sectionSurfaceArea;
      
      console.log(`🔸 ${status.toUpperCase()}`);
      console.log(`   Elements: ${elements.length}`);
      console.log(`   Surface Area: ${sectionSurfaceArea.toFixed(2)} sqm`);
      
      if (elements.length > 0) {
        console.log(`   Sample elements:`);
        elements.slice(0, 3).forEach(el => {
          console.log(`     - ${el.memberNumber}: ${el.surfaceAreaSqm} sqm (Jobs: ${el.jobs?.length || 0})`);
        });
        if (elements.length > 3) {
          console.log(`     ... and ${elements.length - 3} more`);
        }
      }
      console.log('');
    });
    
    // Calculate total from all elements directly
    const directTotal = elementsWithStatus.reduce((sum, el) => sum + (el.surfaceAreaSqm || 0), 0);
    
    console.log('🧮 SUMMARY:');
    console.log('===========');
    console.log(`Total by sections: ${totalCalculated.toFixed(2)} sqm`);
    console.log(`Direct total: ${directTotal.toFixed(2)} sqm`);
    console.log(`Expected total: 4506.53 sqm`);
    console.log(`Difference from expected: ${(directTotal - 4506.53).toFixed(2)} sqm`);
    
    if (Math.abs(totalCalculated - directTotal) > 0.01) {
      console.log(`❌ MISMATCH: Section total (${totalCalculated.toFixed(2)}) != Direct total (${directTotal.toFixed(2)})`);
    } else {
      console.log(`✅ Calculation consistency verified`);
    }
    
    // Check for elements with missing or invalid surface area
    const elementsWithIssues = elementsWithStatus.filter(el => !el.surfaceAreaSqm || el.surfaceAreaSqm <= 0);
    if (elementsWithIssues.length > 0) {
      console.log(`\n⚠️  Elements with missing/invalid surface area: ${elementsWithIssues.length}`);
      elementsWithIssues.forEach(el => {
        console.log(`   - ${el.memberNumber}: ${el.surfaceAreaSqm}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

debugSurfaceArea();