const { userHasAnyRole } = require('../config/roles');

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: User not authenticated' });
    }

    if (!userHasAnyRole(req.user, allowedRoles)) {
      return res.status(403).json({
        error: `Forbidden: Access denied. Required roles: ${allowedRoles.join(', ')}.`
      });
    }

    next();
  };
};

module.exports = { requireRole };
