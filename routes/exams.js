// backend/routes/exams.js
const express = require('express');
const router = express.Router();
const { QuestionBank, Exam, ExamAttempt } = require('../models/Exams');
const User = require('../models/User');
const authenticateUser = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authenticateUser);

// POST - Generate new exam for user
router.post('/generate', async (req, res) => {
  try {
    // Check if user already has an active (incomplete) exam
    const existingExam = await Exam.findOne({
      userId: req.user._id,
      isCompleted: false,
      expiresAt: { $gt: new Date() }
    });

    if (existingExam) {
      // Return existing exam without correct answers
      const examForUser = {
        ...existingExam.toObject(),
        questions: existingExam.questions.map((q, index) => ({
          _id: q._id,
          questionText: q.questionText,
          index: index
        }))
      };
      return res.json(examForUser);
    }

    // Get active questions from question bank
    const availableQuestions = await QuestionBank.find({ isActive: true });
    
    if (availableQuestions.length < 25) {
      return res.status(400).json({ 
        error: 'Nedovoljno pitanja u bazi. Potrebno je najmanje 25 aktivnih pitanja.' 
      });
    }

    // Randomly select 25 questions
    const shuffled = availableQuestions.sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffled.slice(0, 25).map(q => ({
      questionText: q.questionText,
      correctAnswer: q.correctAnswer
    }));

    // Create new exam
    const newExam = new Exam({
      userId: req.user._id,
      questions: selectedQuestions,
      title: 'Sudački ispit' // Removed date from title
    });

    await newExam.save();

    // Return exam without correct answers
    const examForUser = {
      ...newExam.toObject(),
      questions: newExam.questions.map((q, index) => ({
        _id: q._id,
        questionText: q.questionText,
        index: index
      }))
    };

    res.status(201).json(examForUser);
  } catch (error) {
    console.error('Generate exam error:', error);
    res.status(500).json({ error: 'Failed to generate exam' });
  }
});

// GET - Get user's current active exam
router.get('/current', async (req, res) => {
  try {
    const exam = await Exam.findOne({
      userId: req.user._id,
      isCompleted: false,
      expiresAt: { $gt: new Date() }
    });
    
    if (!exam) {
      return res.status(404).json({ error: 'No active exam found' });
    }

    // Return exam without correct answers
    const examForUser = {
      ...exam.toObject(),
      questions: exam.questions.map((q, index) => ({
        _id: q._id,
        questionText: q.questionText,
        index: index
      }))
    };

    res.json(examForUser);
  } catch (error) {
    console.error('Get current exam error:', error);
    res.status(500).json({ error: 'Failed to fetch exam' });
  }
});

// GET - Get user's exam attempts
router.get('/attempts', async (req, res) => {
  try {
    const attempts = await ExamAttempt.find({ userId: req.user._id })
      .populate('examId', 'title')
      .sort({ completedAt: -1 });

    // Filter out corrupt attempts and log them
    const validAttempts = attempts.filter(attempt => {
      const hasValidScore = typeof attempt.score === 'number' && attempt.score >= 0;
      const hasValidDate = attempt.completedAt && attempt.completedAt instanceof Date;
      const hasValidPassed = typeof attempt.passed === 'boolean';
      
      const isValid = hasValidScore && hasValidDate && hasValidPassed;
      
      if (!isValid) {
        console.log('Filtering out invalid attempt:', {
          id: attempt._id,
          score: attempt.score,
          completedAt: attempt.completedAt,
          passed: attempt.passed,
          examId: attempt.examId
        });
      }
      
      return isValid;
    });

    console.log(`Returning ${validAttempts.length} valid attempts out of ${attempts.length} total`);
    res.json(validAttempts);
  } catch (error) {
    console.error('Get exam attempts error:', error);
    res.status(500).json({ error: 'Failed to fetch exam attempts' });
  }
});

// DELETE - Delete exam attempt (Users can delete their own, Admins can delete any)
router.delete('/attempts/:id', async (req, res) => {
  try {
    const attempt = await ExamAttempt.findById(req.params.id);
    if (!attempt) {
      return res.status(404).json({ error: 'Exam attempt not found' });
    }

    // Users can only delete their own attempts, admins can delete any
    if (req.user.role !== 'Admin' && attempt.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied. You can only delete your own attempts.' });
    }

    await ExamAttempt.deleteOne({ _id: req.params.id });
    res.json({ message: 'Exam attempt deleted successfully' });
  } catch (error) {
    console.error('Delete exam attempt error:', error);
    res.status(500).json({ error: 'Failed to delete exam attempt' });
  }
});

// GET - Get exam attempt details for review
router.get('/attempts/:id/review', async (req, res) => {
  try {
    const attempt = await ExamAttempt.findById(req.params.id)
      .populate('examId', 'title questions')
      .populate('userId', 'name surname');

    if (!attempt) {
      return res.status(404).json({ error: 'Exam attempt not found' });
    }

    // Users can only view their own attempts, admins can view any
    if (req.user.role !== 'Admin' && attempt.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied. You can only review your own attempts.' });
    }

    // Return attempt with questions and correct answers for review
    const reviewData = {
      attempt: {
        _id: attempt._id,
        score: attempt.score,
        passed: attempt.passed,
        completedAt: attempt.completedAt,
        timeSpent: attempt.timeSpent,
        answers: attempt.answers
      },
      exam: attempt.examId ? {
        _id: attempt.examId._id,
        title: attempt.examId.title,
        questions: attempt.examId.questions
      } : null,
      user: {
        name: attempt.userId ? `${attempt.userId.name} ${attempt.userId.surname}` : 'Unknown User'
      }
    };

    res.json(reviewData);
  } catch (error) {
    console.error('Get attempt review error:', error);
    res.status(500).json({ error: 'Failed to fetch attempt review' });
  }
});

