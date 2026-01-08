// routes/absences.js
const express = require('express');
const router = express.Router();
const Absence = require('../models/Absence');
const User = require('../models/User'); // Add User import
const authenticateUser = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authenticateUser);

// CREATE - Create new absence
router.post('/', async (req, res) => {
  try {
    const { startDate, endDate, reason } = req.body;
    const userPersonalCode = req.user.personalCode;

    // Validation
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Validate dates
    if (start < today) {
      return res.status(400).json({ error: 'Start date cannot be in the past' });
    }

    // Changed from end <= start to end < start to allow same day
    if (end < start) {
      return res.status(400).json({ error: 'End date cannot be before start date' });
    }

    // Check for overlapping absences
    const overlappingAbsence = await Absence.findOne({
      userPersonalCode,
      $or: [
        {
          startDate: { $lte: end },
          endDate: { $gte: start }
        }
      ]
    });

    if (overlappingAbsence) {
      return res.status(400).json({ 
        error: 'Već postoji odsustvo za odabrani vremenski period.' 
      });
    }

    // Create new absence
    const newAbsence = new Absence({
      startDate: start,
      endDate: end,
      userPersonalCode,
      reason: reason?.trim()
    });

    await newAbsence.save();

    res.status(201).json(newAbsence);

  } catch (error) {
    console.error('Error creating absence:', error);
    res.status(500).json({ error: 'Server error while creating absence' });
  }
});

// GET - Get current user's absences
router.get('/my', async (req, res) => {
  try {
    const userPersonalCode = req.user.personalCode;
    
    const absences = await Absence.find({ userPersonalCode })
      .sort({ startDate: -1 }); // Sort by start date, newest first

    res.json(absences);

  } catch (error) {
    console.error('Error fetching user absences:', error);
    res.status(500).json({ error: 'Server error while fetching absences' });
  }
});

// GET - Get all absences (admin only) - UPDATED
router.get('/', async (req, res) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const { page = 1, limit = 10, userPersonalCode, startDate, endDate } = req.query;
    
    // Build filter object
    const filter = {};
    if (userPersonalCode) filter.userPersonalCode = userPersonalCode;
    if (startDate) filter.startDate = { $gte: new Date(startDate) };
    if (endDate) filter.endDate = { $lte: new Date(endDate) };

    // Get absences with user information
    const absences = await Absence.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get all users to map personal codes to names
    const users = await User.find({}, { personalCode: 1, name: 1, surname: 1 });
    const userMap = {};
    users.forEach(user => {
      userMap[user.personalCode] = {
        name: user.name,
        surname: user.surname
      };
    });

    // Add user names to absences
    const absencesWithUserNames = absences.map(absence => {
      const user = userMap[absence.userPersonalCode];
      return {
        ...absence.toObject(),
        userName: user ? `${user.name} ${user.surname}` : 'Nepoznato ime'
      };
    });

    const total = await Absence.countDocuments(filter);

    res.json({
      absences: absencesWithUserNames,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    console.error('Error fetching all absences:', error);
    res.status(500).json({ error: 'Server error while fetching absences' });
  }
});

// GET - Get specific absence by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const absence = await Absence.findById(id);

    if (!absence) {
      return res.status(404).json({ error: 'Absence not found' });
    }

    // Check if user owns this absence or is admin
    if (absence.userPersonalCode !== req.user.personalCode && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(absence);

  } catch (error) {
    console.error('Error fetching absence:', error);
    res.status(500).json({ error: 'Server error while fetching absence' });
  }
});

// PUT - Update absence
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, reason } = req.body;

    const absence = await Absence.findById(id);
    if (!absence) {
      return res.status(404).json({ error: 'Absence not found' });
    }

    // Check if user owns this absence or is admin
    if (absence.userPersonalCode !== req.user.personalCode && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate dates if provided
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : absence.startDate;
      const end = endDate ? new Date(endDate) : absence.endDate;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (start < today) {
        return res.status(400).json({ error: 'Početni datum ne može biti u prošlosti.' });
      }

      // Changed from end <= start to end < start to allow same day
      if (end < start) {
        return res.status(400).json({ error: 'Završni datum ne može biti prije početnog.' });
      }

      // Check for overlapping absences (excluding current absence)
      const overlappingAbsence = await Absence.findOne({
        _id: { $ne: id },
        userPersonalCode: absence.userPersonalCode,
        $or: [
          {
            startDate: { $lte: end },
            endDate: { $gte: start }
          }
        ]
      });

      if (overlappingAbsence) {
        return res.status(400).json({ 
          error: 'Već postoji odsustvo za odabrani vremenski period.' 
        });
      }
    }

    // Update fields
    if (startDate) absence.startDate = new Date(startDate);
    if (endDate) absence.endDate = new Date(endDate);
    if (reason !== undefined) absence.reason = reason?.trim();

    await absence.save();

    res.json(absence);

  } catch (error) {
    console.error('Error updating absence:', error);
    res.status(500).json({ error: 'Server error while updating absence' });
  }
});

// DELETE - Delete absence
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const absence = await Absence.findById(id);
    if (!absence) {
      return res.status(404).json({ error: 'Absence not found' });
    }

    // Check if user owns this absence or is admin
    if (absence.userPersonalCode !== req.user.personalCode && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await Absence.findByIdAndDelete(id);

    res.json({ message: 'Absence deleted successfully' });

  } catch (error) {
    console.error('Error deleting absence:', error);
    res.status(500).json({ error: 'Server error while deleting absence' });
  }
});

module.exports = router;