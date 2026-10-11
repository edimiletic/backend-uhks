const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  ALL_COMPETITIONS,
  canonicalCompetition,
  cannotNominateSelf,
  getManagedCompetitions,
  incompatibleRolesMessage,
  isAdminUser,
  isKontrolorRequired,
  isWithinNominationCap,
  normalizeRoleAssignments,
  pickPrimaryRole,
  userHasRole
} = require('../config/roles');

const user = (...roles) => ({
  _id: 'u1',
  roles: roles.map((role) =>
    typeof role === 'string' ? { name: role, competitions: [] } : role
  )
});

describe('roles', () => {
  it('prepoznaje Admina iz roles[] i kad je primary role Sudac', () => {
    const dual = {
      role: 'Sudac',
      roles: [
        { name: 'Sudac', competitions: [] },
        { name: 'Admin', competitions: [] }
      ]
    };
    assert.equal(isAdminUser(dual), true);
    assert.equal(pickPrimaryRole(normalizeRoleAssignments(dual)), 'Admin');
    assert.equal(userHasRole(dual, 'Sudac'), true);
  });

  it('zabranjuje nespojive uloge', () => {
    assert.match(incompatibleRolesMessage(['Sudac', 'Delegat']), /Sudac/);
    assert.match(incompatibleRolesMessage(['Sudac', 'Povjerenik natjecanja']), /Povjerenik natjecanja/);
    assert.equal(incompatibleRolesMessage(['Sudac', 'Povjerenik za službene osobe']), null);
  });

  it('prazan popis natjecanja povjerenika znači sva natjecanja', () => {
    const commissioner = user({
      name: 'Povjerenik natjecanja',
      competitions: []
    });
    assert.equal(getManagedCompetitions(commissioner), null);
  });

  it('povjereniku s konkretnim ligama vraća samo te lige', () => {
    const commissioner = user({
      name: 'Povjerenik za službene osobe',
      competitions: ['PRVA MUŠKA LIGA']
    });
    assert.deepEqual(getManagedCompetitions(commissioner), ['PRVA MUŠKA LIGA']);
  });

  it('mapira staro ime FAVBET lige', () => {
    assert.equal(canonicalCompetition('FAVBET PREMIJER LIGA'), 'SuperSport Premijer liga');
  });

  it('zahtijeva kontrolora na SuperSportu, a na Ćosiću samo ako su oba kluba Premijer', () => {
    assert.equal(isKontrolorRequired('SuperSport Premijer liga'), true);
    assert.equal(
      isKontrolorRequired('KUP «K. ĆOSIĆ»', ['SuperSport Premijer liga'], ['SuperSport Premijer liga']),
      true
    );
    assert.equal(
      isKontrolorRequired('KUP «K. ĆOSIĆ»', ['PRVA MUŠKA LIGA'], ['SuperSport Premijer liga']),
      false
    );
    assert.equal(isKontrolorRequired('PRVA MUŠKA LIGA'), false);
  });

  it('ne pušta suca iznad njegove najviše lige', () => {
    const sudac = { najvisaLiga: 'PRVA MUŠKA LIGA' };
    assert.equal(isWithinNominationCap(sudac, 'PRVA MUŠKA LIGA', 'Sudac'), true);
    assert.equal(isWithinNominationCap(sudac, 'SuperSport Premijer liga', 'Sudac'), false);
  });

  it('admin smije nominirati sam sebe, ostali ne', () => {
    assert.equal(cannotNominateSelf({ _id: 'a1', roles: [{ name: 'Admin', competitions: [] }] }, 'a1'), false);
    assert.equal(cannotNominateSelf({ _id: 's1', roles: [{ name: 'Sudac', competitions: [] }] }, 's1'), true);
  });

  it('katalog liga postoji', () => {
    assert.ok(ALL_COMPETITIONS.includes('SuperSport Premijer liga'));
    assert.ok(ALL_COMPETITIONS.includes('PRVA MUŠKA LIGA'));
  });
});
