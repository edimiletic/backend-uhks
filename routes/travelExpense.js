// backend/routes/travelExpense.js
const express = require('express');
const router = express.Router();
const TravelExpense = require('../models/TravelExpense');
const User = require('../models/User');
const authenticateUser = require('../middleware/authMiddleware');
const {requireRole} = require('../middleware/roleMiddleware')

// Apply authentication middleware to all routes
router.use(authenticateUser);
router.use(requireRole(['Admin']))

// CREATE - Create a new travel expense report (Admin only)
router.post('/', async (req, res) => {
  try {
    const { type, season, year, month, userId } = req.body;

    // Validate required fields
    if (!type || !season || !year || !month) {
      return res.status(400).json({ 
        error: 'Missing required fields: type, season, year, month' 
      });
    }

    // Determine which user the report is for
    // Admin can create for any user via userId, otherwise create for self
    const targetUserId = userId || req.user._id;

    // If admin is creating for someone else, validate the user exists
    if (userId && userId !== req.user._id.toString()) {
      const targetUser = await User.findById(userId);
      if (!targetUser) {
        return res.status(404).json({ error: 'Target user not found' });
      }
    }

    // Check if user already has a report for this type, year, and month
    const existingReport = await TravelExpense.findOne({
      userId: targetUserId,
      type,
      year,
      month
    });

    if (existingReport) {
      return res.status(400).json({ 
        error: 'A report already exists for this user, type, year, and month' 
      });
    }

    const travelExpense = new TravelExpense({
      type,
      season,
      year,
      month,
      userId: targetUserId,
      state: 'Skica'
    });

    const savedExpense = await travelExpense.save();
    
    // Populate user information
    await savedExpense.populate('userId', 'name surname');

    res.status(201).json(savedExpense);
  } catch (error) {
    console.error('Create travel expense error:', error);
    res.status(500).json({ error: 'Failed to create travel expense report' });
  }
});

// READ - Get all travel expenses for current user
router.get('/my', async (req, res) => {
  try {
    const expenses = await TravelExpense.find({ userId: req.user._id })
      .populate('userId', 'name surname')
      .populate('reviewedBy', 'name surname')
      .sort({ createdAt: -1 });

    res.json(expenses);
  } catch (error) {
    console.error('Get user travel expenses error:', error);
    res.status(500).json({ error: 'Failed to fetch travel expenses' });
  }
});

// READ - Get all travel expenses (admin/manager functionality)
router.get('/', async (req, res) => {
  try {
    // Extract filter parameters from query string
    const { id, type, userName, year, month, state } = req.query;
    
    // Build filter object
    let filter = {};
    
    if (id) filter._id = id;
    if (type) filter.type = new RegExp(type, 'i'); // Case insensitive search
    if (year) filter.year = parseInt(year);
    if (month) filter.month = month;
    if (state) filter.state = new RegExp(state, 'i');

    // Get all expenses with optional filtering
    let query = TravelExpense.find(filter)
      .populate('userId', 'name surname')
      .populate('reviewedBy', 'name surname')
      .sort({ createdAt: -1 });

    const expenses = await query.exec();

    // If userName filter is provided, filter after population
    let filteredExpenses = expenses;
    if (userName) {
      filteredExpenses = expenses.filter(expense => {
        const fullName = `${expense.userId.name} ${expense.userId.surname}`;
        return fullName.toLowerCase().includes(userName.toLowerCase());
      });
    }

    res.json(filteredExpenses);
  } catch (error) {
    console.error('Get all travel expenses error:', error);
    res.status(500).json({ error: 'Failed to fetch travel expenses' });
  }
});

// READ - Get travel expense by ID
// READ - Get travel expense by ID
router.get('/:id', async (req, res) => {
  try {
    const expense = await TravelExpense.findById(req.params.id)
      .populate('userId', 'name surname')
      .populate('reviewedBy', 'name surname');

    if (!expense) {
      return res.status(404).json({ error: 'Travel expense not found' });
    }

    // UPDATED: Check if user owns this expense or is admin/manager (case-insensitive)
    const userRole = req.user.role.toLowerCase(); // Convert to lowercase for comparison
    if (expense.userId._id.toString() !== req.user._id.toString() && 
        !['admin', 'manager'].includes(userRole)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(expense);
  } catch (error) {
    console.error('Get travel expense by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch travel expense' });
  }
});

