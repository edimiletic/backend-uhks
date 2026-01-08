// backend/server.js
const express = require('express');
const cors = require('cors');
const connectDB = require('./db');
const authRoutes = require('./routes/auth'); // <-- import route
const absenceRoutes = require('./routes/absence')
const travelExpenseRoutes = require('./routes/travelExpense')
const basketballGameRoutes = require('./routes/basketballGames');
const userRoutes = require('./routes/users');
const examRoutes = require ('./routes/exams')
const notificationRoutes = require('./routes/notification')
const kontrolaRoutes = require('./routes/kontrola');


require('dotenv').config(); // Make sure this is at the top

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
connectDB();

// Routes
app.get('/', (req, res) => {
  res.send('🌍 API is running...');
});

app.use('/api', authRoutes); // <-- route prefix
app.use('/api/absence', absenceRoutes)
app.use('/api/travel-expense', travelExpenseRoutes)
app.use('/api/basketball-games', basketballGameRoutes);
app.use('/api/users', userRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/notifications', notificationRoutes)
app.use('/api/kontrola', kontrolaRoutes);


// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
