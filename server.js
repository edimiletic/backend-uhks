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
const { configureTrustProxy } = require('./utils/trustProxy');
const { configureSecurityHeaders } = require('./utils/securityHeaders');
const { sendHealth } = require('./utils/health');

const app = express();
configureTrustProxy(app);
configureSecurityHeaders(app);

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:4200,http://127.0.0.1:4200')
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

app.get('/', (req, res) => {
  res.send('🌍 API is running...');
});

app.get('/health', sendHealth);

app.use('/api', authRoutes); // <-- route prefix
app.use('/api/absence', absenceRoutes)
app.use('/api/travel-expense', travelExpenseRoutes)
app.use('/api/basketball-games', basketballGameRoutes);
app.use('/api/users', userRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/notifications', notificationRoutes)
app.use('/api/catalog', catalogRoutes);


const PORT = process.env.PORT || 3000;

const start = async () => {
  await connectDB();
  await seedCatalog();
  await seedDisplayIds();
  startNominationExpiryJob();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    const { isMailConfigured } = require('./utils/mailer');
    console.log(isMailConfigured()
      ? `📧 SMTP spreman (${process.env.SMTP_HOST})`
      : '📧 SMTP nije konfiguriran — mailovi se ne šalju');
  });
};

start().catch((error) => {
  console.error('Startup error:', error.message);
  process.exit(1);
});
