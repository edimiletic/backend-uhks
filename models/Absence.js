const mongoose = require('mongoose');
const { withDisplayId } = require('../utils/displayId');

const absenceSchema = new mongoose.Schema({
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true,
    validate: {
      validator: function(value) {
        return value >= this.startDate; // Changed from > to >= to allow same day
      },
      message: 'End date must be on or after start date'
    }
  },
  userPersonalCode: {
    type: String,
    required: true,
    ref: 'User'
  },
  reason: {
    type: String,
    trim: true,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Index for better query performance
withDisplayId(absenceSchema, 'absence');

absenceSchema.index({ userPersonalCode: 1 });
absenceSchema.index({ startDate: 1, endDate: 1 });

// Virtual for calculating duration in days
absenceSchema.virtual('durationDays').get(function() {
  const diffTime = Math.abs(this.endDate - this.startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Add 1 to include both start and end day
  return diffDays;
});

// Ensure virtual fields are serialized
absenceSchema.set('toJSON', { virtuals: true });

const Absence = mongoose.model('Absence', absenceSchema);
module.exports = Absence;