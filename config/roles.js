const USER_ROLES = [
  'Admin',
  'Sudac',
  'Delegat',
  'Pomoćni Sudac',
  'Kontrolor',
  'Povjerenik natjecanja',
  'Povjerenik za službene osobe',
  'Povjerenik za pomoćne suce'
];

const GAME_ASSIGNMENT_ROLES = ['Sudac', 'Delegat', 'Pomoćni Sudac', 'Kontrolor'];
const COMMISSIONER_ROLES = [
  'Povjerenik natjecanja',
  'Povjerenik za službene osobe',
  'Povjerenik za pomoćne suce'
];
const OFFICIAL_NOMINATION_ROLES = ['Sudac', 'Delegat', 'Kontrolor'];
const ASSISTANT_NOMINATION_ROLES = ['Pomoćni Sudac'];
const ELIGIBLE_OFFICIAL_ROLES = ['Sudac', 'Delegat', 'Kontrolor'];

const ALL_COMPETITIONS = [
  'SuperSport Premijer liga',
  'PRVA MUŠKA LIGA',
  'PREMIJER ŽENSKA LIGA',
  'KUP «K. ĆOSIĆ»',
  'KUP «R. MEGLAJ-RIMAC»'
];

const TOP_PROFESSIONAL_COMPETITIONS = ALL_COMPETITIONS.slice();

const LEGACY_COMPETITIONS = [
  'FAVBET PREMIJER LIGA',
  'ZAVRŠNI TURNIR ZA POPUNU PRVE MUŠKE LIGE',
  'DRUGE MUŠKE LIGE',
  'TREĆE MUŠKE LIGE',
  'ČETVRTE MUŠKE LIGE',
  'PRVA ŽENSKA LIGA',
  'JUNIORI',
  'JUNIORKE',
  'KADETI',
  'KADETKINJE',
  'MLAĐI KADETI',
  'MLAĐE KADETKINJE',
  'DJEČACI I DJEVOJČICE',
  'NATJECANJE SREDNJIH ŠKOLA',
  'NATJECANJE OSNOVNIH ŠKOLA',
  'Natjecanje MINI KOŠARKA',
  '3X3'
];

const STORED_COMPETITIONS = [...ALL_COMPETITIONS, ...LEGACY_COMPETITIONS];

const REFEREE_RANKS = ['Državni sudac', 'Županijski sudac'];

const COMPETITION_RANK = {
  'SuperSport Premijer liga': 100,
  'FAVBET PREMIJER LIGA': 100,
  'KUP «K. ĆOSIĆ»': 100,
  'PREMIJER ŽENSKA LIGA': 95,
  'KUP «R. MEGLAJ-RIMAC»': 95,
  'PRVA MUŠKA LIGA': 80,
  'ZAVRŠNI TURNIR ZA POPUNU PRVE MUŠKE LIGE': 75,
  'PRVA ŽENSKA LIGA': 70,
  'DRUGE MUŠKE LIGE': 50,
  'TREĆE MUŠKE LIGE': 40,
  'ČETVRTE MUŠKE LIGE': 30,
  'JUNIORI': 25,
  'JUNIORKE': 25,
  'KADETI': 20,
  'KADETKINJE': 20,
  'MLAĐI KADETI': 15,
  'MLAĐE KADETKINJE': 15,
  'DJEČACI I DJEVOJČICE': 10,
  'NATJECANJE SREDNJIH ŠKOLA': 8,
  'NATJECANJE OSNOVNIH ŠKOLA': 6,
  'Natjecanje MINI KOŠARKA': 4,
  '3X3': 3
};

const canonicalCompetition = (competition) =>
  competition === 'FAVBET PREMIJER LIGA' ? 'SuperSport Premijer liga' : (competition || '');

const getCompetitionRank = (competition) =>
  COMPETITION_RANK[canonicalCompetition(competition)] || COMPETITION_RANK[competition] || 0;

const isWithinNominationCap = (user, competition, assignmentRole) => {
  if (assignmentRole === 'Pomoćni Sudac') return true;
  const cap = user && user.najvisaLiga;
  if (!cap) return true;
  return getCompetitionRank(competition) <= getCompetitionRank(cap);
};

const isEligibleForCompetition = (user, competition) => {
  if (!user || !competition) return false;
  const hasOfficialRole = ELIGIBLE_OFFICIAL_ROLES.some((role) => userHasRole(user, role));
  if (!hasOfficialRole) return false;
  if (!isWithinNominationCap(user, competition)) return false;
  if (userHasRole(user, 'Sudac') || userHasRole(user, 'Delegat')) {
    return true;
  }
  return userHasRole(user, 'Kontrolor') && isTopProfessionalCompetition(competition);
};

