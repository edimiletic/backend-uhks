const BasketballGame = require('../models/BasketballGames');
const User = require('../models/User');
const Notification = require('../models/Notification');
const {
  adminUserQuery,
  commissionerRoleQuery,
  shouldReceiveAssignmentResponse
} = require('../config/roles');

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const EXPIRY_INTERVAL_MS = 5 * 60 * 1000;

const getGameDateTime = (game) => {
  const dateTime = new Date(game.date);
  const [hours = '0', minutes = '0'] = String(game.time || '00:00').split(':');
  dateTime.setHours(Number(hours) || 0, Number(minutes) || 0, 0, 0);
  return dateTime;
};

const isPlayedGame = (game, now = new Date()) => getGameDateTime(game).getTime() < now.getTime();

const getNominationDeadline = (game, assignment) => {
  const assignedAt = assignment?.assignedAt ? new Date(assignment.assignedAt) : new Date(0);
  const twoDaysLater = new Date(assignedAt.getTime() + TWO_DAYS_MS);
  const gameStart = getGameDateTime(game);
  return twoDaysLater.getTime() <= gameStart.getTime() ? twoDaysLater : gameStart;
};

const isNominationExpired = (game, assignment, now = new Date()) => {
  if (!assignment || assignment.assignmentStatus !== 'Pending') {
    return false;
  }
  return now.getTime() >= getNominationDeadline(game, assignment).getTime();
};

const assignmentUserId = (userId) => {
  if (!userId) return '';
  if (typeof userId === 'object') return String(userId._id || userId.id || '');
  return String(userId);
};

const gameNotifyDetails = (game) => ({
  homeTeam: game.homeTeam,
  awayTeam: game.awayTeam,
  date: new Date(game.date).toLocaleDateString('hr-HR'),
  time: game.time,
  venue: game.venue
});

const notifyExpiryRecipients = async (game, assignment) => {
  const details = gameNotifyDetails(game);
  const officialId = assignmentUserId(assignment.userId);
  const official = assignment.userId && assignment.userId.name
    ? assignment.userId
    : officialId
      ? await User.findById(officialId).select('name surname')
      : null;
  const officialName = official ? `${official.name} ${official.surname}`.trim() : 'Službena osoba';

  if (officialId) {
    await Notification.createNominationExpiredNotification(officialId, game._id, details);
  }

  const recipientQuery = [adminUserQuery()];
  if (assignment.role === 'Pomoćni Sudac') {
    recipientQuery.push(commissionerRoleQuery('Povjerenik za pomoćne suce'));
  } else {
    recipientQuery.push(commissionerRoleQuery('Povjerenik za službene osobe'));
  }

  const candidateUsers = await User.find({ $or: recipientQuery });
  const seen = new Set();
  const recipientIds = [];
  candidateUsers.forEach((user) => {
    if (!shouldReceiveAssignmentResponse(user, assignment.role, game.competition)) {
      return;
    }
    const id = String(user._id);
    if (seen.has(id) || id === officialId) return;
    seen.add(id);
    recipientIds.push(user._id);
  });

  await Promise.all(recipientIds.map((userId) =>
    Notification.createNominationExpiredCommissionerNotification(
      userId,
      game._id,
      details,
      officialName,
      assignment.role
    )
  ));
};

const expireOverdueNominations = async () => {
  const now = new Date();
  const games = await BasketballGame.find({
    'refereeAssignments.assignmentStatus': 'Pending'
  }).populate('refereeAssignments.userId', 'name surname');

  let expiredCount = 0;

  for (const game of games) {
    const expired = [];
    game.refereeAssignments.forEach((assignment, index) => {
      if (isNominationExpired(game, assignment, now)) {
        expired.push({ index, assignment });
      }
    });

    if (!expired.length) {
      continue;
    }

    for (let i = expired.length - 1; i >= 0; i -= 1) {
      game.refereeAssignments.splice(expired[i].index, 1);
    }

    try {
      await game.save();
    } catch (error) {
      console.error(`Failed to save expired nominations for game ${game._id}:`, error);
      continue;
    }

    for (const item of expired) {
      try {
        await notifyExpiryRecipients(game, item.assignment);
        expiredCount += 1;
      } catch (notificationError) {
        console.error('Error notifying expired nomination:', notificationError);
      }
    }
  }

  if (expiredCount) {
    console.log(`Expired ${expiredCount} unanswered nomination(s)`);
  }

  return expiredCount;
};

const startNominationExpiryJob = () => {
  expireOverdueNominations().catch((error) => {
    console.error('Nomination expiry job failed:', error);
  });

  setInterval(() => {
    expireOverdueNominations().catch((error) => {
      console.error('Nomination expiry job failed:', error);
    });
  }, EXPIRY_INTERVAL_MS);
};

module.exports = {
  TWO_DAYS_MS,
  getGameDateTime,
  isPlayedGame,
  getNominationDeadline,
  isNominationExpired,
  expireOverdueNominations,
  startNominationExpiryJob
};
