const jwt = require('jsonwebtoken');
const User = require('../models/User');
const JWT_SECRET = require('../config/jwt');
const { readSessionToken } = require('../utils/sessionCookie');
const { tokenVersionMatches } = require('../utils/sessionAuth');

const authenticateUser = async (req, res, next) => {
  const token = readSessionToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!tokenVersionMatches(decoded, user)) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  } catch (_err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

module.exports = authenticateUser;