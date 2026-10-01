require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  console.warn('⚠️ JWT_SECRET is not set. Using a local development fallback. Set JWT_SECRET in .env before deploying.');
}

module.exports = JWT_SECRET || 'dev-only-insecure-secret';
