// backend/models/examAttempt.js
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

const ExamAttempt = mongoose.model('ExamAttempt', examAttemptSchema);

module.exports = { QuestionBank, Exam, ExamAttempt };
