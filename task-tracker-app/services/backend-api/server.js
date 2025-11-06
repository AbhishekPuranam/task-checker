// Initialize OpenTelemetry tracing FIRST
require('./tracing');

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
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const { createExcelWorker } = require('./workers/excelProcessor');
const { createBatchExcelWorker } = require('./workers/excelProcessorBatch');
const { startProgressWorker } = require('./workers/progressCalculator');

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
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny'
  },
  noSniff: true,
  xssFilter: true
}));

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
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      process.env.CLIENT_URL
    ].filter(Boolean);
    
    // Allow any origin in production for flexibility
    // In production, Traefik handles the routing so all requests come from same origin
    if (process.env.NODE_ENV === 'production') {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  // SECURITY: Prevent prototype pollution
  reviver: (key, value) => {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return undefined;
    }
    return value;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files for uploads (avatars, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Read MongoDB credentials from Docker secrets
const fs = require('fs');
let MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  try {
    const MONGODB_PASSWORD = fs.readFileSync('/run/secrets/mongodb_password', 'utf8').trim();
    MONGODB_URI = `mongodb://admin:${MONGODB_PASSWORD}@mongodb:27017/tasktracker?authSource=admin`;
  } catch (err) {
    console.warn('Warning: Could not read MongoDB password from secrets, using default connection');
    MONGODB_URI = 'mongodb://mongodb:27017/tasktracker';
  }
}

// Connect to MongoDB with retry logic and persistent connection
const connectWithRetry = () => {
  console.log('Attempting to connect to MongoDB...');
  mongoose.connect(MONGODB_URI, {
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

// Swagger API Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Task Tracker API Documentation',
  customfavIcon: '/favicon.ico'
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/structural-elements', structuralElementRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/excel', excelRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload-sessions', require('./routes/uploadSessions'));

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

// Start Excel processing worker
// Use batch-based worker if EXCEL_BATCH_MODE=true, otherwise use legacy worker
const useBatchMode = process.env.EXCEL_BATCH_MODE === 'true';
let excelWorker;
try {
  if (useBatchMode) {
    excelWorker = createBatchExcelWorker();
    console.log('✅ Batch-based Excel processing worker started successfully');
  } else {
    excelWorker = createExcelWorker();
    console.log('✅ Excel processing worker started successfully (legacy mode)');
  }
} catch (error) {
  console.error('❌ Failed to start Excel worker:', error.message);
  console.warn('⚠️  Excel upload will not work in background mode');
}

// Start Progress calculation worker
let progressWorker;
try {
  progressWorker = startProgressWorker();
  console.log('✅ Progress calculation worker started successfully');
} catch (error) {
  console.error('❌ Failed to start Progress worker:', error.message);
  console.warn('⚠️  Progress calculation will not work in background mode');
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  if (excelWorker) {
    await excelWorker.close();
  }
  if (progressWorker) {
    await progressWorker.close();
  }
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close().then(() => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

module.exports = { app, io };