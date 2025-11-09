const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5007;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
const MONGODB_PASSWORD = fs.existsSync('/run/secrets/mongodb_password') 
  ? fs.readFileSync('/run/secrets/mongodb_password', 'utf8').trim()
  : process.env.MONGODB_PASSWORD || '';

const mongoUri = MONGODB_PASSWORD 
  ? `mongodb://admin:${MONGODB_PASSWORD}@mongodb:27017/tasktracker?authSource=admin&replicaSet=rs0`
  : 'mongodb://mongodb:27017/tasktracker';

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ MongoDB connected to metrics-service');
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Routes
app.use('/health', require('./routes/health'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/metrics', require('./routes/reports')); // Same reports route for metrics endpoint

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 metrics-service running on port ${PORT}`);
});

module.exports = app;
