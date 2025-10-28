// Simple verification of surface area totals by section
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

async function quickCheck() {
  try {
    const elements = await StructuralElement.find({}).populate('jobs').lean();
    console.log(`Total elements: ${elements.length}`);
    
    // Group by calculated status
    const byStatus = {
      'non clearance': 0,
      'no jobs': 0, 
      'active': 0,
      'complete': 0
    };
    
    const surfaceByStatus = {
      'non clearance': 0,
      'no jobs': 0,
      'active': 0, 
      'complete': 0
    };

    elements.forEach(el => {
      const jobs = el.jobs || [];
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
      
      byStatus[status]++;
      surfaceByStatus[status] += (el.surfaceAreaSqm || 0);
    });
    
    console.log('\n📊 SUMMARY BY STATUS:');
    Object.keys(byStatus).forEach(status => {
      console.log(`${status.toUpperCase()}: ${byStatus[status]} elements, ${surfaceByStatus[status].toFixed(2)} sqm`);
    });
    
    const total = Object.values(surfaceByStatus).reduce((sum, val) => sum + val, 0);
    console.log(`\n🔢 TOTAL: ${total.toFixed(2)} sqm`);
    console.log(`Expected: 4506.53 sqm`);
    console.log(`Match: ${Math.abs(total - 4506.53) < 0.01 ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

quickCheck();