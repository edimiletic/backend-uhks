// backend/routes/basketballGame.js
const express = require('express');
const router = express.Router();
const BasketballGame = require('../models/BasketballGames');
const User = require('../models/User');
const authenticateUser = require('../middleware/authMiddleware');
const Notification = require('../models/Notification');

// Apply authentication middleware to all routes
router.use(authenticateUser);

// CREATE - Create a new basketball game (Admin only)
router.post('/', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const { homeTeam, awayTeam, date, time, venue, competition, notes } = req.body;

    // Validate required fields
    if (!homeTeam || !awayTeam || !date || !time || !venue || !competition) {
      return res.status(400).json({ 
        error: 'Missing required fields: homeTeam, awayTeam, date, time, venue, competition' 
      });
    }

    // Check for duplicate games (same teams, same date, same time)
    const existingGame = await BasketballGame.findOne({
      homeTeam,
      awayTeam,
      date: new Date(date),
      time
    });

    if (existingGame) {
      return res.status(400).json({ 
        error: 'A game with the same teams, date, and time already exists' 
      });
    }

    const basketballGame = new BasketballGame({
      homeTeam,
      awayTeam,
      date: new Date(date),
      time,
      venue,
      competition,
      notes,
      createdBy: req.user._id
    });

    const savedGame = await basketballGame.save();
    
    // Populate creator information
    await savedGame.populate('createdBy', 'name surname');

    res.status(201).json(savedGame);
  } catch (error) {
    console.error('Create basketball game error:', error);
    res.status(500).json({ error: 'Failed to create basketball game' });
  }
});

// GET - Get games by referee and date for conflict checking
router.get('/referee/:refereeId/date/:date', async (req, res) => {
  try {
    const { refereeId, date } = req.params;
    
    console.log(` Backend: Getting games for referee ${refereeId} on date ${date}`);
    
    // Parse the date to get start and end of day
    const queryDate = new Date(date);
    const startOfDay = new Date(queryDate.getFullYear(), queryDate.getMonth(), queryDate.getDate());
    const endOfDay = new Date(queryDate.getFullYear(), queryDate.getMonth(), queryDate.getDate() + 1);

    console.log(` Backend: Searching from ${startOfDay} to ${endOfDay}`);

    // Find all games where the referee is assigned on the specified date
    // CHANGED: Include both 'Accepted' AND 'Pending' assignments
    const games = await BasketballGame.find({
      'refereeAssignments.userId': refereeId,
      'refereeAssignments.assignmentStatus': { $in: ['Accepted', 'Pending'] }, // ← Changed this line
      date: {
        $gte: startOfDay,
        $lt: endOfDay
      }
    })
    .select('homeTeam awayTeam date time venue competition')
    .lean();

    console.log(` Backend: Found ${games.length} games for referee ${refereeId}:`, games);

    res.json(games);
  } catch (error) {
    console.error('Backend error - Get games by referee and date:', error);
    res.status(500).json({ error: 'Failed to fetch referee games' });
  }
});

