const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const fs = require('fs');

// Read JWT secret from Docker secrets
const JWT_SECRET = fs.readFileSync('/run/secrets/jwt_secret', 'utf8').trim();

// Unified Login - handles both admin and site engineer
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id, 
        username: user.username, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Determine redirect URL based on role (handle both 'site-engineer' and 'site_engineer')
    let redirectUrl;
    if (user.role === 'admin') {
      redirectUrl = '/admin/projects';
    } else if (user.role === 'site_engineer' || user.role === 'site-engineer') {
      redirectUrl = '/engineer';
    } else {
      return res.status(403).json({ message: `Invalid user role: ${user.role}` });
    }

    // Set token in cookie for ForwardAuth (httpOnly, secure in production)
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Return user info, token, and redirect URL
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        name: user.name,
        assignedProjects: user.assignedProjects
      },
      redirectUrl
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Get current user (verify token and return user info)
router.get('/me', async (req, res) => {
  try {
    // Get token from Authorization header or cookie
    let token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token && req.headers.cookie) {
      const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {});
      token = cookies.token;
    }

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    res.json({
      id: user._id,
      username: user.username,
      role: user.role,
      name: user.name,
      assignedProjects: user.assignedProjects
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Register endpoint (for creating new users - admin only)
router.post('/register', async (req, res) => {
  try {
    const { username, password, name, role, assignedProjects } = req.body;

    // Validate input
    if (!username || !password || !name || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new User({
      username,
      password: hashedPassword,
      name,
      role,
      assignedProjects: assignedProjects || []
    });

    await newUser.save();

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser._id,
        username: newUser.username,
        name: newUser.name,
        role: newUser.role
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Verify token endpoint (standard API)
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    res.json({
      valid: true,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        name: user.name,
        assignedProjects: user.assignedProjects
      }
    });

  } catch (error) {
    res.status(401).json({ message: 'Invalid token', valid: false });
  }
});

// Traefik ForwardAuth endpoint - checks token from cookie or Authorization header
router.get('/forward-auth', async (req, res) => {
  try {
    console.log('🔐 ForwardAuth request from:', req.headers['x-forwarded-uri'] || req.url);
    
    // Get token from Authorization header or cookie
    let token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token && req.headers.cookie) {
      const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {});
      token = cookies.token;
    }

    if (!token) {
      console.log('❌ No token found, returning 401');
      // Return 401 which will trigger Traefik to redirect to login
      return res.status(401).send('Unauthorized');
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      console.log('❌ User not found, returning 401');
      return res.status(401).send('Unauthorized');
    }

    console.log('✅ Token valid for user:', user.username, 'role:', user.role);
    
    // Forward user info in headers for downstream services
    res.set('X-User-Id', user._id.toString());
    res.set('X-User-Username', user.username);
    res.set('X-User-Role', user.role);
    res.set('X-User-Name', user.name);
    
    // Return 200 to allow request through
    res.status(200).send('OK');

  } catch (error) {
    console.log('❌ Token verification failed:', error.message);
    res.status(401).send('Unauthorized');
  }
});

module.exports = router;
