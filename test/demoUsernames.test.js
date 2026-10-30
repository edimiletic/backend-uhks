const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { DEMO_USERNAMES, isDemoUsername } = require('../utils/demoUsernames');

describe('demoUsernames', () => {
  it('ima seed suca i ne tretira admina kao demo', () => {
    assert.ok(DEMO_USERNAMES.includes('sudac1'));
    assert.ok(DEMO_USERNAMES.includes('kontrolor3'));
    assert.equal(isDemoUsername('sudac1'), true);
    assert.equal(isDemoUsername('admin_user'), false);
  });
});
