const COOKIE_NAME = 'uhks_session';
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function cookieSecure() {
  if (process.env.COOKIE_SECURE === 'true') {
    return true;
  }
  if (process.env.COOKIE_SECURE === 'false') {
    return false;
  }
  return process.env.NODE_ENV === 'production';
}

function cookieSameSite() {
  const explicit = (process.env.COOKIE_SAMESITE || '').trim().toLowerCase();
  if (explicit === 'lax' || explicit === 'strict' || explicit === 'none') {
    return explicit;
  }
  return cookieSecure() ? 'none' : 'lax';
}

function sessionCookieOptions(overrides = {}) {
  return {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: cookieSameSite(),
    path: '/',
    ...overrides
  };
}

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, sessionCookieOptions({ maxAge: SESSION_MAX_AGE_MS }));
}

function clearSessionCookie(res) {
  res.cookie(COOKIE_NAME, '', sessionCookieOptions({ maxAge: 0 }));
}

function parseCookies(header) {
  const cookies = {};
  if (!header) {
    return cookies;
  }

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const name = part.slice(0, separator).trim();
    let value = part.slice(separator + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1);
    }
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }

  return cookies;
}

function readBearerToken(authorizationHeader) {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authorizationHeader.slice(7).trim();
  return token || null;
}

function readSessionToken(req) {
  const bearer = readBearerToken(req.headers && req.headers.authorization);
  if (bearer) {
    return bearer;
  }
  const cookies = parseCookies(req.headers && req.headers.cookie);
  return cookies[COOKIE_NAME] || null;
}

module.exports = {
  COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  cookieSecure,
  cookieSameSite,
  sessionCookieOptions,
  setSessionCookie,
  clearSessionCookie,
  readSessionToken
};
