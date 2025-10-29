const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const userRoutes = require('./routes/users');
const structuralElementRoutes = require('./routes/structuralElements');
const reportRoutes = require('./routes/reports');
const excelRoutes = require('./routes/excel');
const jobRoutes = require('./routes/jobs');
const projectRoutes = require('./routes/projects');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Security middleware
app.use(helmet());

// Cookie parser middleware
app.use(cookieParser());

// Rate limiting - More lenient for development
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // limit each IP to 1000 requests per minute (much more lenient)
  skip: (req) => {
    // Skip rate limiting for development
    return process.env.NODE_ENV === 'development';
  }
});
app.use(limiter);

// CORS configuration - More permissive
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    process.env.CLIENT_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB with retry logic and persistent connection
const connectWithRetry = () => {
  console.log('Attempting to connect to MongoDB...');
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tasktracker', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 30000,
    maxPoolSize: 10,
    minPoolSize: 5,
    heartbeatFrequencyMS: 10000,
    bufferCommands: false,
  })
  .then(async () => {
    console.log('MongoDB connected successfully');
    
    // Note: Database initialization scripts moved to /scripts folder
    // Run manually with: docker exec tasktracker-app-dev node create-users.js
    // Or use scripts in /scripts folder from the host machine
    
    // Initialize database with default users (commented out - files moved to /scripts)
    // try {
    //   const initializeDatabase = require('./init-db');
    //   await initializeDatabase();
    //   
    //   // Migrate existing users to add usernames
    //   const migrateExistingUsers = require('./migrate-users');
    //   await migrateExistingUsers();
    //   
    //   // Create initial users (if they don't exist)
    //   const createInitialUsers = require('./create-initial-users');
    //   await createInitialUsers();
    // } catch (error) {
    //   console.error('Database initialization error:', error);
    // }
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    console.log('Retrying MongoDB connection in 5 seconds...');
    setTimeout(connectWithRetry, 5000);
  });
};

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
  if (mongoose.connection.readyState === 0) {
    connectWithRetry();
  }
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected');
  if (mongoose.connection.readyState === 0) {
    connectWithRetry();
  }
});

// Graceful exit
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
});

connectWithRetry();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected');
  
  socket.on('join-room', (userId) => {
    socket.join(userId);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Cleanup endpoint - delete all jobs (for development/testing)
app.delete('/api/cleanup-jobs', async (req, res) => {
  try {
    const Job = require('./models/Job');
    const result = await Job.deleteMany({});
    res.json({ 
      success: true, 
      message: `Deleted ${result.deletedCount} jobs from the database` 
    });
  } catch (error) {
    console.error('Error deleting jobs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/structural-elements', structuralElementRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/excel', excelRoutes);
app.use('/api/projects', projectRoutes);

// Health check endpoint (must be before catch-all route)
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, io };