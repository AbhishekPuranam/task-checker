const jwt = require('jsonwebtoken');
const User = require('../models/User');
const fs = require('fs');

// Read JWT secret from Docker secrets
const JWT_SECRET = fs.readFileSync('/run/secrets/jwt_secret', 'utf8').trim();

const auth = async (req, res, next) => {
  try {
    // Try to get token from Authorization header first, then from cookie
    let token = req.header('Authorization')?.replace('Bearer ', '');
    
    // If no Authorization header, check for token in cookies
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    // Handle both 'userId' and 'id' for backwards compatibility
    const userId = decoded.userId || decoded.id;
    const user = await User.findById(userId).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Token is not valid.' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error.message);
    res.status(401).json({ message: 'Token is not valid.' });
  }
};

const adminAuth = async (req, res, next) => {
  try {
    await auth(req, res, () => {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admin role required.' });
      }
      next();
    });
  } catch (error) {
    res.status(401).json({ message: 'Authentication failed.' });
  }
};

module.exports = { auth, adminAuth };