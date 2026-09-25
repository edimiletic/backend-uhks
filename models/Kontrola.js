// backend/models/kontrola.js
const mongoose = require('mongoose');

const refereeGradeSchema = new mongoose.Schema({
  refereeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  refereeName: {
    type: String,
    required: true
  },
  refereeRole: {
    type: String,
    enum: ['Sudac', 'Delegat', 'Pomoćni Sudac'],
    required: true
  },
  refereePosition: {
    type: Number,
    required: true
  },
  // Grade categories
  pogreske: {
    type: String,
    enum: ['Izvrsno', 'Iznad Prosjeka', 'Prosječno', 'Ispod Prosjeka', 'Loše'],
    required: true
  },
  prekrsaji: {
    type: String,
    enum: ['Izvrsno', 'Iznad Prosjeka', 'Prosječno', 'Ispod Prosjeka', 'Loše'],
    required: true
  },
  tehnikaMehanika: {
    type: String,
    enum: ['Izvrsno', 'Iznad Prosjeka', 'Prosječno', 'Ispod Prosjeka', 'Loše'],
    required: true
  },
  timskiRad: {
    type: String,
    enum: ['Izvrsno', 'Iznad Prosjeka', 'Prosječno', 'Ispod Prosjeka', 'Loše'],
    required: true
  },
  kontrolaUtakmice: {
    type: String,
    enum: ['Izvrsno', 'Iznad Prosjeka', 'Prosječno', 'Ispod Prosjeka', 'Loše'],
    required: true
  },
  ocjena: {  // Add this new field
  type: String,
  enum: ['Izvrsno', 'Iznad Prosjeka', 'Prosječno', 'Ispod Prosjeka', 'Loše'],
  required: true
},
  // Text areas
  kontroliraniSudac: {
    type: String,
    required: true,
    trim: true
  },
  komentiranesituacije: {
    type: String,
    required: true,
    trim: true
  },
  komentarUtakmice: {
    type: String,
    required: true,
    trim: true
  }
});

const kontrolaSchema = new mongoose.Schema({
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BasketballGame',
    required: true,
    unique: true,
    index: true
  },
  tezinaUtakmice: {
    type: String,
    enum: ['Lagana', 'Prosječna', 'Teška'],
    required: true
  },
  refereeGrades: [refereeGradeSchema],
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
  timestamps: true
});

// Indexes for efficient queries
// kontrolaSchema.index({ gameId: 1 });
// kontrolaSchema.index({ 'refereeGrades.refereeId': 1 });
kontrolaSchema.index({ createdBy: 1, createdAt: -1 });

// Static method to create kontrola with notifications
kontrolaSchema.statics.createWithNotifications = async function(kontrolaData, createdByUserId) {
  try {
    const refereeGrades = (kontrolaData.refereeGrades || []).filter(
      grade => grade.refereeRole === 'Sudac'
    );

    if (refereeGrades.length === 0) {
      throw new Error('Kontrola mora sadržavati ocjene suca.');
    }

    const kontrola = new this({
      ...kontrolaData,
      refereeGrades,
      createdBy: createdByUserId
    });
    
    await kontrola.save();

    // Get game details for notifications
    const BasketballGame = mongoose.model('BasketballGame');
    const game = await BasketballGame.findById(kontrolaData.gameId);
    
    if (!game) {
      throw new Error('Game not found for kontrola notifications');
    }

    // Create notifications for all referees in the kontrola
    const Notification = mongoose.model('Notification');
    await Notification.createBulkKontrolaNotifications(
      refereeGrades,
      kontrolaData.gameId,
      kontrola._id,
      {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        date: game.date.toISOString().split('T')[0],
        time: game.time,
        venue: game.venue
      }
    );

    console.log(`✅ Kontrola created with notifications for game ${kontrolaData.gameId}`);
    return kontrola;
    
  } catch (error) {
    console.error('❌ Error creating kontrola with notifications:', error);
    throw error;
  }
};

// Static method to get kontrola for a specific referee

