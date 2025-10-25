const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

// Database initialization script
async function initializeDatabase() {
  try {
    console.log('Starting database initialization...');

    // Use existing connection (don't create a new one)
    if (mongoose.connection.readyState !== 1) {
      console.log('Waiting for MongoDB connection...');
      await new Promise((resolve) => {
        if (mongoose.connection.readyState === 1) {
          resolve();
        } else {
          mongoose.connection.once('connected', resolve);
        }
      });
    }

    // Check if admin user exists
    const adminExists = await User.findOne({ email: 'admin@tasktracker.com' });
    
    if (!adminExists) {
      // Create default admin user
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      
      const admin = new User({
        name: 'System Administrator',
        email: 'admin@tasktracker.com',
        password: hashedPassword,
        role: 'admin',
        department: 'Administration',
        phoneNumber: '+1-234-567-8900',
        isActive: true
      });
      
      await admin.save();
      console.log('✅ Default admin user created successfully!');
      console.log('📧 Email: admin@tasktracker.com');
      console.log('🔑 Password: admin123');
      console.log('⚠️  Please change the password after first login!');
    } else {
      console.log('ℹ️  Admin user already exists');
    }

    // Check if sample engineer exists
    const engineerExists = await User.findOne({ email: 'engineer@tasktracker.com' });
    
    if (!engineerExists) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('engineer123', salt);
      
      const engineer = new User({
        name: 'Sample Engineer',
        email: 'engineer@tasktracker.com',
        password: hashedPassword,
        role: 'engineer',
        department: 'Field Operations',
        phoneNumber: '+1-234-567-8901',
        isActive: true
      });
      
      await engineer.save();
      console.log('✅ Default engineer user created successfully!');
      console.log('📧 Email: engineer@tasktracker.com');
      console.log('🔑 Password: engineer123');
    } else {
      console.log('ℹ️  Engineer user already exists');
    }

    console.log('\n🎉 Database initialization completed!');
    console.log('\n📋 Login Credentials:');
    console.log('👤 Admin Login:');
    console.log('   Email: admin@tasktracker.com');
    console.log('   Password: admin123');
    console.log('\n👷 Engineer Login:');
    console.log('   Email: engineer@tasktracker.com');  
    console.log('   Password: engineer123');
    console.log('\n⚠️  Remember to change default passwords!');

  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
  // Don't close the connection - let the main server handle it
}

// Run if called directly
if (require.main === module) {
  // If running directly, create our own connection
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tasktracker';
  mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }).then(async () => {
    await initializeDatabase();
    await mongoose.connection.close();
    process.exit(0);
  }).catch(err => {
    console.error('Connection error:', err);
    process.exit(1);
  });
}

module.exports = initializeDatabase;