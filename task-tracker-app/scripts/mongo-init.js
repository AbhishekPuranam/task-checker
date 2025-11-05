// MongoDB initialization script for Docker
db = db.getSiblingDB('tasktracker');

// Create collections
db.createCollection('users');
db.createCollection('structuralelements');
db.createCollection('tasks');

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true });

// IMPORTANT: serialNo should be unique within a project, not globally
// This allows different projects to have elements with the same serial numbers
db.structuralelements.createIndex({ project: 1, serialNo: 1 }, { unique: true });
db.structuralelements.createIndex({ project: 1, structureNumber: 1 });
db.structuralelements.createIndex({ projectName: 1 });

db.tasks.createIndex({ structuralElement: 1 });
db.tasks.createIndex({ createdBy: 1 });
db.tasks.createIndex({ status: 1 });

print('TaskTracker database initialized successfully!');