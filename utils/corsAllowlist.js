const parseAllowedOrigins = (env = process.env) =>
  String(env.CORS_ORIGIN || 'http://localhost:4200,http://127.0.0.1:4200')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const rejectDisallowedOrigin = (allowedOrigins) => (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: 'Not allowed by CORS' });
  }
  next();
};

module.exports = { parseAllowedOrigins, rejectDisallowedOrigin };