// POST - Submit exam attempt
router.post('/submit', async (req, res) => {
  try {
    const { examId, answers, timeSpent } = req.body;

    if (!examId || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Invalid exam submission data' });
    }

    const exam = await Exam.findById(examId);
    if (!exam || exam.isCompleted) {
      return res.status(404).json({ error: 'Exam not found or already completed' });
    }

    // Verify exam belongs to user
    if (exam.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (answers.length !== exam.questions.length) {
      return res.status(400).json({ error: 'Invalid number of answers' });
    }

    // Calculate score - FIXED LOGIC
    let score = 0;
    const processedAnswers = [];
    
    answers.forEach((answer, index) => {
      const userAnswer = answer.answer;
      const correctAnswer = exam.questions[index]?.correctAnswer;
      
      // Only count as correct if user actually answered (not null/undefined) AND answer matches
      if (userAnswer !== null && userAnswer !== undefined && 
          typeof userAnswer === 'boolean' && userAnswer === correctAnswer) {
        score++;
      }
      
      processedAnswers.push({
        questionIndex: index,
        answer: userAnswer !== null && userAnswer !== undefined ? userAnswer : false,
        wasAnswered: userAnswer !== null && userAnswer !== undefined
      });
    });

    const passed = score >= exam.passingScore;

    // Mark exam as completed
    exam.isCompleted = true;
    await exam.save();

    // Create exam attempt record
    const attempt = new ExamAttempt({
      userId: req.user._id,
      examId: examId,
      answers: answers, // Keep original format for compatibility
      score: score,
      passed: passed,
      timeSpent: timeSpent || 0
    });

    await attempt.save();

    res.status(201).json({
      ...attempt.toObject(),
      message: passed ? 'Čestitamo! Uspješno ste položili ispit.' : 'Nažalost, niste položili ispit. Pokušajte ponovo.'
    });
  } catch (error) {
    console.error('Submit exam error:', error);
    res.status(500).json({ error: 'Failed to submit exam' });
  }
});

// QUESTION BANK MANAGEMENT (Admin only)

// GET - Get all questions in bank (Admin only)
router.get('/questions', async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const questions = await QuestionBank.find().sort({ category: 1, createdAt: -1 });
    res.json(questions);
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// POST - Add question to bank (Admin only)
router.post('/questions', async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const { questionText, correctAnswer, category } = req.body;

    if (!questionText || typeof correctAnswer !== 'boolean') {
      return res.status(400).json({ error: 'Question text and correct answer (true/false) are required' });
    }

    const question = new QuestionBank({
      questionText,
      correctAnswer,
      category: category || 'General'
    });

    await question.save();
    res.status(201).json(question);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Question already exists' });
    }
    console.error('Create question error:', error);
    res.status(500).json({ error: 'Failed to create question' });
  }
});

// PUT - Update question in bank (Admin only)
router.put('/questions/:id', async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const question = await QuestionBank.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const { questionText, correctAnswer, category, isActive } = req.body;

    if (questionText) question.questionText = questionText;
    if (typeof correctAnswer === 'boolean') question.correctAnswer = correctAnswer;
    if (category) question.category = category;
    if (typeof isActive === 'boolean') question.isActive = isActive;

    const updatedQuestion = await question.save();
    res.json(updatedQuestion);
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({ error: 'Failed to update question' });
  }
});

// DELETE - Delete question from bank (Admin only)
router.delete('/questions/:id', async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const question = await QuestionBank.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    await QuestionBank.deleteOne({ _id: req.params.id });
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// ADMIN ROUTES

// GET - Get all exam attempts (Admin only)
router.get('/attempts/all', async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const attempts = await ExamAttempt.find()
      .populate('userId', 'name surname username role')
      .populate('examId', 'title')
      .sort({ completedAt: -1 });

    res.json(attempts);
  } catch (error) {
    console.error('Get all exam attempts error:', error);
    res.status(500).json({ error: 'Failed to fetch exam attempts' });
  }
});

// GET - Get question bank statistics (Admin only)
router.get('/stats', async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const totalQuestions = await QuestionBank.countDocuments();
    const activeQuestions = await QuestionBank.countDocuments({ isActive: true });
    const totalAttempts = await ExamAttempt.countDocuments();
    const passedAttempts = await ExamAttempt.countDocuments({ passed: true });

    res.json({
      totalQuestions,
      activeQuestions,
      totalAttempts,
      passedAttempts,
      passRate: totalAttempts > 0 ? ((passedAttempts / totalAttempts) * 100).toFixed(1) : 0
    });
  } catch (error) {
    console.error('Get exam stats error:', error);
    res.status(500).json({ error: 'Failed to fetch exam statistics' });
  }
});

module.exports = router;