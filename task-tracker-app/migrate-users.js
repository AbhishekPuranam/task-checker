const mongoose = require('mongoose');
const User = require('./models/User');

const migrateExistingUsers = async () => {
  try {
    console.log('Starting user migration...');
    
    // Find admin user by email and add username
    const adminUser = await User.findOne({ email: 'admin@tasktracker.com' });
    if (adminUser && !adminUser.username) {
      adminUser.username = 'admin';
      adminUser.role = 'admin'; // Ensure role is correct
      await adminUser.save();
      console.log('✅ Admin user updated with username: admin');
    }
    
    // Find engineer user by email and add username
    const engineerUser = await User.findOne({ email: 'engineer@tasktracker.com' });
    if (engineerUser && !engineerUser.username) {
      engineerUser.username = 'engineer';
      engineerUser.role = 'site-engineer'; // Update role to new format
      await engineerUser.save();
      console.log('✅ Engineer user updated with username: engineer');
    }
    
    console.log('User migration completed successfully!');
    
  } catch (error) {
    console.error('Error during user migration:', error);
  }
};

module.exports = migrateExistingUsers;