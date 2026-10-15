const mongoose = require('mongoose');

const nominationRejectionSchema = new mongoose.Schema({
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BasketballGame',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: { type: String, required: true, trim: true },
  surname: { type: String, required: true, trim: true },
  role: { type: String, required: true, trim: true },
  position: { type: Number },
  reason: { type: String, required: true, trim: true },
  rejectedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

nominationRejectionSchema.index({ gameId: 1, rejectedAt: -1 });

module.exports = mongoose.model('NominationRejection', nominationRejectionSchema);
