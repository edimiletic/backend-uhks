// backend/models/travelExpense.js
const mongoose = require('mongoose');
const { withDisplayId } = require('../utils/displayId');

const travelExpenseSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'Troškovno izvješće suca',
      'Troškovno izvješće delegata',
      'Troškovno izvješće pomoćnog suca',
      'Troškovno izvješće kontrolora'
    ],
    trim: true
  },
  season: {
    type: String,
    required: true,
    default: '2026./2027.',
    trim: true
  },
  year: {
    type: Number,
    required: true,
    enum: [2024, 2025, 2026, 2027],
    validate: {
      validator: function(value) {
        return value >= 2024 && value <= 2027;
      },
      message: 'Year must be between 2024 and 2027'
    }
  },
  month: {
    type: String,
    required: true,
    enum: [
      'Siječanj', 'Veljača', 'Ožujak', 'Travanj',
      'Svibanj', 'Lipanj', 'Srpanj', 'Kolovoz',
      'Rujan', 'Listopad', 'Studeni', 'Prosinac'
    ],
    trim: true
  },
  state: {
    type: String,
    required: true,
    enum: ['Skica', 'Predano', 'Potvrđeno', 'Odbijeno'],
    default: 'Skica'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Updated expenses array to match frontend ExpenseItem interface
  expenses: [{
    type: {
      type: String,
      required: true,
      enum: ['Prijevoz automobilom', 'Putnička karta'],
      trim: true
    },
    date: {
      type: Date,
      required: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    unit: {
      type: String,
      required: true,
      enum: ['km', 'tk'],
      trim: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    competition: {
      type: String,
      required: true,
      enum: [
        'SuperSport Premijer liga',
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
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    gameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BasketballGame'
    },
    homeTeam: {
      type: String,
      trim: true
    },
    awayTeam: {
      type: String,
      trim: true
    }
  }],
  totalAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  submittedAt: {
    type: Date
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

travelExpenseSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id ? ret._id.toString() : ret.id;
    if (ret.userId && typeof ret.userId === 'object') {
      ret.userName = ret.userId.name;
      ret.userSurname = ret.userId.surname;
    }
    return ret;
  }
});
travelExpenseSchema.set('toObject', { virtuals: true });

// Virtual field for userName
travelExpenseSchema.virtual('userName', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
  get: function() {
    return this.userId ? this.userId.name : null;
  }
});

// Virtual field for userSurname
travelExpenseSchema.virtual('userSurname', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
  get: function() {
    return this.userId ? this.userId.surname : null;
  }
});

// Pre-save middleware to validate and auto-calculate amount
travelExpenseSchema.pre('save', function(next) {
  if (this.expenses && this.expenses.length > 0) {
    this.expenses.forEach(expense => {
      // Auto-calculate amount based on quantity and unitPrice
      const calculatedAmount = expense.quantity * expense.unitPrice;
      expense.amount = Math.round(calculatedAmount * 100) / 100; // Round to 2 decimal places
    });
  }
  next();
});

// Pre-save middleware to calculate total amount
travelExpenseSchema.pre('save', function(next) {
  if (this.expenses && this.expenses.length > 0) {
    this.totalAmount = this.expenses.reduce((total, expense) => total + (expense.amount || 0), 0);
  } else {
    this.totalAmount = 0;
  }
  next();
});

// Pre-save middleware to set submittedAt when state changes to 'Submitted'
travelExpenseSchema.pre('save', function(next) {
  if (this.isModified('state') && this.state === 'Predano' && !this.submittedAt) {
    this.submittedAt = new Date();
  }
  next();
});

// Index for better query performance
travelExpenseSchema.index({ userId: 1, year: 1, month: 1 });
travelExpenseSchema.index({ state: 1 });
travelExpenseSchema.index({ createdAt: -1 });

const TravelExpense = mongoose.model('TravelExpense', travelExpenseSchema);

module.exports = TravelExpense;