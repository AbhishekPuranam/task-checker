const mongoose = require('mongoose');
const Job = require('./models/Job');

async function deleteAllJobs() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://mongodb:27017/tasktracker');
    console.log('Connected to MongoDB');

    // Delete all jobs
    const result = await Job.deleteMany({});
    console.log(`Deleted ${result.deletedCount} jobs from the database`);

    // Close connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error deleting jobs:', error);
    process.exit(1);
  }
}

deleteAllJobs();