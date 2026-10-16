// backend/routes/auth.js - Enhanced version
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const rateLimit = require('express-rate-limit');
const { normalizeRoleAssignments, pickPrimaryRole } = require('../config/roles');
const { ipLimiter, usernameLimiter } = require('../middleware/loginRateLimit');
const noStore = require('../middleware/noStore');

const JWT_SECRET = require('../config/jwt');
const { setSessionCookie, clearSessionCookie } = require('../utils/sessionCookie');

const INVALID_LOGIN = 'Neispravno korisničko ime ili lozinka';

router.post('/login', noStore, ipLimiter, usernameLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Unesi korisničko ime i lozinku.' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: INVALID_LOGIN });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: INVALID_LOGIN });
    }

    // Create token with longer expiry and user info
    const token = jwt.sign(
      { 
        id: user._id,
        username: user.username,
        role: pickPrimaryRole(normalizeRoleAssignments(user))
      }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );

    const publicUser = user.toObject();
    delete publicUser.password;

    setSessionCookie(res, token);

    res.json({
      user: {
        ...publicUser,
        _id: user._id,
        id: user._id
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Greška poslužitelja.' });
  }
});

const authenticateUser = require('../middleware/authMiddleware');

router.post('/logout', noStore, (_req, res) => {
  clearSessionCookie(res);
  res.json({ message: 'Logged out' });
});

const {
  hashToken,
  passwordPolicyError,
  clearPasswordReset
} = require('../utils/passwordReset');

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Previše pokušaja. Pokušaj kasnije.' },
  standardHeaders: true,
  legacyHeaders: false
});

const INVALID_RESET = 'Link nije važeći ili je istekao.';

router.post('/reset-password', resetLimiter, async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) {
    return res.status(400).json({ error: 'Nedostaje token ili lozinka.' });
  }

  const policyError = passwordPolicyError(password);
  if (policyError) {
    return res.status(400).json({ error: policyError });
  }

  try {
    const user = await User.findOne({ passwordResetTokenHash: hashToken(token) });
    if (!user || !user.passwordResetExpires || user.passwordResetExpires.getTime() < Date.now()) {
      return res.status(400).json({ error: INVALID_RESET });
    }

    user.password = await bcrypt.hash(password, 10);
    clearPasswordReset(user);
    await user.save();
    return res.json({ message: 'Lozinka je postavljena. Možeš se prijaviti.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/change-password', authenticateUser, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Unesi trenutnu i novu lozinku.' });
  }

  const policyError = passwordPolicyError(newPassword);
  if (policyError) {
    return res.status(400).json({ error: policyError });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(400).json({ error: 'Trenutna lozinka nije točna.' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    clearPasswordReset(user);
    await user.save();
    return res.json({ message: 'Lozinka je promijenjena.' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Get current logged-in user
router.get('/me', noStore, authenticateUser, (req, res) => {
  res.json(req.user); // user is attached by middleware
});


module.exports = router;
