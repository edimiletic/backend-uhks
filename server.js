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
const { assertProductionEnv } = require('./utils/productionEnv');
const { parseAllowedOrigins, rejectDisallowedOrigin } = require('./utils/corsAllowlist');
const { requestLogger, errorHandler } = require('./utils/requestLog');

const app = express();
configureTrustProxy(app);
configureSecurityHeaders(app);
app.use(requestLogger);

const allowedOrigins = parseAllowedOrigins();
app.use(rejectDisallowedOrigin(allowedOrigins));
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)),
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

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

const start = async () => {
  assertProductionEnv();
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
