const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const authRoutes = require('./routes/auth');

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080'],
  credentials: true
}));
app.use(express.json());

// Serve static files (login page)
app.use(express.static(path.join(__dirname, 'public')));

// Read MongoDB credentials from Docker secrets
const fs = require('fs');
const MONGODB_PASSWORD = fs.readFileSync('/run/secrets/mongodb_password', 'utf8').trim();

// MongoDB Connection
const mongoUri = `mongodb://admin:${MONGODB_PASSWORD}@mongodb:27017/tasktracker?authSource=admin`;
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Auth Service connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);

// Serve login page at root and /login
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth-service' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🔐 Auth Service running on port ${PORT}`);
});
