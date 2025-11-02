const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// Admin credentials
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_EMAIL = 'admin@tasktracker.com';

async function createAdmin() {
  try {
    // Read MongoDB password from Docker secrets (if running in container)
    // or use environment variable for local testing
    let mongoPassword;
    try {
      const fs = require('fs');
      mongoPassword = fs.readFileSync('/run/secrets/mongodb_password', 'utf8').trim();
    } catch (err) {
      mongoPassword = process.env.MONGODB_PASSWORD || 'your-mongodb-password';
    }

    // Connect to MongoDB (use 'mongodb' hostname when running in Docker)
    const mongoHost = process.env.MONGO_HOST || 'mongodb';
    const mongoUri = `mongodb://admin:${mongoPassword}@${mongoHost}:27017/projecttracker?authSource=admin`;
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Define User schema
    const userSchema = new mongoose.Schema({
      username: { type: String, required: true, unique: true },
      email: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      role: { type: String, required: true },
      name: String,
      isActive: { type: Boolean, default: true },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    });

    const User = mongoose.model('User', userSchema);

    // Check if admin already exists
    const existingAdmin = await User.findOne({ username: ADMIN_USERNAME });
    if (existingAdmin) {
      console.log('Admin user already exists');
      console.log('Updating password...');
      
      // Hash the password
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      
      // Update the existing admin
      existingAdmin.password = hashedPassword;
      existingAdmin.updatedAt = new Date();
      await existingAdmin.save();
      
      console.log('Admin password updated successfully!');
    } else {
      console.log('Creating new admin user...');
      
      // Hash the password
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      console.log('Password hash:', hashedPassword);

      // Create admin user
      const admin = new User({
        username: ADMIN_USERNAME,
        email: ADMIN_EMAIL,
        password: hashedPassword,
        role: 'admin',
        name: 'System Administrator',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await admin.save();
      console.log('Admin user created successfully!');
      console.log('Username:', ADMIN_USERNAME);
      console.log('Password:', ADMIN_PASSWORD);
    }

    await mongoose.connection.close();
    console.log('Done!');
    process.exit(0);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createAdmin();
