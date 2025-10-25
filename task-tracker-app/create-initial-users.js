const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

// Connect to MongoDB (will use the same connection as the app)
const createInitialUsers = async () => {
  try {
    // Check if users already exist
    const existingAdmin = await User.findOne({ username: 'admin' });
    const existingEngineer = await User.findOne({ username: 'engineer' });
    
    if (!existingAdmin) {
      // Create admin user
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      
      const adminUser = new User({
        name: 'System Administrator',
        username: 'admin',
        email: 'admin@tasktracker.com',
        password: hashedPassword,
        role: 'admin',
        department: 'IT Administration',
        isActive: true
      });
      
      await adminUser.save();
      console.log('Admin user created: username=admin, password=admin123');
    }
    
    if (!existingEngineer) {
      // Create engineer user
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('engineer123', salt);
      
      const engineerUser = new User({
        name: 'Site Engineer',
        username: 'engineer',
        email: 'engineer@tasktracker.com',
        password: hashedPassword,
        role: 'site-engineer',
        department: 'Engineering',
        isActive: true
      });
      
      await engineerUser.save();
      console.log('Engineer user created: username=engineer, password=engineer123');
    }
    
    if (existingAdmin && existingEngineer) {
      console.log('Initial users already exist');
    }
    
  } catch (error) {
    console.error('Error creating initial users:', error);
  }
};

module.exports = createInitialUsers;