// READ - Get all basketball games with optional filters
router.get('/', async (req, res) => {
  try {
    const { date, competition, status, homeTeam, awayTeam, page = 1, limit = 20 } = req.query;
    
    // Build filter object
    let filter = {};
    
    if (date) {
      const queryDate = new Date(date);
      filter.date = {
        $gte: new Date(queryDate.getFullYear(), queryDate.getMonth(), queryDate.getDate()),
        $lt: new Date(queryDate.getFullYear(), queryDate.getMonth(), queryDate.getDate() + 1)
      };
    }
    if (competition) filter.competition = new RegExp(competition, 'i');
    if (status) filter.status = status;
    if (homeTeam) filter.homeTeam = new RegExp(homeTeam, 'i');
    if (awayTeam) filter.awayTeam = new RegExp(awayTeam, 'i');

    // For non-admin users, also show games where they are assigned
    if (req.user.role !== 'Admin') {
      filter['refereeAssignments.userId'] = req.user._id;
    }

    const skip = (page - 1) * limit;
    const totalGames = await BasketballGame.countDocuments(filter);
    
    const games = await BasketballGame.find(filter)
      .populate('createdBy', 'name surname')
      .populate('updatedBy', 'name surname')
      .populate('refereeAssignments.userId', 'name surname role')
      .sort({ date: 1, time: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      games,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalGames / limit),
        totalGames,
        hasNext: skip + games.length < totalGames,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get basketball games error:', error);
    res.status(500).json({ error: 'Failed to fetch basketball games' });
  }
});

// READ - Get games assigned to current user
router.get('/my-assignments', async (req, res) => {
  try {
    const games = await BasketballGame.find({
      'refereeAssignments.userId': req.user._id
    })
      .populate('createdBy', 'name surname')
      .populate('refereeAssignments.userId', 'name surname role')
      .sort({ date: 1, time: 1 });

    res.json(games);
  } catch (error) {
    console.error('Get my assignments error:', error);
    res.status(500).json({ error: 'Failed to fetch assigned games' });
  }
});

// READ - Get basketball game by ID
router.get('/:id', async (req, res) => {
  try {
    const game = await BasketballGame.findById(req.params.id)
      .populate('createdBy', 'name surname')
      .populate('updatedBy', 'name surname')
      .populate('refereeAssignments.userId', 'name surname role');

    if (!game) {
      return res.status(404).json({ error: 'Basketball game not found' });
    }

    // Check if user has access to this game
    if (req.user.role !== 'Admin') {
      const isAssigned = game.refereeAssignments.some(
        assignment => assignment.userId._id.toString() === req.user._id.toString()
      );
      
      if (!isAssigned) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json(game);
  } catch (error) {
    console.error('Get basketball game by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch basketball game' });
  }
});

// UPDATE - Update basketball game (Admin only)
router.put('/:id', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const game = await BasketballGame.findById(req.params.id);

    if (!game) {
      return res.status(404).json({ error: 'Basketball game not found' });
    }

    const { homeTeam, awayTeam, date, time, venue, competition, status, notes, score } = req.body;

    // Update fields
    if (homeTeam) game.homeTeam = homeTeam;
    if (awayTeam) game.awayTeam = awayTeam;
    if (date) game.date = new Date(date);
    if (time) game.time = time;
    if (venue) game.venue = venue;
    if (competition) game.competition = competition;
    if (status) game.status = status;
    if (notes !== undefined) game.notes = notes;
    if (score) game.score = score;

    game.updatedBy = req.user._id;

    const updatedGame = await game.save();
    await updatedGame.populate('createdBy', 'name surname');
    await updatedGame.populate('updatedBy', 'name surname');
    await updatedGame.populate('refereeAssignments.userId', 'name surname role');

    res.json(updatedGame);
  } catch (error) {
    console.error('Update basketball game error:', error);
    res.status(500).json({ error: 'Failed to update basketball game' });
  }
});

// DELETE - Delete basketball game (Admin only)
router.delete('/:id', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const game = await BasketballGame.findById(req.params.id);

    if (!game) {
      return res.status(404).json({ error: 'Basketball game not found' });
    }

    await BasketballGame.deleteOne({ _id: req.params.id });
    res.json({ message: 'Basketball game deleted successfully' });
  } catch (error) {
    console.error('Delete basketball game error:', error);
    res.status(500).json({ error: 'Failed to delete basketball game' });
  }
});

// POST - Assign referee to game (Admin only)
// POST - Assign referee to game (Admin only) - UPDATED
router.post('/:id/assign-referee', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const { userId, role, position } = req.body;

    if (!userId || !role) {
      return res.status(400).json({ error: 'Missing required fields: userId, role' });
    }

    const game = await BasketballGame.findById(req.params.id);
    if (!game) {
      return res.status(404).json({ error: 'Basketball game not found' });
    }

    // Validate that user exists and has the correct role
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role !== role) {
      return res.status(400).json({ error: 'User role does not match assignment role' });
    }

    // Check if user is already assigned to this game
    if (game.isUserAssigned(userId)) {
      return res.status(400).json({ error: 'User is already assigned to this game' });
    }

    // Get next available position if not specified
    let assignmentPosition = position;
    if (!assignmentPosition) {
      assignmentPosition = game.getNextAvailablePosition(role);
      if (!assignmentPosition) {
        const maxPositions = { 'Sudac': 3, 'Delegat': 1, 'Pomoćni Sudac': 3 };
        return res.status(400).json({ 
          error: `No available positions for role ${role}. Maximum ${maxPositions[role]} allowed.` 
        });
      }
    }

    // Add referee assignment
    game.refereeAssignments.push({
      userId,
      role,
      position: assignmentPosition,
      assignmentStatus: 'Pending',
      assignedAt: new Date()
    });

    const updatedGame = await game.save();
    await updatedGame.populate('refereeAssignments.userId', 'name surname role');

    // 🎯 CREATE NOTIFICATION FOR THE ASSIGNED REFEREE
    try {
      const gameDetails = {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        date: game.date.toLocaleDateString('hr-HR'),
        venue: game.venue,
        time: game.time
      };

      await Notification.createGameAssignmentNotification(userId, game._id, gameDetails);
      console.log(`Game assignment notification created for user ${userId}`);
    } catch (notificationError) {
      console.error('Error creating game assignment notification:', notificationError);
      // Don't fail the assignment if notification fails
    }

    res.json(updatedGame);
  } catch (error) {
    console.error('Assign referee error:', error);
    if (error.message.includes('Maximum')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to assign referee' });
  }
});