// Replace the duplicate PUT routes in your routes/travelExpense.js with this single, complete route:

// UPDATE - Update an existing travel expense
router.put('/:id', async (req, res) => {
  try {
    console.log('PUT route hit with data:', req.body); // Debug log
    console.log('User role:', req.user.role); // Debug log
    
    const expense = await TravelExpense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ error: 'Travel expense not found' });
    }

    console.log('Expense found:', expense.id, 'Current state:', expense.state); // Debug log

    // UPDATED: Check if user owns this expense or is admin/manager (case-insensitive)
    const userRole = req.user.role.toLowerCase(); // Convert to lowercase for comparison
    if (expense.userId.toString() !== req.user._id.toString() && 
        !['admin', 'manager'].includes(userRole)) {
      console.log('Access denied - not owner and not admin/manager'); // Debug log
      return res.status(403).json({ error: 'Access denied' });
    }

    // Don't allow updates if already approved (unless admin)
    if (expense.state === 'Potvrđeno' && userRole !== 'admin') {
      console.log('Cannot modify approved report - user is not admin'); // Debug log
      return res.status(400).json({ error: 'Cannot modify approved expense report' });
    }

    const { type, season, year, month, state, expenses, reviewComments } = req.body;

    console.log('Updating fields:', { type, season, year, month, state, reviewComments }); // Debug log

    // Update fields
    if (type) expense.type = type;
    if (season) expense.season = season;
    if (year) expense.year = year;
    if (month) expense.month = month;
    if (expenses) expense.expenses = expenses;
    if (reviewComments !== undefined) expense.reviewComments = reviewComments;

    // Handle state changes
    if (state && state !== expense.state) {
      console.log('State changing from', expense.state, 'to', state); // Debug log
      expense.state = state;
      
      if (state === 'Predano') {
        expense.submittedAt = new Date();
        console.log('Set submittedAt for Predano state'); // Debug log
      } 
      // else if (['Potvrđeno', 'Odbijeno'].includes(state)) {
      //   expense.reviewedAt = new Date();
      //   expense.reviewedBy = req.user._id;
      //   console.log('Set reviewedAt and reviewedBy for', state, 'state'); // Debug log
      // }
    }

    const updatedExpense = await expense.save();
    
    await updatedExpense.populate('userId', 'name surname');
    await updatedExpense.populate('reviewedBy', 'name surname');

    console.log('Sending response with updated expense'); // Debug log
    res.json(updatedExpense);
  } catch (error) {
    console.error('Update travel expense error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    if (error.errors) {
      console.error('Validation errors:', error.errors);
    }
    res.status(500).json({ error: 'Failed to update travel expense' });
  }
});
// DELETE - Delete a travel expense
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const expense = await TravelExpense.findById(id);
    if (!expense) {
      return res.status(404).json({ error: 'Travel expense not found' });
    }

    // Check if user owns this expense or is admin
    if (expense.userId.toString() !== req.user._id.toString() && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Role-based access control for deletion
    // Only allow deletion if:
    // 1. Report is in 'Skica' state, OR
    // 2. User has 'Admin' role
    if (['Predano'].includes(expense.state) && req.user.role !== 'Admin') {
      return res.status(400).json({ 
        error: 'Cannot delete submitted, approved, or rejected reports. Only Admin can perform this action.' 
      });
    }

    await TravelExpense.findByIdAndDelete(id);

    res.json({ message: 'Travel expense deleted successfully' });

  } catch (error) {
    console.error('Error deleting travel expense:', error);
    res.status(500).json({ error: 'Server error while deleting travel expense' });
  }
});

