#!/bin/bash

# Task Tracker Setup Script
# This script sets up the complete Task Tracker application

echo "🚀 Setting up Task Tracker Application..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    echo -e "${YELLOW}⚠️  MongoDB is not running. Please start MongoDB first.${NC}"
    echo "   You can start MongoDB with: brew services start mongodb/brew/mongodb-community"
    echo "   Or: sudo systemctl start mongod (Linux)"
fi

echo -e "${BLUE}📦 Installing backend dependencies...${NC}"
npm install

echo -e "${BLUE}📦 Installing frontend dependencies...${NC}"
cd client
npm install
cd ..

echo -e "${BLUE}⚙️  Setting up environment...${NC}"
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}✅ Environment file created. Please edit .env with your configuration.${NC}"
else
    echo -e "${YELLOW}⚠️  Environment file already exists.${NC}"
fi

# Create upload directories
mkdir -p uploads/structural
mkdir -p uploads/tasks

echo -e "${BLUE}🗄️  Setting up database...${NC}"

# Create a simple database initialization script
cat > init-db.js << 'EOF'
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tasktracker', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function initializeDatabase() {
  try {
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
        department: 'IT',
        isActive: true
      });
      
      await admin.save();
      console.log('✅ Default admin user created:');
      console.log('   Email: admin@tasktracker.com');
      console.log('   Password: admin123');
      console.log('   ⚠️  Please change the password after first login!');
    } else {
      console.log('✅ Admin user already exists');
    }

    // Create sample engineer user
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
        isActive: true
      });
      
      await engineer.save();
      console.log('✅ Default engineer user created:');
      console.log('   Email: engineer@tasktracker.com');
      console.log('   Password: engineer123');
    } else {
      console.log('✅ Engineer user already exists');
    }
    
    console.log('🎉 Database initialization completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    process.exit(1);
  }
}

initializeDatabase();
EOF

echo -e "${BLUE}👥 Creating default users...${NC}"
node init-db.js

# Clean up
rm init-db.js

echo ""
echo -e "${GREEN}🎉 Setup completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "1. Edit .env file with your MongoDB connection and JWT secret"
echo "2. Start the backend: ${YELLOW}npm run dev${NC}"
echo "3. Start the frontend: ${YELLOW}cd client && npm start${NC}"
echo "4. Access the application at: ${BLUE}http://localhost:3000${NC}"
echo ""
echo -e "${GREEN}🔐 Default Login Credentials:${NC}"
echo -e "${BLUE}Admin:${NC}"
echo "   Email: admin@tasktracker.com"
echo "   Password: admin123"
echo ""
echo -e "${BLUE}Engineer:${NC}"
echo "   Email: engineer@tasktracker.com"
echo "   Password: engineer123"
echo ""
echo -e "${YELLOW}⚠️  Remember to change default passwords after first login!${NC}"