const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/tasktracker')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const StructuralElement = mongoose.model('StructuralElement', new mongoose.Schema({
  memberNumber: String,
  memberType: String,
  surfaceAreaSqm: Number,
  qty: Number,
  status: String,
  jobs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Job' }]
}));

async function checkFilterRanges() {
  try {
    const elements = await StructuralElement.find({}).lean();
    console.log(`Total elements: ${elements.length}`);
    
    const surfaceAreas = elements.map(el => el.surfaceAreaSqm || 0);
    const quantities = elements.map(el => el.qty || 0);
    
    const maxSurfaceArea = Math.max(...surfaceAreas);
    const minSurfaceArea = Math.min(...surfaceAreas);
    const maxQuantity = Math.max(...quantities);
    const minQuantity = Math.min(...quantities);
    
    console.log(`Surface Area Range: ${minSurfaceArea} - ${maxSurfaceArea}`);
    console.log(`Quantity Range: ${minQuantity} - ${maxQuantity}`);
    
    // Check how many elements would be filtered by default ranges
    const elementsInDefaultSurfaceRange = elements.filter(el => (el.surfaceAreaSqm || 0) <= 1000);
    const elementsInDefaultQtyRange = elements.filter(el => (el.qty || 0) <= 100);
    
    console.log(`Elements with surface area <= 1000: ${elementsInDefaultSurfaceRange.length}`);
    console.log(`Elements with quantity <= 100: ${elementsInDefaultQtyRange.length}`);
    
    // Check elements that pass both filters
    const elementsPassingBothFilters = elements.filter(el => 
      (el.surfaceAreaSqm || 0) <= 1000 && (el.qty || 0) <= 100
    );
    console.log(`Elements passing both default filters: ${elementsPassingBothFilters.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

checkFilterRanges();