// backend/routes/auth.js - Enhanced version
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const rateLimit = require('express-rate-limit');

const JWT_SECRET = require('../config/jwt');

// Rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to login route
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create token with longer expiry and user info
    const token = jwt.sign(
      { 
        id: user._id,
        username: user.username,
        role: user.role 
      }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );

    const publicUser = user.toObject();
    delete publicUser.password;

    res.json({
      token,
      user: {
        ...publicUser,
        _id: user._id,
        id: user._id
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

const authenticateUser = require('../middleware/authMiddleware');

// Get current logged-in user
router.get('/me', authenticateUser, (req, res) => {
  res.json(req.user); // user is attached by middleware
});


module.exports = router;
