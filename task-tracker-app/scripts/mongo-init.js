// MongoDB initialization script for Docker
db = db.getSiblingDB('tasktracker');

// Create collections
db.createCollection('users');
db.createCollection('structuralelements');
db.createCollection('tasks');

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true });
db.structuralelements.createIndex({ serialNo: 1 }, { unique: true });
db.structuralelements.createIndex({ projectName: 1 });
db.tasks.createIndex({ structuralElement: 1 });
db.tasks.createIndex({ createdBy: 1 });
db.tasks.createIndex({ status: 1 });

print('TaskTracker database initialized successfully!');