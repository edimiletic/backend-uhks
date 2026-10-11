const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ALL_COMPETITIONS } = require('../config/roles');
const { buildCoverage, missingCommissionerRoles } = require('../utils/commissionerCoverage');

describe('commissionerCoverage', () => {
  it('prazan competitions[] pokriva sva natjecanja', () => {
    const coverage = buildCoverage([
      {
        _id: 'p1',
        roles: [{ name: 'Povjerenik natjecanja', competitions: [] }]
      }
    ]);
    ALL_COMPETITIONS.forEach((competition) => {
      assert.deepEqual(coverage[competition]['Povjerenik natjecanja'], ['p1']);
    });
  });

  it('konkretna liga pokriva samo tu ligu', () => {
    const coverage = buildCoverage([
      {
        _id: 'p2',
        roles: [{ name: 'Povjerenik za službene osobe', competitions: ['PRVA MUŠKA LIGA'] }]
      }
    ]);
    assert.deepEqual(coverage['PRVA MUŠKA LIGA']['Povjerenik za službene osobe'], ['p2']);
    assert.deepEqual(coverage['SuperSport Premijer liga']['Povjerenik za službene osobe'], []);
  });

  it('prijavljuje natjecanje bez oba povjerenika', () => {
    const coverage = buildCoverage([
      {
        _id: 'p3',
        roles: [{ name: 'Povjerenik natjecanja', competitions: ['PRVA MUŠKA LIGA'] }]
      }
    ]);
    const missing = missingCommissionerRoles(coverage, 'PRVA MUŠKA LIGA');
    assert.deepEqual(missing, ['Povjerenik za službene osobe']);
  });
});
