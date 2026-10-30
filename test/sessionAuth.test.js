const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const JWT_SECRET = require('../config/jwt');
const { tokenVersionMatches, signSession, sessionVersion } = require('../utils/sessionAuth');

describe('sessionAuth', () => {
  it('stari JWT bez v prolazi dok je tokenVersion 0', () => {
    assert.equal(tokenVersionMatches({ id: '1' }, { tokenVersion: 0 }), true);
    assert.equal(tokenVersionMatches({ id: '1', v: 0 }, { tokenVersion: 2 }), false);
    assert.equal(sessionVersion({}), 0);
  });

  it('signSession stavlja v u token', () => {
    const token = signSession({
      _id: '507f1f77bcf86cd799439011',
      username: 'admin',
      roles: [{ name: 'Admin', competitions: [] }],
      tokenVersion: 3
    });
    const decoded = jwt.verify(token, JWT_SECRET);
    assert.equal(decoded.v, 3);
    assert.equal(decoded.username, 'admin');
  });
});