// PATCH - Add expense item to a travel expense report
router.patch('/:id/expenses', async (req, res) => {
  try {
    console.log('Received expense item data:', req.body); // Debug log

    const expense = await TravelExpense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ error: 'Travel expense not found' });
    }
    const userRole = req.user.role.toLowerCase();
    // Check if user owns this expense
    if (expense.userId.toString() !== req.user._id.toString() && userRole !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Role-based access control for adding expense items
    // Only allow adding items if:
    // 1. Report is in 'Skica' state, OR
    // 2. User has 'Admin' role
    if (['Predano'].includes(expense.state) && req.user.role !== 'Admin') {
      return res.status(400).json({ 
        error: 'Cannot add expense items to submitted, approved, or rejected reports. Only Admin can perform this action.' 
      });
    }

    // Updated field validation for new model structure
    const { type, date, description, unit, quantity, unitPrice, competition, amount } = req.body;

    console.log('Extracted fields:', { type, date, description, unit, quantity, unitPrice, competition, amount }); // Debug log

    if (!type || !date || !description || !unit || quantity === undefined || unitPrice === undefined || !competition) {
      return res.status(400).json({ 
        error: 'Missing required expense fields: type, date, description, unit, quantity, unitPrice, competition' 
      });
    }

    // Validate quantity and unitPrice are positive numbers
    if (quantity <= 0 || unitPrice <= 0) {
      return res.status(400).json({ 
        error: 'Quantity and unit price must be positive numbers' 
      });
    }

    // Create the expense item object
    const expenseItem = {
      type,
      date: new Date(date), // Ensure proper date conversion
      description,
      unit,
      quantity: Number(quantity), // Ensure it's a number
      unitPrice: Number(unitPrice), // Ensure it's a number
      competition,
      amount: Number(quantity) * Number(unitPrice) // Calculate amount server-side
    };

    console.log('Created expense item:', expenseItem); // Debug log

    // Add the expense item
    expense.expenses.push(expenseItem);

    console.log('Before save - expense.expenses:', expense.expenses); // Debug log

    const updatedExpense = await expense.save();
    
    console.log('Successfully saved expense'); // Debug log
    
    await updatedExpense.populate('userId', 'name surname');

    res.json(updatedExpense);
  } catch (error) {
    console.error('Add expense item error details:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    if (error.errors) {
      console.error('Validation errors:', error.errors);
    }
    
    // Return more specific error information
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validationErrors 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to add expense item',
      details: error.message 
    });
  }
});

// PATCH - Submit travel expense report (change state from 'Skica' to 'Predano')
router.patch('/:id/submit', async (req, res) => {
  try {
    const expense = await TravelExpense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ error: 'Travel expense not found' });
    }

    // Check if user owns this expense
    if (expense.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate current state - can only submit drafts
    if (expense.state !== 'Skica') {
      return res.status(400).json({ 
        error: `Cannot submit ${expense.state.toLowerCase()} expense report. Only drafts can be submitted.` 
      });
    }

    // Validate that report has expense items
    if (!expense.expenses || expense.expenses.length === 0) {
      return res.status(400).json({ 
        error: 'Cannot submit expense report without expense items' 
      });
    }

    // Update state to 'Predano'
    expense.state = 'Predano';
    // The submittedAt timestamp will be set automatically by the pre-save middleware

    const updatedExpense = await expense.save();
    await updatedExpense.populate('userId', 'name surname');
    await updatedExpense.populate('reviewedBy', 'name surname');

    res.json(updatedExpense);
  } catch (error) {
    console.error('Submit travel expense error:', error);
    res.status(500).json({ 
      error: 'Failed to submit travel expense report',
      details: error.message 
    });
  }
});

// DELETE - Remove expense item from a travel expense report
router.delete('/:id/expenses/:expenseId', async (req, res) => {
  try {
    const expense = await TravelExpense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ error: 'Travel expense not found' });
    }

    // Check if user owns this expense
    if (expense.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Role-based access control for deletion
    // Only allow deletion if:
    // 1. Report is in 'Skica' state, OR
    // 2. User has 'Admin' role
    if (['Predano'].includes(expense.state) && req.user.role !== 'Admin') {
      return res.status(400).json({ 
        error: 'Samo admin može izbrisati predana izvješća' 
      });
    }

    // Find and remove the expense item
    const expenseItem = expense.expenses.id(req.params.expenseId);
    if (!expenseItem) {
      return res.status(404).json({ error: 'Stavka nije pronađena' });
    }

    // Use pull method instead of remove
    expense.expenses.pull({ _id: req.params.expenseId });
    const updatedExpense = await expense.save();
    await updatedExpense.populate('userId', 'name surname');

    res.json(updatedExpense);
  } catch (error) {
    console.error('Remove expense item error:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ error: 'Failed to remove expense item', details: error.message });
  }
});

module.exports = router;