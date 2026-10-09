require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./db');
const authRoutes = require('./routes/auth');
const absenceRoutes = require('./routes/absence');
const travelExpenseRoutes = require('./routes/travelExpense');
const basketballGameRoutes = require('./routes/basketballGames');
const userRoutes = require('./routes/users');
const examRoutes = require('./routes/exams');
const notificationRoutes = require('./routes/notification');
const catalogRoutes = require('./routes/catalog');
const seedCatalog = require('./scripts/seedCatalog');
const seedDisplayIds = require('./scripts/seedDisplayIds');
const { startNominationExpiryJob } = require('./utils/nominationExpiry');

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:4200')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser tools (no Origin header) and configured frontends
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());

// Connect to MongoDB and seed club/venue lookup lists
connectDB().then(async () => {
  await seedCatalog();
  await seedDisplayIds();
  startNominationExpiryJob();
}).catch((error) => {
  console.error('❌ Seed error:', error.message);
});

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
app.use('/api/catalog', catalogRoutes);


// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
