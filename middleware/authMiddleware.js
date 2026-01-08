// backend/middleware/authMiddleware.js - Make sure this is correct
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const JWT_SECRET = 'your_jwt_secret';

const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  console.log('Auth header:', authHeader); // Debug log
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Decoded token:', decoded); // Debug log
    
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    req.user = user;
    next();
  } catch (err) {
    console.error('Token error:', err);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

module.exports = authenticateUser;