const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const parseAllowedOrigins = (env = process.env) =>
  String(env.CORS_ORIGIN || 'http://localhost:4200,http://127.0.0.1:4200')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const originFromReferer = (referer) => {
  try {
    return new URL(referer).origin;
  } catch {
    return '';
  }
};

const rejectDisallowedOrigin = (allowedOrigins) => (req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    if (!allowedOrigins.includes(origin)) {
      return res.status(403).json({ error: 'Not allowed by CORS' });
    }
    return next();
  }

  if (MUTATING.has(req.method) && req.headers.cookie) {
    const referer = req.headers.referer || req.headers.referrer;
    const refOrigin = originFromReferer(referer);
    if (!refOrigin || !allowedOrigins.includes(refOrigin)) {
      return res.status(403).json({ error: 'Not allowed by CORS' });
    }
  }

  next();
};

module.exports = { parseAllowedOrigins, rejectDisallowedOrigin, originFromReferer };