// GET - Get available positions for a role (Admin only)
router.get('/:id/available-positions/:role', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const { role } = req.params;
    
    if (!['Sudac', 'Delegat', 'Pomoćni Sudac'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const game = await BasketballGame.findById(req.params.id);
    if (!game) {
      return res.status(404).json({ error: 'Basketball game not found' });
    }

    const availablePositions = game.getAvailablePositions(role);
    const summary = game.getRefereeAssignmentSummary();

    res.json({
      role,
      availablePositions,
      currentAssignments: summary[role]
    });
  } catch (error) {
    console.error('Get available positions error:', error);
    res.status(500).json({ error: 'Failed to get available positions' });
  }
});

// GET - Get referee assignment summary for a game
router.get('/:id/referee-summary', async (req, res) => {
  try {
    const game = await BasketballGame.findById(req.params.id)
      .populate('refereeAssignments.userId', 'name surname role');

    if (!game) {
      return res.status(404).json({ error: 'Basketball game not found' });
    }

    // Check if user has access to this game
    if (req.user.role !== 'Admin') {
      const isAssigned = game.refereeAssignments.some(
        assignment => assignment.userId._id.toString() === req.user._id.toString()
      );
      
      if (!isAssigned) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const summary = game.getRefereeAssignmentSummary();
    
    // Add detailed assignment info
    const detailedSummary = {
      Sudac: {
        ...summary.Sudac,
        maxAllowed: 3,
        minRequired: 2,
        assignments: game.refereeAssignments
          .filter(a => a.role === 'Sudac')
          .map(a => ({
            position: a.position,
            user: a.userId,
            status: a.assignmentStatus,
            assignedAt: a.assignedAt,
            respondedAt: a.respondedAt
          }))
      },
      Delegat: {
        ...summary.Delegat,
        maxAllowed: 1,
        minRequired: 0,
        assignments: game.refereeAssignments
          .filter(a => a.role === 'Delegat')
          .map(a => ({
            position: a.position,
            user: a.userId,
            status: a.assignmentStatus,
            assignedAt: a.assignedAt,
            respondedAt: a.respondedAt
          }))
      },
      'Pomoćni Sudac': {
        ...summary['Pomoćni Sudac'],
        maxAllowed: 3,
        minRequired: 2,
        assignments: game.refereeAssignments
          .filter(a => a.role === 'Pomoćni Sudac')
          .map(a => ({
            position: a.position,
            user: a.userId,
            status: a.assignmentStatus,
            assignedAt: a.assignedAt,
            respondedAt: a.respondedAt
          }))
      }
    };

    res.json({
      gameId: game._id,
      summary: detailedSummary,
      allRefereesResponded: game.areAllRefereesResponded(),
      allRefereesAccepted: game.areAllRefereesAccepted(),
      totalAssigned: game.refereeAssignments.length
    });
  } catch (error) {
    console.error('Get referee summary error:', error);
    res.status(500).json({ error: 'Failed to get referee summary' });
  }
});

// PATCH - Accept/Reject game assignment (Referees only)
// In routes/basketballGame.js - UPDATED respond-assignment route
router.patch('/:id/respond-assignment', async (req, res) => {
  try {
    const { response, rejectionReason } = req.body;

    if (!response || !['Accepted', 'Rejected'].includes(response)) {
      return res.status(400).json({ error: 'Invalid response. Must be "Accepted" or "Rejected"' });
    }

    if (response === 'Rejected' && !rejectionReason) {
      return res.status(400).json({ error: 'Rejection reason is required when rejecting assignment' });
    }

    const game = await BasketballGame.findById(req.params.id)
      .populate('createdBy', 'name surname'); // Populate creator for notification

    if (!game) {
      return res.status(404).json({ error: 'Basketball game not found' });
    }

    // Find the user's assignment
    const assignmentIndex = game.refereeAssignments.findIndex(
      assignment => assignment.userId.toString() === req.user._id.toString()
    );

    if (assignmentIndex === -1) {
      return res.status(404).json({ error: 'Assignment not found for this user' });
    }

    const assignment = game.refereeAssignments[assignmentIndex];

    if (assignment.assignmentStatus !== 'Pending') {
      return res.status(400).json({ error: 'Assignment has already been responded to' });
    }

    // 🎯 CREATE NOTIFICATION FOR ADMIN USERS
    try {
      // Get all admin users
      const adminUsers = await User.find({ role: 'Admin' }, '_id');
      
      const refereeDetails = {
        name: req.user.name,
        surname: req.user.surname
      };

      const gameDetails = {
        _id: game._id,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        date: game.date.toLocaleDateString('hr-HR')
      };

      // Create notifications for all admins
      const notificationPromises = adminUsers.map(admin => 
        Notification.createAssignmentResponseNotification(
          admin._id, 
          refereeDetails, 
          gameDetails, 
          response
        )
      );

      await Promise.all(notificationPromises);
      console.log(`Assignment response notifications created for ${adminUsers.length} admins`);
    } catch (notificationError) {
      console.error('Error creating assignment response notification:', notificationError);
      // Don't fail the response if notification fails
    }

    if (response === 'Accepted') {
      // Update assignment status to Accepted
      assignment.assignmentStatus = 'Accepted';
      assignment.respondedAt = new Date();
    } else if (response === 'Rejected') {
      // Store rejection information for audit purposes (optional)
      console.log(`Assignment rejected by ${req.user.name} ${req.user.surname}:`, {
        gameId: game._id,
        role: assignment.role,
        position: assignment.position,
        reason: rejectionReason,
        rejectedAt: new Date()
      });

      // Remove the assignment entirely so the position becomes available
      game.refereeAssignments.splice(assignmentIndex, 1);
    }

    const updatedGame = await game.save();
    await updatedGame.populate('refereeAssignments.userId', 'name surname role');

    res.json(updatedGame);
  } catch (error) {
    console.error('Respond to assignment error:', error);
    res.status(500).json({ error: 'Failed to respond to assignment' });
  }
});

// DELETE - Remove referee assignment (Admin only)
router.delete('/:id/remove-referee/:assignmentId', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const game = await BasketballGame.findById(req.params.id);
    if (!game) {
      return res.status(404).json({ error: 'Basketball game not found' });
    }

    const assignmentIndex = game.refereeAssignments.findIndex(
      assignment => assignment._id.toString() === req.params.assignmentId
    );

    if (assignmentIndex === -1) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    game.refereeAssignments.splice(assignmentIndex, 1);
    const updatedGame = await game.save();
    await updatedGame.populate('refereeAssignments.userId', 'name surname role');

    res.json(updatedGame);
  } catch (error) {
    console.error('Remove referee assignment error:', error);
    res.status(500).json({ error: 'Failed to remove referee assignment' });
  }
});

// GET - Get assignment rejection history (Admin only) - Optional for tracking
router.get('/:id/rejection-history', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    // This would require a separate collection or audit log
    // For now, we'll return an empty array since rejections are removed
    // In a production system, you might want to store rejections in a separate audit collection
    
    res.json({
      gameId: req.params.id,
      rejections: [],
      note: "Rejections are removed from assignments to free up positions. Consider implementing audit logging for rejection tracking."
    });
  } catch (error) {
    console.error('Get rejection history error:', error);
    res.status(500).json({ error: 'Failed to get rejection history' });
  }
});



module.exports = router;