kontrolaSchema.statics.getForReferee = async function(gameId, refereeId) {
  try {
    console.log(`🔍 Kontrola.getForReferee called`);
    console.log(`   gameId: ${gameId} (type: ${typeof gameId})`);
    console.log(`   refereeId: ${refereeId} (type: ${typeof refereeId})`);
    
    const kontrola = await this.findOne({ gameId })
      .populate('gameId')
      .populate('createdBy', 'name surname')
      .lean();

    if (!kontrola) {
      console.log(`❌ No kontrola document found for gameId: ${gameId}`);
      return null;
    }

    console.log(`✅ Kontrola document found`);
    console.log(`   Kontrola ID: ${kontrola._id}`);
    console.log(`   Number of referee grades: ${kontrola.refereeGrades.length}`);

    // Find the specific referee's grade with detailed logging
    const refereeGrade = kontrola.refereeGrades.find((grade, index) => {
      const gradeIdStr = grade.refereeId.toString();
      const refereeIdStr = refereeId.toString();
      const matches = gradeIdStr === refereeIdStr;
      
      console.log(`   Grade ${index}:`);
      console.log(`     refereeId: ${gradeIdStr}`);
      console.log(`     refereeName: ${grade.refereeName}`);
      console.log(`     matches current user: ${matches}`);
      
      return matches;
    });

    if (!refereeGrade) {
      console.log(`❌ No matching grade found for referee ${refereeId}`);
      console.log(`   Available referee IDs: ${kontrola.refereeGrades.map(g => g.refereeId.toString()).join(', ')}`);
      return null;
    }

    console.log(`✅ Found matching grade for referee ${refereeId}`);
    
    return {
      gameId: kontrola.gameId._id,
      gameInfo: {
        homeTeam: kontrola.gameId.homeTeam,
        awayTeam: kontrola.gameId.awayTeam,
        date: kontrola.gameId.date,
        time: kontrola.gameId.time,
        venue: kontrola.gameId.venue,
        competition: kontrola.gameId.competition
      },
      tezinaUtakmice: kontrola.tezinaUtakmice,
      refereeGrade: refereeGrade,
      createdAt: kontrola.createdAt,
      createdBy: `${kontrola.createdBy.name} ${kontrola.createdBy.surname}`
    };
    
  } catch (error) {
    console.error('❌ Error in getForReferee:', error);
    throw error;
  }
};

// Static method to check if kontrola exists for game
kontrolaSchema.statics.existsForGame = async function(gameId) {
  try {
    const kontrola = await this.findOne({ gameId }).lean();
    return !!kontrola;
  } catch (error) {
    console.error('❌ Error checking kontrola existence:', error);
    return false;
  }
};

// Instance method to update with notifications for new referees
kontrolaSchema.methods.updateWithNotifications = async function(updateData, updatedByUserId) {
  try {
    const refereeGrades = (updateData.refereeGrades || []).filter(
      grade => grade.refereeRole === 'Sudac'
    );

    const currentRefereeIds = new Set(this.refereeGrades.map(grade => grade.refereeId.toString()));
    
    const newRefereeIds = refereeGrades
      .map(grade => grade.refereeId)
      .filter(id => !currentRefereeIds.has(id));

    this.tezinaUtakmice = updateData.tezinaUtakmice;
    this.refereeGrades = refereeGrades;
    this.updatedBy = updatedByUserId;
    
    await this.save();

    // Send notifications only to newly added referees
    if (newRefereeIds.length > 0) {
      const BasketballGame = mongoose.model('BasketballGame');
      const game = await BasketballGame.findById(this.gameId);
      
      if (game) {
        const newRefereeGrades = refereeGrades.filter(
          grade => newRefereeIds.includes(grade.refereeId)
        );

        const Notification = mongoose.model('Notification');
        await Notification.createBulkKontrolaNotifications(
          newRefereeGrades,
          this.gameId,
          this._id,
          {
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            date: game.date.toISOString().split('T')[0],
            time: game.time,
            venue: game.venue
          }
        );

        console.log(`✅ Kontrola updated with notifications for ${newRefereeIds.length} new referees`);
      }
    }

    return this;
    
  } catch (error) {
    console.error('❌ Error updating kontrola with notifications:', error);
    throw error;
  }
};

const Kontrola = mongoose.model('Kontrola', kontrolaSchema);
module.exports = Kontrola;