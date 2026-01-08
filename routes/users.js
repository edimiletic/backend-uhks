// backend/routes/users.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authenticateUser = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authenticateUser);

// GET - Get all referees (Admin only)
router.get('/referees', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const referees = await User.find({
      role: { $in: ['Sudac', 'Delegat', 'Pomoćni Sudac'] }
    })
    .select('_id name surname email role personalCode') // Include personalCode for absence checking
    .sort({ role: 1, surname: 1, name: 1 });

    res.json(referees);
  } catch (error) {
    console.error('Get referees error:', error);
    res.status(500).json({ error: 'Failed to fetch referees' });
  }
});

// GET - Get all users (Admin only)
router.get('/', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const users = await User.find()
      .select('-password')
      .sort({ role: 1, surname: 1, name: 1 });

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET - Get user by ID (Admin only)
router.get('/:id', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST - Create new user (Admin only)
router.post('/', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

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
    if (!username || !name || !surname || !email || !password || !birthdate || !personalCode || !address || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }, { personalCode }]
    });

    if (existingUser) {
      return res.status(400).json({ 
        error: 'User with this username, email or personal code already exists' 
      });
    }

    // Hash the password
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
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

    // Return user without password
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json(userResponse);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT - Update user (Admin only)
router.put('/:id', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

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

    // Check for duplicate username, email, or personalCode (excluding current user)
    if (username || email || personalCode) {
      const duplicateQuery = {
        _id: { $ne: req.params.id },
        $or: []
      };

      if (username) duplicateQuery.$or.push({ username });
      if (email) duplicateQuery.$or.push({ email });
      if (personalCode) duplicateQuery.$or.push({ personalCode });

      const existingUser = await User.findOne(duplicateQuery);
      if (existingUser) {
        return res.status(400).json({ 
          error: 'Username, email or personal code already exists' 
        });
      }
    }

    // Update fields
    if (username) user.username = username;
    if (name) user.name = name;
    if (surname) user.surname = surname;
    if (email) user.email = email;
    if (birthdate) user.birthdate = birthdate;
    if (personalCode) user.personalCode = personalCode;
    if (address) user.address = address;
    if (role) user.role = role;

    // Hash new password if provided
    if (password) {
      const bcrypt = require('bcrypt');
      user.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await user.save();

    // Return user without password
    const userResponse = updatedUser.toObject();
    delete userResponse.password;

    res.json(userResponse);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE - Delete user (Admin only)
router.delete('/:id', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    // Prevent admin from deleting themselves
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has any game assignments
    const BasketballGame = require('../models/basketballGame');
    const assignedGames = await BasketballGame.find({
      'refereeAssignments.userId': req.params.id
    });

    if (assignedGames.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete user with existing game assignments. Please remove assignments first.' 
      });
    }

    await User.deleteOne({ _id: req.params.id });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;