const canViewEligibleOfficials = (userOrRole) =>
  isAdminUser(userOrRole) ||
  userHasRole(userOrRole, 'Povjerenik natjecanja') ||
  userHasRole(userOrRole, 'Povjerenik za službene osobe');

const canViewStatistics = (userOrRole) =>
  isAdminUser(userOrRole) || userHasAnyRole(userOrRole, COMMISSIONER_ROLES);

const getStatisticsRoles = (userOrRole) => {
  if (!canViewStatistics(userOrRole)) return [];
  if (
    isAdminUser(userOrRole) ||
    userHasRole(userOrRole, 'Povjerenik natjecanja') ||
    userHasRole(userOrRole, 'Povjerenik za službene osobe')
  ) {
    return GAME_ASSIGNMENT_ROLES.slice();
  }
  return ['Pomoćni Sudac'];
};

const getEligibilityCompetitions = (userOrRole) => {
  if (isAdminUser(userOrRole)) return ALL_COMPETITIONS.slice();
  const calendar = getCompetitionsForRole(userOrRole, 'Povjerenik natjecanja');
  const officials = getCompetitionsForRole(userOrRole, 'Povjerenik za službene osobe');
  if (calendar === null || officials === null) return ALL_COMPETITIONS.slice();
  return [...new Set([...(calendar || []), ...(officials || [])])];
};

const isBlockingScheduleConflict = (existingCompetition, newCompetition) =>
  getCompetitionRank(existingCompetition) >= getCompetitionRank(newCompetition);

const timesOverlap = (timeA, timeB, windowMinutes = 60) => {
  const toMinutes = (value) => {
    const [hours, minutes] = String(value || '00:00').split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  };
  return Math.abs(toMinutes(timeA) - toMinutes(timeB)) < windowMinutes;
};

const assignmentUserId = (assignment) => {
  const assigned = assignment?.userId;
  return String(typeof assigned === 'object' && assigned ? (assigned._id || assigned.id) : assigned || '');
};

const isActiveAssignment = (assignment) =>
  assignment && assignment.assignmentStatus !== 'Rejected';

const hasKontrolor = (game) =>
  (game?.refereeAssignments || []).some(
    (assignment) => assignment.role === 'Kontrolor' && isActiveAssignment(assignment)
  );

const isAssignedAs = (game, userId, role) =>
  (game?.refereeAssignments || []).some(
    (assignment) =>
      assignment.role === role &&
      assignmentUserId(assignment) === String(userId) &&
      isActiveAssignment(assignment)
  );

const normalizeRoleAssignments = (userOrRole) => {
  if (!userOrRole) return [];

  if (typeof userOrRole === 'string') {
    return USER_ROLES.includes(userOrRole)
      ? [{ name: userOrRole, competitions: [] }]
      : [];
  }

  const rawRoles = Array.isArray(userOrRole.roles) ? userOrRole.roles : [];
  const normalized = rawRoles
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === 'string') {
        return USER_ROLES.includes(entry) ? { name: entry, competitions: [] } : null;
      }
      const name = entry.name || entry.role;
      if (!USER_ROLES.includes(name)) return null;
      const competitions = Array.isArray(entry.competitions)
        ? entry.competitions
            .map((competition) => canonicalCompetition(competition))
            .filter((competition) => ALL_COMPETITIONS.includes(competition))
        : [];
      return { name, competitions };
    })
    .filter(Boolean);

  if (normalized.length) {
    return normalized;
  }

  if (userOrRole.role && USER_ROLES.includes(userOrRole.role)) {
    return [{ name: userOrRole.role, competitions: [] }];
  }

  return [];
};

const pickPrimaryRole = (assignments) => {
  if (!assignments.length) return 'Sudac';
  const names = assignments.map((assignment) => assignment.name);
  if (names.includes('Admin')) return 'Admin';
  const fieldRole = names.find((name) => GAME_ASSIGNMENT_ROLES.includes(name));
  return fieldRole || names[0];
};

const getRoleNames = (userOrRole) =>
  [...new Set(normalizeRoleAssignments(userOrRole).map((assignment) => assignment.name))];

const userHasRole = (userOrRole, roleName) => getRoleNames(userOrRole).includes(roleName);

