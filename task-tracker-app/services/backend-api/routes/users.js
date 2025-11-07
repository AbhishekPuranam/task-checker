const express = require('express');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');
const bcrypt = require('bcryptjs');

const router = express.Router();

// Get all users (admin only)
router.get('/', 
  adminAuth,
  cacheMiddleware(300, () => `cache:users:all`),
  async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select('-password')
      .sort({ name: 1 });
    
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get engineers list (for task assignment)
router.get('/engineers', 
  auth,
  cacheMiddleware(300, () => `cache:users:engineers`),
  async (req, res) => {
  try {
    const engineers = await User.find({ 
      role: 'engineer', 
      isActive: true 
    }).select('name email department');
    
    res.json(engineers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new user (admin only)
router.post('/', adminAuth, async (req, res) => {
  try {
    const { name, username, email, password, role, department, phoneNumber } = req.body;

    // Validation
    if (!name || !username || !password || !role) {
      return res.status(400).json({ message: 'Name, username, password, and role are required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters long' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    if (!['admin', 'site-engineer'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be admin or site-engineer' });
    }

    // Check if user already exists with this username
    let user = await User.findOne({ username: username.toLowerCase() });
    if (user) {
      return res.status(400).json({ message: 'User already exists with this username' });
    }

    // Check if email is provided and already exists
    if (email) {
      const emailExists = await User.findOne({ email: email.toLowerCase() });
      if (emailExists) {
        return res.status(400).json({ message: 'User already exists with this email' });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    user = new User({
      name,
      username: username.toLowerCase(),
      email: email ? email.toLowerCase() : undefined,
      password: hashedPassword,
      role,
      department,
      phoneNumber,
      isActive: true
    });

    await user.save();

    // Invalidate user caches
    await invalidateCache('cache:users:*');

    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password;

    // Prevent browser caching
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.status(201).json({ 
      message: 'User created successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user (admin only)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { name, username, email, password, role, department, phoneNumber, isActive } = req.body;
    
    // Find the user
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validation
    if (username && username.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters long' });
    }

    if (password && password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    if (role && !['admin', 'site-engineer'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be admin or site-engineer' });
    }

    // Check if username is being changed and already exists
    if (username && username.toLowerCase() !== user.username) {
      const existingUser = await User.findOne({ username: username.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }
    }

    // Check if email is being changed and already exists
    if (email && email.toLowerCase() !== user.email) {
      const existingEmail = await User.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }

    // Update fields
    if (name) user.name = name;
    if (username) user.username = username.toLowerCase();
    if (email !== undefined) user.email = email ? email.toLowerCase() : undefined;
    if (role) user.role = role;
    if (department !== undefined) user.department = department;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    if (isActive !== undefined) user.isActive = isActive;

    // Update password if provided
    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    await user.save();

    // Invalidate user caches
    await invalidateCache('cache:users:*');
    await invalidateCache(`cache:user:${req.params.id}`);

    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password;

    // Prevent browser caching
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json({ 
      message: 'User updated successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent admin from deleting themselves
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.findByIdAndDelete(userId);

    // Invalidate user caches
    await invalidateCache('cache:users:*');
    await invalidateCache(`cache:user:${userId}`);

    // Prevent browser caching
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json({ 
      message: 'User deleted successfully',
      deletedUser: {
        id: user._id,
        username: user.username,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user status (admin only)
router.put('/:id/status', adminAuth, async (req, res) => {
  try {
    const { isActive } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Prevent browser caching
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user profile
router.get('/:id', 
  auth,
  cacheMiddleware(300, (req) => `cache:user:${req.params.id}`),
  async (req, res) => {
  try {
    // Users can only view their own profile unless they're admin
    if (req.user.role !== 'admin' && req.params.id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;