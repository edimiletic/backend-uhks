const crypto = require('crypto');
const {
  parseCookies,
  sessionCookieOptions,
  SESSION_MAX_AGE_MS
} = require('./sessionCookie');

const CSRF_COOKIE = 'uhks_csrf';
const CSRF_HEADER = 'x-csrf-token';
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SKIP_PATHS = new Set(['/api/login', '/api/reset-password']);

const requestPath = (req) => String(req.originalUrl || req.url || '').split('?')[0];

const readCsrfCookie = (req) => parseCookies(req.headers && req.headers.cookie)[CSRF_COOKIE] || '';

const tokensMatch = (left, right) => {
  if (!left || !right) {
    return false;
  }
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
};

const setCsrfCookie = (res, token) => {
  res.cookie(CSRF_COOKIE, token, sessionCookieOptions({ httpOnly: true, maxAge: SESSION_MAX_AGE_MS }));
  res.setHeader('X-CSRF-Token', token);
  return token;
};

const ensureCsrf = (req, res) => {
  const existing = readCsrfCookie(req);
  if (existing) {
    res.setHeader('X-CSRF-Token', existing);
    return existing;
  }
  return setCsrfCookie(res, crypto.randomBytes(32).toString('hex'));
};

const clearCsrfCookie = (res) => {
  res.cookie(CSRF_COOKIE, '', sessionCookieOptions({ httpOnly: true, maxAge: 0 }));
};

const csrfProtection = (req, res, next) => {
  if (!MUTATING.has(req.method) || SKIP_PATHS.has(requestPath(req))) {
    return next();
  }
  const cookies = parseCookies(req.headers && req.headers.cookie);
  if (!cookies.uhks_session) {
    return next();
  }
  const header = req.headers[CSRF_HEADER];
  if (!tokensMatch(cookies[CSRF_COOKIE], header)) {
    return res.status(403).json({ error: 'Nevažeći CSRF token.' });
  }
  return next();
};

module.exports = {
  CSRF_COOKIE,
  CSRF_HEADER,
  ensureCsrf,
  clearCsrfCookie,
  csrfProtection
};
