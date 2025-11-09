const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    res.json({
      service: 'auth-service',
      status: 'healthy',
      mongodb: mongoStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      service: 'auth-service',
      status: 'unhealthy',
      error: error.message
    });
  }
});

module.exports = router;
