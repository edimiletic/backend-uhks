// backend/models/basketballGame.js
const mongoose = require('mongoose');
const { withDisplayId } = require('../utils/displayId');

const basketballGameSchema = new mongoose.Schema({
  // Basic game information
  homeTeam: {
    type: String,
    required: true,
    trim: true
  },
  awayTeam: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true,
    trim: true
  },
  venue: {
    type: String,
    required: true,
    trim: true
  },
  competition: {
    type: String,
    required: true,
    enum: [
      'FAVBET PREMIJER LIGA',
      'KUP «K. ĆOSIĆ»',
      'PRVA MUŠKA LIGA',
      'ZAVRŠNI TURNIR ZA POPUNU PRVE MUŠKE LIGE',
      'DRUGE MUŠKE LIGE',
      'TREĆE MUŠKE LIGE',
      'ČETVRTE MUŠKE LIGE',
      'PREMIJER ŽENSKA LIGA',
      'PRVA ŽENSKA LIGA',
      'KUP «R. MEGLAJ-RIMAC»',
      'JUNIORI',
      'JUNIORKE',
      'KADETI',
      'KADETKINJE',
      'MLAĐI KADETI',
      'MLAĐE KADETKINJE',
      'DJEČACI I DJEVOJČICE',
      'NATJECANJE SREDNJIH ŠKOLA',
      'NATJECANJE OSNOVNIH ŠKOLA',
      'Natjecanje MINI KOŠARKA',
      '3X3'
    ],
    trim: true
  },
  
  // Game status
  status: {
    type: String,
    enum: ['Scheduled', 'Ongoing', 'Completed', 'Cancelled'],
    default: 'Scheduled'
  },
  
  // Referee assignments - updated structure for multiple referees
  refereeAssignments: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['Sudac', 'Delegat', 'Pomoćni Sudac', 'Kontrolor'],
      required: true
    },
    position: {
      type: Number,
      required: true,
      min: 1,
      max: 3 // Maximum 3 referees of same type
    },
    assignmentStatus: {
      type: String,
      enum: ['Pending', 'Accepted', 'Rejected'],
      default: 'Pending'
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    respondedAt: {
      type: Date
    },
    rejectionReason: {
      type: String,
      trim: true
    }
  }],
  
  // Score (if completed)
  score: {
    homeScore: {
      type: Number,
      min: 0
    },
    awayScore: {
      type: Number,
      min: 0
    }
  },
  
  // Additional information
  notes: {
    type: String,
    trim: true
  },
  
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

withDisplayId(basketballGameSchema, 'basketballGame');

// Virtual for formatted date
basketballGameSchema.virtual('formattedDate').get(function() {
  if (!this.date) return '';
  return this.date.toLocaleDateString('hr-HR');
});

// Virtual for game duration (if needed)
basketballGameSchema.virtual('gameDateTime').get(function() {
  if (!this.date || !this.time) return null;
  
  const dateTime = new Date(this.date);
  const timeParts = this.time.split(':');
  if (timeParts.length >= 2) {
    const hours = parseInt(timeParts[0]) || 0;
    const minutes = parseInt(timeParts[1]) || 0;
    dateTime.setHours(hours, minutes);
  }
  return dateTime;
});

// ✅ FIXED - Virtual to get referee counts by role
basketballGameSchema.virtual('refereeCount').get(function() {
  const counts = {
    Sudac: 0,
    Delegat: 0,
    'Pomoćni Sudac': 0,
    Kontrolor: 0
  };
  
  // Safety check for undefined/null refereeAssignments
  if (this.refereeAssignments && Array.isArray(this.refereeAssignments)) {
    this.refereeAssignments.forEach(assignment => {
      if (assignment && assignment.role && counts.hasOwnProperty(assignment.role)) {
        counts[assignment.role]++;
      }
    });
  }
  
  return counts;
});

// Index for better query performance
basketballGameSchema.index({ date: 1, competition: 1 });
basketballGameSchema.index({ 'refereeAssignments.userId': 1 });
basketballGameSchema.index({ status: 1 });
basketballGameSchema.index({ createdAt: -1 });
basketballGameSchema.index({ 'refereeAssignments.role': 1, 'refereeAssignments.position': 1 });

// Validate that home and away teams are different
basketballGameSchema.pre('save', function(next) {
  if (this.homeTeam && this.awayTeam && this.homeTeam.toLowerCase() === this.awayTeam.toLowerCase()) {
    next(new Error('Home team and away team cannot be the same'));
    return;
  }
  next();
});

