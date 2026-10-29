const WEAK_SECRETS = new Set([
  'change-me',
  'dev-only-insecure-secret',
  'secret',
  'jwt_secret'
]);

const isLocalHost = (hostname) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

const parseHttpUrl = (value) => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const corsOrigins = (env) =>
  String(env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const productionEnvErrors = (env = process.env) => {
  if (env.NODE_ENV !== 'production') {
    return [];
  }

  const errors = [];
  const secret = String(env.JWT_SECRET || '').trim();
  if (!secret || secret.length < 16 || WEAK_SECRETS.has(secret.toLowerCase())) {
    errors.push('JWT_SECRET must be a long random secret, not change-me');
  }

  if (!String(env.MONGO_URI || '').trim()) {
    errors.push('MONGO_URI must be set');
  }

  const origins = corsOrigins(env);
  if (!origins.length) {
    errors.push('CORS_ORIGIN must list the frontend HTTPS origin');
  } else {
    for (const origin of origins) {
      const url = parseHttpUrl(origin);
      if (!url || url.protocol !== 'https:' || isLocalHost(url.hostname) || origin.endsWith('/')) {
        errors.push(`CORS_ORIGIN must be HTTPS without a trailing slash (not localhost): ${origin}`);
      }
    }
  }

  const frontend = String(env.FRONTEND_URL || '').trim();
  const frontendUrl = parseHttpUrl(frontend);
  if (
    !frontendUrl
    || frontendUrl.protocol !== 'https:'
    || isLocalHost(frontendUrl.hostname)
    || frontend.endsWith('/')
  ) {
    errors.push('FRONTEND_URL must be the HTTPS frontend origin, without a trailing slash');
  }

  if (env.COOKIE_SECURE === 'false') {
    errors.push('COOKIE_SECURE must not be false in production');
  }

  const sameSite = String(env.COOKIE_SAMESITE || '').trim().toLowerCase();
  if (sameSite && sameSite !== 'none') {
    errors.push('COOKIE_SAMESITE must be none (or omitted) when frontend and API are on different hosts');
  }

  if (Number(env.SMTP_MIN_INTERVAL_MS || 0) > 0) {
    errors.push('SMTP_MIN_INTERVAL_MS must be 0 or omitted in production (Mailtrap delay)');
  }

  if (String(env.SMTP_HOST || '').trim() && !String(env.MAIL_FROM || '').trim()) {
    errors.push('MAIL_FROM is required when SMTP_HOST is set');
  }

  return errors;
};

const assertProductionEnv = (env = process.env) => {
  const errors = productionEnvErrors(env);
  if (errors.length) {
    throw new Error(`Production environment is incomplete:\n- ${errors.join('\n- ')}`);
  }
};

module.exports = { productionEnvErrors, assertProductionEnv };
