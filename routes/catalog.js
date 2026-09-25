const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const Venue = require('../models/Venue');
const { ALL_COMPETITIONS } = require('../config/roles');
const authenticateUser = require('../middleware/authMiddleware');

router.use(authenticateUser);

router.get('/teams', async (req, res) => {
  try {
    const filter = {};
    const { competition } = req.query;
    if (competition) {
      if (!ALL_COMPETITIONS.includes(competition)) {
        return res.status(400).json({ error: 'Invalid competition' });
      }
      filter.competitions = competition;
    }

    const teams = await Team.find(filter).select('name competitions').sort({ name: 1 });
    res.json(teams);
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

router.get('/venues', async (req, res) => {
  try {
    const venues = await Venue.find().select('name').sort({ name: 1 });
    res.json(venues);
  } catch (error) {
    console.error('Get venues error:', error);
    res.status(500).json({ error: 'Failed to fetch venues' });
  }
});

module.exports = router;
