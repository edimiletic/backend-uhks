const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  hashToken,
  resetUrlForToken,
  passwordPolicyError,
  frontendBaseUrl
} = require('../utils/passwordReset');

describe('passwordReset', () => {
  it('hashira token uvijek isto i različito za drugi ulaz', () => {
    const a = hashToken('abc');
    assert.equal(a, hashToken('abc'));
    assert.notEqual(a, hashToken('abd'));
    assert.equal(a.length, 64);
  });

  it('odbija kratku lozinku', () => {
    assert.match(passwordPolicyError(''), /8/);
    assert.match(passwordPolicyError('1234567'), /8/);
    assert.equal(passwordPolicyError('12345678'), null);
  });

  it('sastavlja frontend URL za set-password', () => {
    const previous = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = 'https://app.example/';
    assert.equal(frontendBaseUrl(), 'https://app.example');
    assert.equal(
      resetUrlForToken('tok-1'),
      'https://app.example/set-password?token=tok-1'
    );
    if (previous === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = previous;
    }
  });
});
