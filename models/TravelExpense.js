const mongoose = require('mongoose');
const { withDisplayId } = require('../utils/displayId');
const { GAME_ASSIGNMENT_ROLES } = require('../config/roles');

const storedFileSchema = new mongoose.Schema({
  originalName: { type: String, required: true, trim: true },
  storedName: { type: String, required: true, trim: true },
  mimeType: { type: String, required: true, trim: true },
  size: { type: Number, required: true, min: 1 }
}, { _id: false });

const travelExpenseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BasketballGame',
    required: true
  },
  assignmentRole: {
    type: String,
    required: true,
    enum: GAME_ASSIGNMENT_ROLES,
    trim: true
  },
  usedHighway: {
    type: Boolean,
    default: false
  },
  nalogFile: {
    type: storedFileSchema,
    required: true
  },
  fuelReceiptFile: {
    type: storedFileSchema,
    required: true
  },
  tollReceiptFile: {
    type: storedFileSchema,
    required: false
  },
  state: {
    type: String,
    required: true,
    enum: ['Predano', 'Potvrđeno', 'Odbijeno'],
    default: 'Predano'
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: {
    type: Date
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewComments: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

withDisplayId(travelExpenseSchema, 'travelExpense');

const publicFile = (file) => {
  if (!file) return null;
  return {
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size
  };
};

travelExpenseSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id ? ret._id.toString() : ret.id;
    ret.nalogFile = publicFile(ret.nalogFile);
    ret.fuelReceiptFile = publicFile(ret.fuelReceiptFile);
    ret.tollReceiptFile = publicFile(ret.tollReceiptFile);
    if (ret.userId && typeof ret.userId === 'object') {
      ret.userName = ret.userId.name;
      ret.userSurname = ret.userId.surname;
    }
    return ret;
  }
});
travelExpenseSchema.set('toObject', { virtuals: true });

travelExpenseSchema.index({ userId: 1, gameId: 1 }, { unique: true });
travelExpenseSchema.index({ state: 1 });
travelExpenseSchema.index({ createdAt: -1 });

module.exports = mongoose.model('TravelExpense', travelExpenseSchema);
