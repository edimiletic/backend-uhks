const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { scalarString, escapeRegex, containsRegex } = require('../utils/queryScalar');

describe('queryScalar', () => {
  it('odbija query objekte', () => {
    assert.equal(scalarString({ $ne: 'x' }), '');
    assert.equal(scalarString('Cibona'), 'Cibona');
  });

  it('escape-a regex metaznakove', () => {
    assert.equal(escapeRegex('a+b(c)'), 'a\\+b\\(c\\)');
    const re = containsRegex('cib.');
    assert.equal(re.test('cibona'), false);
    assert.equal(re.test('cib.'), true);
  });
});
