const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parsePagination, MAX_LIMIT } = require('../utils/pagination');

describe('pagination', () => {
  it('default page 1 i limit 20', () => {
    assert.deepEqual(parsePagination({}), { page: 1, limit: 20, skip: 0 });
  });

  it('absences default limit 10', () => {
    assert.deepEqual(parsePagination({}, { defaultLimit: 10 }), { page: 1, limit: 10, skip: 0 });
  });

  it('reže prevelik limit i page ispod 1', () => {
    assert.deepEqual(parsePagination({ page: '0', limit: '9999' }), {
      page: 1,
      limit: MAX_LIMIT,
      skip: 0
    });
  });

  it('računa skip za valjanu stranicu', () => {
    assert.deepEqual(parsePagination({ page: '3', limit: '20' }), {
      page: 3,
      limit: 20,
      skip: 40
    });
  });

  it('nebrojčani query pada na default', () => {
    assert.deepEqual(parsePagination({ page: 'x', limit: '-5' }), {
      page: 1,
      limit: 20,
      skip: 0
    });
  });
});