const userHasAnyRole = (userOrRole, roleNames) =>
  roleNames.some((roleName) => userHasRole(userOrRole, roleName));

const isAdminUser = (userOrRole) => userHasRole(userOrRole, 'Admin');

const roleCoversCompetition = (assignment, competition) => {
  if (!competition) return true;
  if (!assignment.competitions || assignment.competitions.length === 0) return true;
  return assignment.competitions.includes(competition);
};

const userHasRoleForCompetition = (userOrRole, roleName, competition) => {
  if (isAdminUser(userOrRole)) return true;
  return normalizeRoleAssignments(userOrRole).some(
    (assignment) => assignment.name === roleName && roleCoversCompetition(assignment, competition)
  );
};

const getCompetitionsForRole = (userOrRole, roleName) => {
  if (isAdminUser(userOrRole)) return null;
  const matches = normalizeRoleAssignments(userOrRole).filter((assignment) => assignment.name === roleName);
  if (!matches.length) return [];
  if (matches.some((assignment) => !assignment.competitions.length)) return null;
  return [...new Set(matches.flatMap((assignment) => assignment.competitions))];
};

const getManagedCompetitions = (userOrRole) => {
  if (isAdminUser(userOrRole)) return null;
  const commissionerAssignments = normalizeRoleAssignments(userOrRole).filter((assignment) =>
    COMMISSIONER_ROLES.includes(assignment.name)
  );
  if (!commissionerAssignments.length) return [];
  if (commissionerAssignments.some((assignment) => !assignment.competitions.length)) return null;
  return [...new Set(commissionerAssignments.flatMap((assignment) => assignment.competitions))];
};

const canManageCalendar = (userOrRole, competition) =>
  userHasRoleForCompetition(userOrRole, 'Povjerenik natjecanja', competition) || isAdminUser(userOrRole);

const canNominateOfficials = (userOrRole, competition) =>
  userHasRoleForCompetition(userOrRole, 'Povjerenik za službene osobe', competition) || isAdminUser(userOrRole);

const canNominateAssistants = (userOrRole, competition) =>
  userHasRoleForCompetition(userOrRole, 'Povjerenik za pomoćne suce', competition) || isAdminUser(userOrRole);

const isOfficialOnCompetitions = (user, competitions) => {
  if (!user || !competitions?.length) return false;
  if (userHasRole(user, 'Pomoćni Sudac')) return true;
  return competitions.some((competition) => isEligibleForCompetition(user, competition));
};

const getSupervisedAbsencePersonalCodes = (viewer, users) => {
  if (isAdminUser(viewer)) return null;
  const codes = new Set();
  if (viewer?.personalCode) codes.add(viewer.personalCode);

  const watchesOfficials = userHasRole(viewer, 'Povjerenik za službene osobe');
  const watchesAssistants = userHasRole(viewer, 'Povjerenik za pomoćne suce');
  const watchesCalendar = userHasRole(viewer, 'Povjerenik natjecanja');
  if (!watchesOfficials && !watchesAssistants && !watchesCalendar) {
    return [...codes];
  }

  const officialComps = getCompetitionsForRole(viewer, 'Povjerenik za službene osobe');
  const officialList = officialComps === null ? ALL_COMPETITIONS : officialComps;
  const calendarComps = getCompetitionsForRole(viewer, 'Povjerenik natjecanja');
  const calendarList = calendarComps === null ? ALL_COMPETITIONS : calendarComps;

  (users || []).forEach((user) => {
    if (!user?.personalCode) return;
    if (watchesOfficials && OFFICIAL_NOMINATION_ROLES.some((role) => userHasRole(user, role))) {
      if (officialList.some((competition) => isEligibleForCompetition(user, competition))) {
        codes.add(user.personalCode);
      }
    }
    if (watchesAssistants && userHasRole(user, 'Pomoćni Sudac')) {
      codes.add(user.personalCode);
    }
    if (
      watchesCalendar &&
      GAME_ASSIGNMENT_ROLES.some((role) => userHasRole(user, role)) &&
      isOfficialOnCompetitions(user, calendarList)
    ) {
      codes.add(user.personalCode);
    }
  });

  return [...codes];
};

const canSeeAllGames = (userOrRole) =>
  isAdminUser(userOrRole) || userHasAnyRole(userOrRole, COMMISSIONER_ROLES);

