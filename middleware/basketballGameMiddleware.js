// backend/middleware/basketballGameMiddleware.js
const BasketballGame = require('../models/basketballGame');
const User = require('../models/User');
const { ALL_COMPETITIONS, isAdminUser, userHasRole, canAccessGame, cannotNominateSelf } = require('../config/roles');

// Middleware to validate game creation/update data
const validateGameData = (req, res, next) => {
  const { homeTeam, awayTeam, date, time, venue, competition } = req.body;

  // Validate required fields
  if (!homeTeam || !awayTeam || !date || !time || !venue || !competition) {
    return res.status(400).json({ 
      error: 'Missing required fields: homeTeam, awayTeam, date, time, venue, competition' 
    });
  }

  // Validate teams are different
  if (homeTeam.toLowerCase().trim() === awayTeam.toLowerCase().trim()) {
    return res.status(400).json({ error: 'Home team and away team cannot be the same' });
  }

  // Validate date format and future date
  const gameDate = new Date(date);
  if (isNaN(gameDate.getTime())) {
    return res.status(400).json({ error: 'Invalid date format' });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (gameDate < today) {
    return res.status(400).json({ error: 'Game date cannot be in the past' });
  }

  // Validate time format (HH:MM)
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(time)) {
    return res.status(400).json({ error: 'Invalid time format. Use HH:MM format' });
  }

  if (!ALL_COMPETITIONS.includes(competition)) {
    return res.status(400).json({ error: 'Invalid competition' });
  }

  next();
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }
  next();
};

// Middleware to check if user is assigned to the game
const requireAssignedReferee = async (req, res, next) => {
  try {
    const game = await BasketballGame.findById(req.params.id);
    
    if (!game) {
      return res.status(404).json({ error: 'Basketball game not found' });
    }

    // Admin can access any game
    if (isAdminUser(req.user) || canAccessGame(req.user, game)) {
      req.game = game;
      return next();
    }

    // Check if user is assigned to this game
    const isAssigned = game.refereeAssignments.some(
      assignment => assignment.userId.toString() === req.user._id.toString()
    );

    if (!isAssigned) {
      return res.status(403).json({ error: 'Access denied. You are not assigned to this game.' });
    }

    req.game = game;
    next();
  } catch (error) {
    console.error('Require assigned referee error:', error);
    res.status(500).json({ error: 'Failed to verify game assignment' });
  }
};

// Middleware to validate referee assignment
const validateRefereeAssignment = async (req, res, next) => {
  try {
    const { userId, role, position } = req.body;

    if (!userId || !role) {
      return res.status(400).json({ error: 'Missing required fields: userId, role' });
    }

    // Validate role
    const validRoles = ['Sudac', 'Delegat', 'Kontrolor'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Validate position if provided
    if (position !== undefined) {
      const maxPositions = { 'Sudac': 3, 'Delegat': 1, 'Kontrolor': 1 };
      if (position < 1 || position > maxPositions[role]) {
        return res.status(400).json({ 
          error: `Invalid position. ${role} positions must be between 1 and ${maxPositions[role]}` 
        });
      }
    }

    // Validate that user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate that user has the correct role
    if (!userHasRole(user, role)) {
      return res.status(400).json({ error: 'User role does not match assignment role' });
    }

    if (cannotNominateSelf(req.user, userId)) {
      return res.status(400).json({ error: 'Ne možete nominirati sami sebe.' });
    }

    req.assigneeUser = user;
    next();
  } catch (error) {
    console.error('Validate referee assignment error:', error);
    res.status(500).json({ error: 'Failed to validate referee assignment' });
  }
};

// Middleware to validate assignment response
const validateAssignmentResponse = (req, res, next) => {
  const { response, rejectionReason } = req.body;

  if (!response || !['Accepted', 'Rejected'].includes(response)) {
    return res.status(400).json({ error: 'Invalid response. Must be "Accepted" or "Rejected"' });
  }

  if (response === 'Rejected' && !rejectionReason) {
    return res.status(400).json({ error: 'Rejection reason is required when rejecting assignment' });
  }

  if (response === 'Rejected' && rejectionReason.trim().length < 5) {
    return res.status(400).json({ error: 'Rejection reason must be at least 5 characters long' });
  }

  next();
};

// Utility function to check for scheduling conflicts
const checkSchedulingConflict = async (userId, gameDate, gameTime, excludeGameId = null) => {
  const gameDateTime = new Date(gameDate);
  const [hours, minutes] = gameTime.split(':');
  gameDateTime.setHours(parseInt(hours), parseInt(minutes));

  // Check for games on the same day within 2 hours
  const startTime = new Date(gameDateTime.getTime() - 2 * 60 * 60 * 1000); // 2 hours before
  const endTime = new Date(gameDateTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours after

  const query = {
    'refereeAssignments.userId': userId,
    'refereeAssignments.assignmentStatus': 'Accepted',
    date: {
      $gte: startTime,
      $lte: endTime
    }
  };

  if (excludeGameId) {
    query._id = { $ne: excludeGameId };
  }

  const conflictingGames = await BasketballGame.find(query);
  return conflictingGames.length > 0 ? conflictingGames : null;
};

// Utility function to get referee assignment limits
const getRefereeAssignmentLimits = () => {
  return {
    'Sudac': { min: 3, max: 3 },
    'Delegat': { min: 1, max: 1 },
    'Kontrolor': { min: 0, max: 1 }
  };
};

// Utility function to validate complete referee assignment for a game
const validateCompleteRefereeAssignment = (game) => {
  const limits = getRefereeAssignmentLimits();
  const summary = game.getRefereeAssignmentSummary();
  const issues = [];

  Object.keys(limits).forEach(role => {
    const accepted = summary[role].accepted;
    const assigned = summary[role].assigned;
    const limit = limits[role];

    if (accepted < limit.min) {
      issues.push(`Minimum ${limit.min} ${role} required, currently ${accepted} accepted`);
    }
    
    if (assigned > limit.max) {
      issues.push(`Maximum ${limit.max} ${role} allowed, currently ${assigned} assigned`);
    }
  });

  return {
    isValid: issues.length === 0,
    issues: issues
  };
};

module.exports = {
  validateGameData,
  requireAdmin,
  requireAssignedReferee,
  validateRefereeAssignment,
  validateAssignmentResponse,
  checkSchedulingConflict,
  getRefereeAssignmentLimits,
  validateCompleteRefereeAssignment
};