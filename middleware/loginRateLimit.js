const { rateLimit, ipKeyGenerator, MemoryStore } = require('express-rate-limit');

const LOGIN_TOO_MANY = 'Previše neuspjelih prijava. Pokušaj ponovo za 15 minuta.';
const WINDOW_MS = 15 * 60 * 1000;
const IP_MAX = 20;
const USERNAME_MAX = 5;

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function ipKey(req) {
  return ipKeyGenerator(req.ip || '127.0.0.1');
}

function usernameKey(req) {
  return `user:${normalizeUsername(req.body && req.body.username)}`;
}

function createLoginRateLimiters(options = {}) {
  const windowMs = options.windowMs ?? WINDOW_MS;
  const ipStore = options.ipStore || new MemoryStore();
  const usernameStore = options.usernameStore || new MemoryStore();

  const shared = {
    windowMs,
    skipSuccessfulRequests: true,
    requestWasSuccessful: (_req, res) => res.statusCode < 400 || res.statusCode >= 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: LOGIN_TOO_MANY },
    statusCode: 429
  };
  if (options.validate !== undefined) {
    shared.validate = options.validate;
  }

  const ipLimiter = rateLimit({
    ...shared,
    limit: options.ipMax ?? IP_MAX,
    store: ipStore,
    keyGenerator: ipKey,
    requestPropertyName: 'loginRateIp'
  });

  const usernameLimiter = rateLimit({
    ...shared,
    limit: options.usernameMax ?? USERNAME_MAX,
    store: usernameStore,
    skip: (req) => !normalizeUsername(req.body && req.body.username),
    keyGenerator: usernameKey,
    requestPropertyName: 'loginRateUser',
    validate: options.validate === false
      ? false
      : { ...(options.validate || {}), keyGeneratorIpFallback: false }
  });

  return { ipLimiter, usernameLimiter };
}

const { ipLimiter, usernameLimiter } = createLoginRateLimiters();

module.exports = {
  LOGIN_TOO_MANY,
  WINDOW_MS,
  IP_MAX,
  USERNAME_MAX,
  createLoginRateLimiters,
  ipLimiter,
  usernameLimiter
};
