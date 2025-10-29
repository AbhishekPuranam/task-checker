const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// User Schema (inline for standalone script)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'site-engineer'], required: true },
  department: String,
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Connect to MongoDB
mongoose.connect('mongodb://mongodb:27017/tasktracker', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

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
      console.log('✅ Admin user created:');
      console.log('   Username: admin');
      console.log('   Password: admin123');
    } else {
      console.log('ℹ️  Admin user already exists');
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
      console.log('✅ Engineer user created:');
      console.log('   Username: engineer');
      console.log('   Password: engineer123');
    } else {
      console.log('ℹ️  Engineer user already exists');
    }
    
    // List all users
    const allUsers = await User.find({}, 'username email role');
    console.log('\n📋 All users in database:');
    allUsers.forEach(user => {
      console.log(`   - ${user.username} (${user.role}) - ${user.email}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating users:', error);
    process.exit(1);
  }
};

// Run the function
createInitialUsers();
