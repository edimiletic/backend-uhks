const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { healthStatus } = require('../utils/health');

describe('health', () => {
  it('ok samo kad je Mongo connected (readyState 1)', () => {
    assert.deepEqual(healthStatus({ readyState: 1 }), { ok: true });
    assert.deepEqual(healthStatus({ readyState: 0 }), { ok: false });
    assert.deepEqual(healthStatus({ readyState: 2 }), { ok: false });
  });
});
