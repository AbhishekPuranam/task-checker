const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const User = require('../shared/models/User');
const { auth } = require('../shared/middleware/auth');
const { cacheMiddleware, invalidateCache } = require('../shared/middleware/cache');

const router = express.Router();

// Read JWT secret from Docker secrets
const JWT_SECRET = fs.readFileSync('/run/secrets/jwt_secret', 'utf8').trim();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     description: Authenticate user and receive JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin
 *               password:
 *                 type: string
 *                 format: password
 *                 example: admin123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 token:
 *                   type: string
 *                   description: JWT authentication token
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many login attempts
 */

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user
 *     tags: [Authentication]
 *     description: Retrieve authenticated user's information
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: User logout
 *     tags: [Authentication]
 *     description: Logout user and clear authentication token
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Logged out successfully
 */

// SECURITY: Rate limiting for authentication endpoints to prevent brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 registrations per hour
  message: 'Too many accounts created, please try again later',
});

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/avatars');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // SECURITY: Sanitize filename to prevent path traversal
    const sanitizedName = path.basename(file.originalname).replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(sanitizedName);
    cb(null, 'avatar-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    // SECURITY: Strict file type validation
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files (JPEG, PNG, GIF) are allowed!'));
  }
});


// Register
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { name, username, email, password, role, department, phoneNumber } = req.body;

    // Validation
    if (!name || !username || !password) {
      return res.status(400).json({ message: 'Name, username, and password are required' });
    }

    // SECURITY: Validate username format (alphanumeric, underscore, hyphen only)
    const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ 
        message: 'Username must be 3-30 characters and contain only letters, numbers, underscores, and hyphens' 
      });
    }

    if (username.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters long' });
    }

    // SECURITY: Enforce stronger password requirements
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    // SECURITY: Validate email format if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }
    }

    // SECURITY: Validate role to prevent privilege escalation
    const allowedRoles = ['admin', 'site-engineer', 'engineer'];
    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role specified' });
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

    // Hash password first
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    user = new User({
      name: name.trim(),
      username: username.toLowerCase().trim(),
      email: email ? email.toLowerCase().trim() : undefined,
      password: hashedPassword,
      role: role || 'site-engineer',
      department: department || '',
      phoneNumber: phoneNumber || '',
      isActive: true
    });

    await user.save();
    console.log('New user registered:', { name: user.name, username: user.username, role: user.role });

    // Generate JWT token
    const payload = {
      id: user._id,
      role: user.role
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        department: user.department
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Login attempt for:', username);

    // Validation
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // Log mongoose connection state for debugging
    const mongoose = require('mongoose');
    console.log('MongoDB connection state:', mongoose.connection.readyState);

    // Check if user exists
    console.log('Searching for user with username:', username.toLowerCase());
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      console.log('Login attempt failed: User not found for username:', username);
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    console.log('User found:', { id: user._id, username: user.username, role: user.role });

    // Check if user is active
    if (!user.isActive) {
      return res.status(400).json({ message: 'Account is deactivated' });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const payload = {
      id: user._id,
      role: user.role
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

    // Determine redirect URL based on role
    let redirectUrl;
    if (user.role === 'admin') {
      redirectUrl = '/admin/projects';
    } else if (user.role === 'site-engineer' || user.role === 'engineer') {
      redirectUrl = '/engineer';
    } else {
      redirectUrl = '/engineer'; // Default to engineer interface
    }

    res.json({
      token,
      redirectUrl,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        department: user.department
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user
router.get('/me', 
  auth,
  cacheMiddleware(60, (req) => `cache:user:me:${req.user?.id || 'anon'}`),
  async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, department, phoneNumber } = req.body;
    
    const user = await User.findById(req.user.id);
    if (name) user.name = name;
    if (department) user.department = department;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    
    await user.save();
    
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      phoneNumber: user.phoneNumber
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user.id);
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    
    await user.save();
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin-only user creation
router.post('/create-user', auth, async (req, res) => {
  try {
    // Check if the current user is admin
    const currentUser = await User.findById(req.user.id);
    if (currentUser.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

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
      name: name.trim(),
      username: username.toLowerCase().trim(),
      email: email ? email.toLowerCase().trim() : undefined,
      password: hashedPassword,
      role: role,
      department: department || '',
      phoneNumber: phoneNumber || '',
      isActive: true
    });

    await user.save();
    console.log('New user created by admin:', { name: user.name, username: user.username, role: user.role });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        department: user.department,
        phoneNumber: user.phoneNumber,
        isActive: user.isActive,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users (Admin only)
router.get('/users', 
  auth,
  cacheMiddleware(300, () => `cache:users:all`),
  async (req, res) => {
  try {
    // Check if the current user is admin
    const currentUser = await User.findById(req.user.id);
    if (currentUser.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user (Admin only)
router.put('/users/:id', auth, async (req, res) => {
  try {
    // Check if the current user is admin
    const currentUser = await User.findById(req.user.id);
    if (currentUser.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    const { name, username, email, role, department, phoneNumber, isActive } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if username is being changed and if it already exists
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username: username.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }
      user.username = username.toLowerCase().trim();
    }

    // Check if email is being changed and if it already exists
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already exists' });
      }
      user.email = email.toLowerCase().trim();
    }

    if (name) user.name = name.trim();
    if (role && ['admin', 'site-engineer'].includes(role)) user.role = role;
    if (department !== undefined) user.department = department;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    res.json({
      message: 'User updated successfully',
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        department: user.department,
        phoneNumber: user.phoneNumber,
        isActive: user.isActive,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update own profile
router.put('/profile', auth, upload.single('avatar'), async (req, res) => {
  try {
    const { name, email, phoneNumber, department } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update basic info
    if (name) user.name = name.trim();
    if (email) {
      // Check if email already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        return res.status(400).json({ message: 'Email already exists' });
      }
      user.email = email.toLowerCase().trim();
    }
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    if (department !== undefined) user.department = department;

    // Handle avatar upload
    if (req.file) {
      // Delete old avatar if it exists
      if (user.avatar) {
        const oldAvatarPath = path.join(__dirname, '..', user.avatar);
        if (fs.existsSync(oldAvatarPath)) {
          fs.unlinkSync(oldAvatarPath);
        }
      }
      // Save new avatar path (relative to server root)
      user.avatar = '/uploads/avatars/' + req.file.filename;
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        department: user.department,
        phoneNumber: user.phoneNumber,
        avatar: user.avatar,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password
router.put('/change-password', auth, authLimiter, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    // SECURITY: Enforce stronger password requirements
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long' });
    }

    // SECURITY: Prevent password reuse
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // SECURITY: Check if new password is same as current password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({ message: 'New password must be different from current password' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12); // Increased from 10 to 12 for better security
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;