// backend/routes/auth.js - Enhanced version
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const rateLimit = require('express-rate-limit');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret'; // Use environment variable

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
      { expiresIn: '24h' } // Extended to 24 hours
    );

    res.json({ 
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        surname: user.surname,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});
router.post('/register', async (req, res) => {
  const {
    username,
    name,
    surname,
    email,
    password,
    birthdate,
    personalCode,
    address,
    role
  } = req.body;

  // Basic validation
  if (!username || !name || !surname || !email || !password || !birthdate || !personalCode || !address) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // Check if user or email or personalCode already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }, { personalCode }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this username, email or personal code already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create and save the user
    const newUser = new User({
      username,
      name,
      surname,
      email,
      password: hashedPassword,
      birthdate,
      personalCode,
      address,
      role
    });

    await newUser.save();

    res.status(201).json({ message: 'User registered successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while registering user' });
  }
});

const authenticateUser = require('../middleware/authMiddleware');

// Get current logged-in user
router.get('/me', authenticateUser, (req, res) => {
  res.json(req.user); // user is attached by middleware
});


module.exports = router;
