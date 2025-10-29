const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Authorization endpoint - receives authToken from auth-service and returns scoped token + redirect
router.post('/authorize', async (req, res) => {
  try {
    const { authToken } = req.body;

    if (!authToken) {
      return res.status(400).json({ message: 'authToken is required' });
    }

    // Verify the authToken
    let decoded;
    try {
      decoded = jwt.verify(authToken, JWT_SECRET);
    } catch (error) {
      console.error('Token verification failed:', error.message);
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    // Find user
    const user = await User.findById(decoded.id || decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    console.log(`✅ Authorization granted for user: ${user.username} with scope: ${user.role}`);

    // Generate scoped token
    const scopedToken = jwt.sign(
      { 
        userId: user._id,
        username: user.username, 
        role: user.role,
        scope: user.role // Scoped to the user's role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Determine redirect URL based on role
    let redirectUrl;
    if (user.role === 'admin') {
      redirectUrl = 'http://localhost/admin/projects';
    } else if (user.role === 'site_engineer' || user.role === 'site-engineer') {
      redirectUrl = 'http://localhost/engineer';
    } else {
      return res.status(403).json({ message: `Invalid user role: ${user.role}` });
    }

    // Set scoped token in cookie
    res.cookie('token', scopedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Return scoped token and redirect URL
    res.json({
      message: 'Authorization successful',
      token: scopedToken,
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
    console.error('Authorization error:', error);
    res.status(500).json({ message: 'Server error during authorization' });
  }
});

module.exports = router;
