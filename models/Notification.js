
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'GAME_ASSIGNMENT',
      'ASSIGNMENT_RESPONSE',
      'KONTROLA_RECEIVED',
      'ASSIGNMENT_RELEASED',
      'GAME_SCHEDULE_CHANGED',
      'ASSIGNMENT_REMOVED',
      'COLLEAGUE_REPLACED',
      'NOMINATION_EXPIRED',
      'EXPENSE_APPROVED',
      'EXPENSE_REJECTED'
    ],
    required: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BasketballGame',
    index: true
  },
  assignmentId: {
    type: String, // Can be the assignment _id from the game's refereeAssignments array
    index: true
  },
  kontrolaId: { // ← Add this new field
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Kontrola',
    index: true
  },
  travelExpenseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TravelExpense',
    index: true
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true
});
// Indexes for efficient queries
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

// Virtual for formatted creation time
notificationSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diffInSeconds = Math.floor((now - this.createdAt) / 1000);
 
  if (diffInSeconds < 60) {
    return 'Prije nekoliko sekundi';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `Prije ${minutes} min`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `Prije ${hours}h`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `Prije ${days} dana`;
  }
});

// ← ADD THIS NEW STATIC METHOD for kontrola notifications
notificationSchema.statics.createKontrolaNotification = async function(userId, gameId, kontrolaId, gameDetails, refereeName) {
  try {
    const message = `📋 Nova kontrola dostupna za utakmicu: ${gameDetails.homeTeam} vs ${gameDetails.awayTeam} (${gameDetails.date})`;
   
    const notification = await this.create({
      userId,
      type: 'KONTROLA_RECEIVED',
      message,
      gameId,
      kontrolaId,
      isRead: false
    });

    console.log(`✅ Kontrola notification created for referee ${userId} (${refereeName})`);
    return notification;
  } catch (error) {
    console.error('❌ Error creating kontrola notification:', error);
    throw error;
  }
};

