const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  COOKIE_NAME,
  cookieSecure,
  cookieSameSite,
  sessionCookieOptions,
  setSessionCookie,
  clearSessionCookie,
  readSessionToken
} = require('../utils/sessionCookie');

describe('sessionCookie', () => {
  const previous = {};

  beforeEach(() => {
    ['NODE_ENV', 'COOKIE_SECURE', 'COOKIE_SAMESITE'].forEach((key) => {
      previous[key] = process.env[key];
    });
  });

  afterEach(() => {
    ['NODE_ENV', 'COOKIE_SECURE', 'COOKIE_SAMESITE'].forEach((key) => {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    });
  });

  it('lokalno koristi SameSite=Lax bez Secure', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.COOKIE_SECURE;
    delete process.env.COOKIE_SAMESITE;
    const options = sessionCookieOptions();
    assert.equal(options.httpOnly, true);
    assert.equal(options.secure, false);
    assert.equal(options.sameSite, 'lax');
    assert.equal(options.path, '/');
  });

  it('u produkciji koristi SameSite=None i Secure', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.COOKIE_SECURE;
    delete process.env.COOKIE_SAMESITE;
    assert.equal(cookieSecure(), true);
    assert.equal(cookieSameSite(), 'none');
  });

  it('COOKIE_SECURE i COOKIE_SAMESITE prepisuju default', () => {
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_SECURE = 'false';
    process.env.COOKIE_SAMESITE = 'lax';
    assert.equal(cookieSecure(), false);
    assert.equal(cookieSameSite(), 'lax');
  });

  it('čita Bearer token prije kolačića', () => {
    const token = readSessionToken({
      headers: {
        authorization: 'Bearer from-header',
        cookie: `${COOKIE_NAME}=from-cookie`
      }
    });
    assert.equal(token, 'from-header');
  });

  it('čita httpOnly kolačić kad nema Bearera', () => {
    const token = readSessionToken({
      headers: {
        cookie: `other=1; ${COOKIE_NAME}=jwt.token.value; keep=yes`
      }
    });
    assert.equal(token, 'jwt.token.value');
  });

  it('vraća null kad nema sesije', () => {
    assert.equal(readSessionToken({ headers: {} }), null);
  });

  it('postavlja i briše kolačić na response', () => {
    const calls = [];
    const res = {
      cookie(name, value, options) {
        calls.push({ name, value, options });
      }
    };
    setSessionCookie(res, 'jwt-value');
    clearSessionCookie(res);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].name, COOKIE_NAME);
    assert.equal(calls[0].value, 'jwt-value');
    assert.equal(calls[0].options.httpOnly, true);
    assert.equal(calls[1].value, '');
    assert.equal(calls[1].options.maxAge, 0);
  });
});
