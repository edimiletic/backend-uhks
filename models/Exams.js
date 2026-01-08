// backend/models/exam.js
const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: true,
    trim: true
  },
  correctAnswer: {
    type: Boolean,
    required: true
  }
});

// Question Bank Schema - Admin managed pool of questions
const questionBankSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  correctAnswer: {
    type: Boolean,
    required: true
  },
  category: {
    type: String,
    trim: true,
    default: 'General'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Generated Exam Schema - Created automatically for each user attempt
const examSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    default: 'Sudački ispit'
  },
  questions: [questionSchema],
  passingScore: {
    type: Number,
    default: 20,
    min: 1,
    max: 25
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours from creation
  }
}, {
  timestamps: true
});

// Auto-delete expired exams

examSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 2 * 24 * 60 * 60 }); // 2 days

// Exam Attempt Schema
const examAttemptSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  answers: [{
    questionIndex: Number,
    answer: Boolean
  }],
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 25
  },
  passed: {
    type: Boolean,
    required: true
  },
  completedAt: {
    type: Date,
    default: Date.now
  },
  timeSpent: {
    type: Number, // in minutes
    default: 0
  }
}, {
  timestamps: true
});

const QuestionBank = mongoose.model('QuestionBank', questionBankSchema);
const Exam = mongoose.model('Exam', examSchema);
const ExamAttempt = mongoose.model('ExamAttempt', examAttemptSchema);

module.exports = { QuestionBank, Exam, ExamAttempt };
