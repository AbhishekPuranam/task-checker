// Initialize OpenTelemetry tracing (must be first)
if (process.env.OTEL_ENABLED !== 'false') {
  require('./tracing');
}

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const authorizationRoutes = require('./routes/authorization');

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:8080'],
  credentials: true
}));
app.use(express.json());

// MongoDB Connection
console.log('🔗 Attempting to connect to MongoDB...');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongodb:27017/tasktracker', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB connected successfully (Authorizer Service)');
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Routes
app.use('/api/authorize', authorizationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'authorizer-service' });
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`🚀 Authorizer Service running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Mongoose connection event handlers
mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  Mongoose disconnected from MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  process.exit(0);
});
