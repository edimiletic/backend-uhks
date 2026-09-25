// backend/routes/notifications.js
const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const authenticateUser = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authenticateUser);

// GET - Get notifications for current user (recent 20 by default)
router.get('/', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    const notifications = await Notification.find({ userId: req.user._id })
      .populate('gameId', 'homeTeam awayTeam date time venue')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET - Get all notifications with pagination
router.get('/all', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const total = await Notification.countDocuments({ userId: req.user._id });
    const notifications = await Notification.find({ userId: req.user._id })
      .populate('gameId', 'homeTeam awayTeam date time venue')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      notifications,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get all notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET - Get unread notification count
router.get('/unread-count', async (req, res) => {
  try {
    const count = await Notification.countDocuments({ 
      userId: req.user._id, 
      isRead: false 
    });

    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// PATCH - Mark notification as read
router.patch('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    notification.isRead = true;
    await notification.save();

    res.json(notification);
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// PATCH - Mark multiple notifications as read
router.patch('/mark-multiple-read', async (req, res) => {
  try {
    const { notificationIds } = req.body;

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return res.status(400).json({ error: 'Invalid notification IDs' });
    }

    const result = await Notification.updateMany(
      { 
        _id: { $in: notificationIds }, 
        userId: req.user._id,
        isRead: false
      },
      { isRead: true }
    );

    res.json({ modified: result.modifiedCount });
  } catch (error) {
    console.error('Mark multiple as read error:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// PATCH - Mark all notifications as read
router.patch('/mark-all-read', async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { isRead: true }
    );

    res.json({ modified: result.modifiedCount });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// POST - Create notification (Admin only - for manual notifications)
router.post('/', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const { userId, type, message, gameId, assignmentId } = req.body;

    if (!userId || !type || !message) {
      return res.status(400).json({ error: 'Missing required fields: userId, type, message' });
    }

    const notification = new Notification({
      userId,
      type,
      message,
      gameId,
      assignmentId,
      isRead: false
    });

    await notification.save();
    await notification.populate('gameId', 'homeTeam awayTeam date time venue');

    res.status(201).json(notification);
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// DELETE - Delete notification
router.delete('/:id', async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Helper function to create game assignment notifications (used by other routes)
router.createGameAssignmentNotifications = async (gameId, refereeAssignments) => {
  try {
    const BasketballGame = require('../models/basketballGame');
    const game = await BasketballGame.findById(gameId);
    
    if (!game) {
      throw new Error('Game not found');
    }

    const gameDetails = {
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      date: game.date.toLocaleDateString('hr-HR')
    };

    const notifications = [];
    
    for (const assignment of refereeAssignments) {
      const notification = await Notification.createGameAssignmentNotification(
        assignment.userId,
        gameId,
        gameDetails
      );
      notifications.push(notification);
    }

    return notifications;
  } catch (error) {
    console.error('Error creating game assignment notifications:', error);
    throw error;
  }
};

// Helper function to create assignment response notifications (used by other routes)
router.createAssignmentResponseNotification = async (gameId, refereeId, response) => {
  try {
    const BasketballGame = require('../models/basketballGame');
    const User = require('../models/User');
    
    const [game, referee] = await Promise.all([
      BasketballGame.findById(gameId),
      User.findById(refereeId)
    ]);

    if (!game || !referee) {
      throw new Error('Game or referee not found');
    }

    // Find all admin users to notify
    const adminUsers = await User.find({
      $or: [{ role: 'Admin' }, { 'roles.name': 'Admin' }]
    });
    
    const gameDetails = {
      _id: game._id,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam
    };

    const refereeDetails = {
      name: referee.name,
      surname: referee.surname
    };

    const notifications = [];
    
    for (const admin of adminUsers) {
      const notification = await Notification.createAssignmentResponseNotification(
        admin._id,
        refereeDetails,
        gameDetails,
        response
      );
      notifications.push(notification);
    }

    return notifications;
  } catch (error) {
    console.error('Error creating assignment response notification:', error);
    throw error;
  }
};

module.exports = router;