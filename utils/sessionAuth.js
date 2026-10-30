const jwt = require('jsonwebtoken');
const JWT_SECRET = require('../config/jwt');
const { normalizeRoleAssignments, pickPrimaryRole } = require('../config/roles');

const sessionVersion = (user) => Number(user?.tokenVersion) || 0;

const tokenVersionMatches = (decoded, user) =>
  sessionVersion(user) === (Number(decoded?.v) || 0);

const signSession = (user) =>
  jwt.sign(
    {
      id: user._id,
      username: user.username,
      role: pickPrimaryRole(normalizeRoleAssignments(user)),
      v: sessionVersion(user)
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

module.exports = { sessionVersion, tokenVersionMatches, signSession };
