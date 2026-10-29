const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { gamePayloadError } = require('../utils/gamePayload');

const future = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
};

const valid = (overrides = {}) => ({
  homeTeam: 'Cibona',
  awayTeam: 'Zadar',
  date: future(),
  time: '20:00',
  venue: 'Draženov dom',
  competition: 'PRVA MUŠKA LIGA',
  ...overrides
});

describe('gamePayload', () => {
  it('prolazi ispravan create', () => {
    assert.equal(gamePayloadError(valid()), null);
  });

  it('odbija isti klub, krivo vrijeme i ligu van kataloga', () => {
    assert.match(gamePayloadError(valid({ awayTeam: 'cibona' })), /same/);
    assert.match(gamePayloadError(valid({ time: '25:99' })), /time/);
    assert.match(gamePayloadError(valid({ competition: 'JUNIORI' })), /competition/);
  });

  it('FAVBET mapira na SuperSport, juniori na update smiju ostati', () => {
    assert.equal(gamePayloadError(valid({ competition: 'FAVBET PREMIJER LIGA' })), null);
    assert.equal(
      gamePayloadError(valid({ competition: 'JUNIORI' }), { allowLegacyCompetition: true }),
      null
    );
  });

  it('datum u prošlosti samo ako nije dopušten', () => {
    assert.match(gamePayloadError(valid({ date: '2020-01-01' })), /past/);
    assert.equal(gamePayloadError(valid({ date: '2020-01-01' }), { allowPastDate: true }), null);
  });

  it('na update bez svih polja ne traži rest', () => {
    assert.equal(gamePayloadError({ time: '18:30' }, { requireAll: false }), null);
    assert.match(gamePayloadError({ time: 'aa' }, { requireAll: false }), /time/);
  });
});