// Validate that game date is not in the past (for new games)
basketballGameSchema.pre('save', function(next) {
  if (this.isNew && this.date) {
    const gameDate = new Date(this.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (gameDate < today) {
      next(new Error('Game date cannot be in the past'));
      return;
    }
  }
  next();
});

// Validate referee assignments
basketballGameSchema.pre('save', function(next) {
  if (!this.refereeAssignments || !Array.isArray(this.refereeAssignments)) {
    return next();
  }

  // Check for proper referee counts and positions
  const rolePositions = {};
  
  this.refereeAssignments.forEach(assignment => {
    if (assignment && assignment.role && assignment.position) {
      const key = `${assignment.role}-${assignment.position}`;
      if (rolePositions[key]) {
        next(new Error(`Duplicate position ${assignment.position} for role ${assignment.role}`));
        return;
      }
      rolePositions[key] = true;
    }
  });
  
  // Validate referee limits per role
  const roleCounts = {};
  this.refereeAssignments.forEach(assignment => {
    if (assignment && assignment.role) {
      roleCounts[assignment.role] = (roleCounts[assignment.role] || 0) + 1;
    }
  });
  
  // Check limits: 2-3 Sudac, 0-1 Delegat, 2-3 Pomoćni Sudac
  if (roleCounts['Sudac'] > 3) {
    next(new Error('Maximum 3 Sudac allowed per game'));
    return;
  }
  if (roleCounts['Delegat'] > 1) {
    next(new Error('Maximum 1 Delegat allowed per game'));
    return;
  }
  if (roleCounts['Pomoćni Sudac'] > 3) {
    next(new Error('Maximum 3 Pomoćni Sudac allowed per game'));
    return;
  }
  if (roleCounts['Kontrolor'] > 1) {
    next(new Error('Maximum 1 Kontrolor allowed per game'));
    return;
  }
  
  next();
});

// ✅ FIXED - Instance method to check if all referees have responded
basketballGameSchema.methods.areAllRefereesResponded = function() {
  if (!this.refereeAssignments || !Array.isArray(this.refereeAssignments) || this.refereeAssignments.length === 0) {
    return true; // No assignments = all responded
  }
  
  return this.refereeAssignments.every(assignment => 
    assignment && assignment.assignmentStatus !== 'Pending'
  );
};

// ✅ FIXED - Instance method to check if all referees have accepted
basketballGameSchema.methods.areAllRefereesAccepted = function() {
  if (!this.refereeAssignments || !Array.isArray(this.refereeAssignments) || this.refereeAssignments.length === 0) {
    return true; // No assignments = all accepted
  }
  
  return this.refereeAssignments.every(assignment => 
    assignment && assignment.assignmentStatus === 'Accepted'
  );
};

// ✅ FIXED - Instance method to get available referee positions for a role
basketballGameSchema.methods.getAvailablePositions = function(role) {
  const maxPositions = {
    'Sudac': 3,
    'Delegat': 1,
    'Pomoćni Sudac': 3,
    'Kontrolor': 1
  };
  
  const occupiedPositions = [];
  
  if (this.refereeAssignments && Array.isArray(this.refereeAssignments)) {
    this.refereeAssignments
      .filter(assignment => assignment && assignment.role === role)
      .forEach(assignment => {
        if (assignment && assignment.position) {
          occupiedPositions.push(assignment.position);
        }
      });
  }
  
  const availablePositions = [];
  const maxPos = maxPositions[role] || 1;
  for (let i = 1; i <= maxPos; i++) {
    if (!occupiedPositions.includes(i)) {
      availablePositions.push(i);
    }
  }
  
  return availablePositions;
};

// ✅ FIXED - Instance method to get next available position for a role
basketballGameSchema.methods.getNextAvailablePosition = function(role) {
  const availablePositions = this.getAvailablePositions(role);
  return availablePositions.length > 0 ? Math.min(...availablePositions) : null;
};

// ✅ FIXED - Instance method to check if user is already assigned
basketballGameSchema.methods.isUserAssigned = function(userId) {
  if (!this.refereeAssignments || !Array.isArray(this.refereeAssignments)) {
    return false;
  }
  
  return this.refereeAssignments.some(assignment => 
    assignment && assignment.userId && assignment.userId.toString() === userId.toString()
  );
};

// ✅ FIXED - Instance method to get referee assignment summary
basketballGameSchema.methods.getRefereeAssignmentSummary = function() {
  const summary = {
    Sudac: { assigned: 0, accepted: 0, positions: [] },
    Delegat: { assigned: 0, accepted: 0, positions: [] },
    'Pomoćni Sudac': { assigned: 0, accepted: 0, positions: [] },
    Kontrolor: { assigned: 0, accepted: 0, positions: [] }
  };
  
  if (this.refereeAssignments && Array.isArray(this.refereeAssignments)) {
    this.refereeAssignments.forEach(assignment => {
      if (assignment && assignment.role && summary.hasOwnProperty(assignment.role)) {
        summary[assignment.role].assigned++;
        
        if (assignment.position) {
          summary[assignment.role].positions.push(assignment.position);
        }
        
        if (assignment.assignmentStatus === 'Accepted') {
          summary[assignment.role].accepted++;
        }
      }
    });
  }
  
  return summary;
};



const BasketballGame = mongoose.model('BasketballGame', basketballGameSchema);

module.exports = BasketballGame;