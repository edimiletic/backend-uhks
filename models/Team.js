const mongoose = require('mongoose');
const { ALL_COMPETITIONS } = require('../config/roles');

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  competitions: {
    type: [String],
    default: [],
    validate: {
      validator: (values) => values.every((competition) => ALL_COMPETITIONS.includes(competition)),
      message: 'Invalid competition on team'
    }
  }
}, {
  timestamps: true
});

teamSchema.index({ competitions: 1 });

module.exports = mongoose.model('Team', teamSchema);