// ← ADD THIS NEW STATIC METHOD for bulk kontrola notifications
notificationSchema.statics.createBulkKontrolaNotifications = async function(refereeGrades, gameId, kontrolaId, gameDetails) {
  try {
    if (!Array.isArray(refereeGrades) || refereeGrades.length === 0) {
      console.warn('⚠️ No referee grades provided for kontrola notification creation');
      return [];
    }

    const message = `📋 Nova kontrola dostupna za utakmicu: ${gameDetails.homeTeam} vs ${gameDetails.awayTeam} (${gameDetails.date})`;
    
    const notifications = refereeGrades.map(refereeGrade => ({
      userId: refereeGrade.refereeId,
      type: 'KONTROLA_RECEIVED',
      message,
      gameId,
      kontrolaId,
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    const createdNotifications = await this.insertMany(notifications);
    console.log(`✅ ${createdNotifications.length} kontrola notifications created`);
    
    return createdNotifications;
  } catch (error) {
    console.error('❌ Error creating bulk kontrola notifications:', error);
    throw error;
  }
};

notificationSchema.statics.createAssignmentReleasedNotification = async function(userId, gameId, gameDetails) {
  try {
    const message = `Nominacija je povučena zbog više lige: ${gameDetails.homeTeam} vs ${gameDetails.awayTeam} (${gameDetails.competition}, ${gameDetails.date} ${gameDetails.time}). Dodijeljena je ${gameDetails.higherCompetition}: ${gameDetails.higherHomeTeam} vs ${gameDetails.higherAwayTeam}.`;
    return this.create({
      userId,
      type: 'ASSIGNMENT_RELEASED',
      message,
      gameId,
      isRead: false
    });
  } catch (error) {
    console.error('Error creating assignment released notification:', error);
    throw error;
  }
};

notificationSchema.statics.createAssignmentReleasedCommissionerNotification = async function(userId, gameId, gameDetails) {
  try {
    const message = `Potrebna je nova nominacija (${gameDetails.role}) za ${gameDetails.homeTeam} vs ${gameDetails.awayTeam} (${gameDetails.competition}, ${gameDetails.date} ${gameDetails.time}). Službena osoba je prebačena na višu ligu.`;
    return this.create({
      userId,
      type: 'ASSIGNMENT_RELEASED',
      message,
      gameId,
      isRead: false
    });
  } catch (error) {
    console.error('Error creating commissioner release notification:', error);
    throw error;
  }
};

// Static method to create game assignment notification
notificationSchema.statics.createAssignmentRemovedNotification = async function(userId, gameId, gameDetails) {
  try {
    const message = `Nominacija je povučena: ${gameDetails.homeTeam} vs ${gameDetails.awayTeam}, ${gameDetails.date} u ${gameDetails.time} (${gameDetails.venue}).`;
    return this.create({
      userId,
      type: 'ASSIGNMENT_REMOVED',
      message,
      gameId,
      isRead: false
    });
  } catch (error) {
    console.error('Error creating assignment removed notification:', error);
    throw error;
  }
};

notificationSchema.statics.createNominationExpiredNotification = async function(userId, gameId, gameDetails) {
  try {
    const message = `Nominacija je pala jer niste odgovorili na vrijeme: ${gameDetails.homeTeam} vs ${gameDetails.awayTeam}, ${gameDetails.date} u ${gameDetails.time} (${gameDetails.venue}).`;
    return this.create({
      userId,
      type: 'NOMINATION_EXPIRED',
      message,
      gameId,
      isRead: false
    });
  } catch (error) {
    console.error('Error creating nomination expired notification:', error);
    throw error;
  }
};

notificationSchema.statics.createNominationExpiredCommissionerNotification = async function(userId, gameId, gameDetails, officialName, role) {
  try {
    const message = `Nominacija pala zbog neodziva: ${officialName} (${role}) na utakmici ${gameDetails.homeTeam} vs ${gameDetails.awayTeam}, ${gameDetails.date} u ${gameDetails.time}.`;
    return this.create({
      userId,
      type: 'NOMINATION_EXPIRED',
      message,
      gameId,
      isRead: false
    });
  } catch (error) {
    console.error('Error creating nomination expired commissioner notification:', error);
    throw error;
  }
};

notificationSchema.statics.createGameScheduleChangedNotifications = async function(userIds, gameId, gameDetails) {
  try {
    const uniqueIds = [...new Set((userIds || []).filter(Boolean).map((id) => id.toString()))];
    if (!uniqueIds.length) {
      return [];
    }

    const message = `Termin utakmice je promijenjen: ${gameDetails.homeTeam} vs ${gameDetails.awayTeam}. Novi termin: ${gameDetails.date} u ${gameDetails.time} (${gameDetails.venue}).`;
    const notifications = uniqueIds.map((userId) => ({
      userId,
      type: 'GAME_SCHEDULE_CHANGED',
      message,
      gameId,
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    return this.insertMany(notifications);
  } catch (error) {
    console.error('Error creating schedule change notifications:', error);
    throw error;
  }
};

notificationSchema.statics.createColleagueReplacedNotifications = async function(userIds, gameId, message) {
  try {
    const uniqueIds = [...new Set((userIds || []).filter(Boolean).map((id) => id.toString()))];
    if (!uniqueIds.length) {
      return [];
    }

    const notifications = uniqueIds.map((userId) => ({
      userId,
      type: 'COLLEAGUE_REPLACED',
      message,
      gameId,
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    return this.insertMany(notifications);
  } catch (error) {
    console.error('Error creating colleague replacement notifications:', error);
    throw error;
  }
};

notificationSchema.statics.createExpenseReviewNotification = async function(userId, travelExpenseId, details) {
  try {
    const approved = details?.approved === true;
    const period = `${details?.month || ''} ${details?.year || ''}`.trim();
    const reportType = details?.type || 'putno izvješće';
    const notes = (details?.notes || '').trim();
    const message = approved
      ? `Vaše putno izvješće (${reportType}, ${period}) je odobreno.`
      : `Vaše putno izvješće (${reportType}, ${period}) je odbijeno.${notes ? ` Napomena: ${notes}` : ''}`;

    return this.create({
      userId,
      type: approved ? 'EXPENSE_APPROVED' : 'EXPENSE_REJECTED',
      message,
      travelExpenseId,
      isRead: false
    });
  } catch (error) {
    console.error('Error creating expense review notification:', error);
    throw error;
  }
};

// Static method to create game assignment notification
notificationSchema.statics.createGameAssignmentNotification = async function(userId, gameId, gameDetails) {
  try {
    const message = `🏀 Nova nominacija: ${gameDetails.homeTeam} vs ${gameDetails.awayTeam}, ${gameDetails.date} u ${gameDetails.time} (${gameDetails.venue})`;
   
    const notification = await this.create({
      userId,
      type: 'GAME_ASSIGNMENT',
      message,
      gameId,
      isRead: false
    });

    console.log(`✅ Game assignment notification created for user ${userId}`);
    return notification;
  } catch (error) {
    console.error('❌ Error creating game assignment notification:', error);
    throw error;
  }
};

// Static method to create assignment response notification
notificationSchema.statics.createAssignmentResponseNotification = async function(adminUserId, refereeDetails, gameDetails, response) {
  try {
    const action = response === 'Accepted' ? 'prihvatio/la' : 'odbio/la';
    const emoji = response === 'Accepted' ? '✅' : '❌';
    const message = `${emoji} ${refereeDetails.name} ${refereeDetails.surname} je ${action} nominaciju za ${gameDetails.homeTeam} vs ${gameDetails.awayTeam} (${gameDetails.date})`;
   
    const notification = await this.create({
      userId: adminUserId,
      type: 'ASSIGNMENT_RESPONSE',
      message,
      gameId: gameDetails._id,
      isRead: false
    });

    console.log(`✅ Assignment response notification created for admin ${adminUserId}`);
    return notification;
  } catch (error) {
    console.error('❌ Error creating assignment response notification:', error);
    throw error;
  }
};

// Static method to create bulk game assignment notifications
notificationSchema.statics.createBulkGameAssignmentNotifications = async function(userIds, gameId, gameDetails) {
  try {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      console.warn('⚠️ No user IDs provided for bulk notification creation');
      return [];
    }

    const message = `🏀 Nova nominacija: ${gameDetails.homeTeam} vs ${gameDetails.awayTeam}, ${gameDetails.date} u ${gameDetails.time} (${gameDetails.venue})`;
    
    const notifications = userIds.map(userId => ({
      userId,
      type: 'GAME_ASSIGNMENT',
      message,
      gameId,
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    const createdNotifications = await this.insertMany(notifications);
    console.log(`✅ ${createdNotifications.length} bulk game assignment notifications created`);
    
    return createdNotifications;
  } catch (error) {
    console.error('❌ Error creating bulk game assignment notifications:', error);
    throw error;
  }
};

// Static method to create bulk assignment response notifications for all admins
notificationSchema.statics.createBulkAssignmentResponseNotifications = async function(refereeDetails, gameDetails, response) {
  try {
    // Get all admin users
    const User = mongoose.model('User');
    const adminUsers = await User.find({
      $or: [{ role: 'Admin' }, { 'roles.name': 'Admin' }]
    }, '_id').lean();
    
    if (adminUsers.length === 0) {
      console.warn('⚠️ No admin users found for assignment response notifications');
      return [];
    }

    const action = response === 'Accepted' ? 'prihvatio/la' : 'odbio/la';
    const emoji = response === 'Accepted' ? '✅' : '❌';
    const message = `${emoji} ${refereeDetails.name} ${refereeDetails.surname} je ${action} nominaciju za ${gameDetails.homeTeam} vs ${gameDetails.awayTeam} (${gameDetails.date})`;
    
    const notifications = adminUsers.map(admin => ({
      userId: admin._id,
      type: 'ASSIGNMENT_RESPONSE',
      message,
      gameId: gameDetails._id,
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    const createdNotifications = await this.insertMany(notifications);
    console.log(`✅ ${createdNotifications.length} bulk assignment response notifications created for admins`);
    
    return createdNotifications;
  } catch (error) {
    console.error('❌ Error creating bulk assignment response notifications:', error);
    throw error;
  }
};

// Static method to mark multiple notifications as read
notificationSchema.statics.markMultipleAsRead = async function(userId, notificationIds) {
  try {
    const result = await this.updateMany(
      { 
        _id: { $in: notificationIds }, 
        userId: userId 
      },
      { 
        isRead: true,
        updatedAt: new Date()
      }
    );

    console.log(`✅ Marked ${result.modifiedCount} notifications as read for user ${userId}`);
    return result;
  } catch (error) {
    console.error('❌ Error marking multiple notifications as read:', error);
    throw error;
  }
};

// Static method to mark all notifications as read for a user
notificationSchema.statics.markAllAsRead = async function(userId) {
  try {
    const result = await this.updateMany(
      { userId: userId, isRead: false },
      { 
        isRead: true,
        updatedAt: new Date()
      }
    );

    console.log(`✅ Marked all ${result.modifiedCount} notifications as read for user ${userId}`);
    return result;
  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    throw error;
  }
};

// Static method to get unread count for a user
notificationSchema.statics.getUnreadCount = async function(userId) {
  try {
    const count = await this.countDocuments({ 
      userId: userId, 
      isRead: false 
    });

    return count;
  } catch (error) {
    console.error('❌ Error getting unread count:', error);
    throw error;
  }
};

// Static method to clean up old notifications (optional - for maintenance)
notificationSchema.statics.cleanupOldNotifications = async function(daysOld = 90) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.deleteMany({
      createdAt: { $lt: cutoffDate },
      isRead: true
    });

    console.log(`🗑️ Cleaned up ${result.deletedCount} old read notifications older than ${daysOld} days`);
    return result;
  } catch (error) {
    console.error('❌ Error cleaning up old notifications:', error);
    throw error;
  }
};

// Instance method to mark as read
notificationSchema.methods.markAsRead = function() {
  try {
    this.isRead = true;
    this.updatedAt = new Date();
    return this.save();
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    throw error;
  }
};

// Instance method to check if notification is recent (within last 24 hours)
notificationSchema.methods.isRecent = function() {
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);
  return this.createdAt >= oneDayAgo;
};

// Pre-save middleware to ensure updatedAt is set
notificationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// ← UPDATE the pre-save validation to include kontrola
notificationSchema.pre('save', function(next) {
  // Validate that game assignment notifications have gameId
  if (this.type === 'GAME_ASSIGNMENT' && !this.gameId) {
    return next(new Error('GAME_ASSIGNMENT notifications must have a gameId'));
  }
  
  // Validate that assignment response notifications have gameId
  if (this.type === 'ASSIGNMENT_RESPONSE' && !this.gameId) {
    return next(new Error('ASSIGNMENT_RESPONSE notifications must have a gameId'));
  }

  // ← ADD THIS validation for kontrola notifications
  if (this.type === 'KONTROLA_RECEIVED' && (!this.gameId || !this.kontrolaId)) {
    return next(new Error('KONTROLA_RECEIVED notifications must have both gameId and kontrolaId'));
  }

  if (this.type === 'ASSIGNMENT_RELEASED' && !this.gameId) {
    return next(new Error('ASSIGNMENT_RELEASED notifications must have a gameId'));
  }

  if (this.type === 'GAME_SCHEDULE_CHANGED' && !this.gameId) {
    return next(new Error('GAME_SCHEDULE_CHANGED notifications must have a gameId'));
  }

  if (this.type === 'ASSIGNMENT_REMOVED' && !this.gameId) {
    return next(new Error('ASSIGNMENT_REMOVED notifications must have a gameId'));
  }

  if (this.type === 'COLLEAGUE_REPLACED' && !this.gameId) {
    return next(new Error('COLLEAGUE_REPLACED notifications must have a gameId'));
  }

  if (this.type === 'NOMINATION_EXPIRED' && !this.gameId) {
    return next(new Error('NOMINATION_EXPIRED notifications must have a gameId'));
  }

  if ((this.type === 'EXPENSE_APPROVED' || this.type === 'EXPENSE_REJECTED') && !this.travelExpenseId) {
    return next(new Error('Expense review notifications must have a travelExpenseId'));
  }
  
  next();
});

// Post-save middleware for logging
notificationSchema.post('save', function(doc) {
  console.log(`📧 Notification saved: ${doc.type} for user ${doc.userId}`);
});

// Ensure virtual fields are serialized
notificationSchema.set('toJSON', { virtuals: true });
notificationSchema.set('toObject', { virtuals: true });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;