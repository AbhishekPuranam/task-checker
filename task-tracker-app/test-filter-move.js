// Test script to verify surface area calculations after moving filters to sections
const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/tasktracker')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const StructuralElement = mongoose.model('StructuralElement', new mongoose.Schema({
  memberNumber: String,
  memberType: String,
  surfaceAreaSqm: Number,
  status: String,
  jobs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Job' }]
}));

const Job = mongoose.model('Job', new mongoose.Schema({
  structuralElementId: { type: mongoose.Schema.Types.ObjectId, ref: 'StructuralElement' },
  status: { type: String, enum: ['pending', 'in_progress', 'completed', 'not_applicable'], default: 'pending' }
}));

async function testAfterFilterMove() {
  try {
    console.log('🧪 Testing Surface Area After Filter Move');
    console.log('=========================================\n');
    
    const elements = await StructuralElement.find({}).populate('jobs').lean();
    
    // Simulate the same status calculation logic as frontend
    const elementsWithStatus = elements.map(element => {
      const jobs = element.jobs || [];
      let status;
      
      if (jobs.length === 0) {
        status = 'no jobs';
      } else {
        const hasNonClearance = jobs.some(job => job.status === 'not_applicable');
        const completed = jobs.filter(job => job.status === 'completed').length;
        const total = jobs.length;
        const completionPct = (completed / total) * 100;
        
        if (hasNonClearance) {
          status = 'non clearance';
        } else if (completionPct === 100) {
          status = 'complete';
        } else if (completionPct > 0) {
          status = 'active';
        } else {
          status = 'no jobs';
        }
      }
      
      return { ...element, status };
    });
    
    console.log(`📊 Total Elements: ${elementsWithStatus.length}`);
    console.log(`📏 Total Surface Area: ${elementsWithStatus.reduce((sum, el) => sum + (el.surfaceAreaSqm || 0), 0).toFixed(2)} sqm\n`);
    
    // Test each status section
    const statuses = ['non clearance', 'no jobs', 'active', 'complete'];
    
    console.log('📋 SECTION BREAKDOWN (No Filters Applied):');
    console.log('==========================================');
    
    let totalFromSections = 0;
    
    statuses.forEach(statusName => {
      const sectionElements = elementsWithStatus.filter(el => el.status === statusName);
      const sectionSurfaceArea = sectionElements.reduce((sum, el) => sum + (el.surfaceAreaSqm || 0), 0);
      totalFromSections += sectionSurfaceArea;
      
      console.log(`${statusName.toUpperCase()}:`);
      console.log(`  Elements: ${sectionElements.length}`);
      console.log(`  Surface Area: ${sectionSurfaceArea.toFixed(2)} sqm`);
      console.log('');
    });
    
    console.log(`🔢 Sum of all sections: ${totalFromSections.toFixed(2)} sqm`);
    console.log(`✅ Should now show full totals in each section without global filter reduction\n`);
    
    // Test with a hypothetical filter (e.g., only elements with surface area > 5 sqm)
    const testFilterThreshold = 5;
    console.log(`🔍 TEST: If filtering by surface area > ${testFilterThreshold} sqm:`);
    console.log('===============================================');
    
    let filteredTotalFromSections = 0;
    
    statuses.forEach(statusName => {
      const sectionElements = elementsWithStatus.filter(el => el.status === statusName);
      const filteredSectionElements = sectionElements.filter(el => (el.surfaceAreaSqm || 0) > testFilterThreshold);
      const filteredSectionSurfaceArea = filteredSectionElements.reduce((sum, el) => sum + (el.surfaceAreaSqm || 0), 0);
      filteredTotalFromSections += filteredSectionSurfaceArea;
      
      console.log(`${statusName.toUpperCase()}:`);
      console.log(`  Filtered Elements: ${filteredSectionElements.length} (was ${sectionElements.length})`);
      console.log(`  Filtered Surface Area: ${filteredSectionSurfaceArea.toFixed(2)} sqm`);
      console.log('');
    });
    
    console.log(`🔢 Sum of filtered sections: ${filteredTotalFromSections.toFixed(2)} sqm`);
    console.log(`📉 Reduction: ${(totalFromSections - filteredTotalFromSections).toFixed(2)} sqm`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

testAfterFilterMove();