const canAccessGame = (user, game) => {
  if (!user || !game) return false;
  if (isAdminUser(user)) return true;
  const isAssigned = (game.refereeAssignments || []).some(
    (assignment) => assignmentUserId(assignment) === String(user._id || user.id)
  );
  if (isAssigned) return true;
  return (
    canManageCalendar(user, game.competition) ||
    canNominateOfficials(user, game.competition) ||
    canNominateAssistants(user, game.competition)
  );
};

const getGamesVisibilityFilter = (user) => {
  if (isAdminUser(user)) return {};
  const competitions = getManagedCompetitions(user);
  const assignmentFilter = { 'refereeAssignments.userId': user._id };
  if (competitions === null) return {};
  if (!competitions.length) return assignmentFilter;
  return {
    $or: [
      assignmentFilter,
      { competition: { $in: competitions } }
    ]
  };
};

const canAssignGameRole = (userOrRole, assignmentRole, competition) => {
  if (isAdminUser(userOrRole)) {
    return GAME_ASSIGNMENT_ROLES.includes(assignmentRole);
  }
  if (canNominateOfficials(userOrRole, competition) && OFFICIAL_NOMINATION_ROLES.includes(assignmentRole)) {
    return true;
  }
  if (canNominateAssistants(userOrRole, competition) && ASSISTANT_NOMINATION_ROLES.includes(assignmentRole)) {
    return true;
  }
  return false;
};

const canWriteKontrola = (user, game) => {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  if (hasKontrolor(game)) {
    return isAssignedAs(game, user._id, 'Kontrolor');
  }
  return userHasRole(user, 'Delegat') && isAssignedAs(game, user._id, 'Delegat');
};

const canViewFullKontrola = (user, game) => {
  if (!user || !game) return false;
  if (isAdminUser(user) || canWriteKontrola(user, game)) return true;
  return canManageCalendar(user, game.competition) || canNominateOfficials(user, game.competition);
};

const isTopProfessionalCompetition = (competition) =>
  TOP_PROFESSIONAL_COMPETITIONS.includes(competition);

const gameAssignmentRoleQuery = () => ({
  $or: [
    { role: { $in: GAME_ASSIGNMENT_ROLES } },
    { 'roles.name': { $in: GAME_ASSIGNMENT_ROLES } }
  ]
});

const adminUserQuery = () => ({
  $or: [
    { role: 'Admin' },
    { 'roles.name': 'Admin' }
  ]
});

const commissionerRoleQuery = (roleName) => ({
  $or: [
    { role: roleName },
    { 'roles.name': roleName }
  ]
});

const shouldReceiveAssignmentResponse = (user, assignmentRole, competition) => {
  if (isAdminUser(user)) return true;
  if (assignmentRole === 'Pomoćni Sudac') {
    return userHasRoleForCompetition(user, 'Povjerenik za pomoćne suce', competition);
  }
  if (OFFICIAL_NOMINATION_ROLES.includes(assignmentRole)) {
    return userHasRoleForCompetition(user, 'Povjerenik za službene osobe', competition);
  }
  return false;
};

module.exports = {
  USER_ROLES,
  GAME_ASSIGNMENT_ROLES,
  COMMISSIONER_ROLES,
  OFFICIAL_NOMINATION_ROLES,
  ASSISTANT_NOMINATION_ROLES,
  ELIGIBLE_OFFICIAL_ROLES,
  REFEREE_RANKS,
  TOP_PROFESSIONAL_COMPETITIONS,
  ALL_COMPETITIONS,
  STORED_COMPETITIONS,
  canonicalCompetition,
  isWithinNominationCap,
  isEligibleForCompetition,
  canViewEligibleOfficials,
  canViewStatistics,
  getStatisticsRoles,
  getEligibilityCompetitions,
  normalizeRoleAssignments,
  pickPrimaryRole,
  getRoleNames,
  userHasRole,
  userHasAnyRole,
  isAdminUser,
  userHasRoleForCompetition,
  getCompetitionsForRole,
  getManagedCompetitions,
  canManageCalendar,
  canNominateOfficials,
  canNominateAssistants,
  getSupervisedAbsencePersonalCodes,
  canSeeAllGames,
  canAccessGame,
  getGamesVisibilityFilter,
  canAssignGameRole,
  canWriteKontrola,
  canViewFullKontrola,
  hasKontrolor,
  isTopProfessionalCompetition,
  gameAssignmentRoleQuery,
  adminUserQuery,
  commissionerRoleQuery,
  shouldReceiveAssignmentResponse,
  COMPETITION_RANK,
  getCompetitionRank,
  isBlockingScheduleConflict,
  timesOverlap
};
