const User = require('../models/User');
const {
  ALL_COMPETITIONS,
  COMMISSIONER_ROLES,
  normalizeRoleAssignments
} = require('../config/roles');

const emptyCoverage = () => {
  const coverage = {};
  ALL_COMPETITIONS.forEach((competition) => {
    coverage[competition] = {};
    COMMISSIONER_ROLES.forEach((role) => {
      coverage[competition][role] = [];
    });
  });
  return coverage;
};

const competitionsForAssignment = (assignment) =>
  assignment.competitions.length ? assignment.competitions : ALL_COMPETITIONS;

const buildCoverage = (users) => {
  const coverage = emptyCoverage();

  users.forEach((user) => {
    normalizeRoleAssignments(user).forEach((assignment) => {
      if (!COMMISSIONER_ROLES.includes(assignment.name)) {
        return;
      }
      competitionsForAssignment(assignment).forEach((competition) => {
        if (!coverage[competition]) {
          return;
        }
        const holders = coverage[competition][assignment.name];
        const userId = String(user._id);
        if (!holders.includes(userId)) {
          holders.push(userId);
        }
      });
    });
  });

  return coverage;
};

const missingCommissionerRoles = (coverage, competition) =>
  COMMISSIONER_ROLES.filter((role) => !coverage[competition]?.[role]?.length);

const formatMissingRolesError = (competition, missingRoles) =>
  `Natjecanje ${competition} mora imati: ${missingRoles.join(', ')}.`;

const loadCommissionerUsers = async () =>
  User.find({
    $or: [
      { role: { $in: COMMISSIONER_ROLES } },
      { 'roles.name': { $in: COMMISSIONER_ROLES } }
    ]
  }).select('_id role roles').lean();

const assertCompetitionHasCommissioners = async (competition) => {
  const coverage = buildCoverage(await loadCommissionerUsers());
  const missing = missingCommissionerRoles(coverage, competition);
  if (missing.length) {
    const error = new Error(formatMissingRolesError(competition, missing));
    error.statusCode = 400;
    throw error;
  }
};

const assertCoverageAfterChange = async (userId, nextAssignments, { removing = false } = {}) => {
  const users = await loadCommissionerUsers();
  const simulated = users
    .filter((user) => !(removing && String(user._id) === String(userId)))
    .map((user) => {
      if (String(user._id) !== String(userId)) {
        return user;
      }
      return {
        ...user,
        roles: nextAssignments,
        role: nextAssignments[0]?.name
      };
    });

  if (!removing && nextAssignments?.length && !simulated.some((user) => String(user._id) === String(userId))) {
    simulated.push({
      _id: userId || 'new-user',
      roles: nextAssignments,
      role: nextAssignments[0]?.name
    });
  }

  const previousCoverage = buildCoverage(users);
  const nextCoverage = buildCoverage(simulated);
  const uncovered = [];

  ALL_COMPETITIONS.forEach((competition) => {
    COMMISSIONER_ROLES.forEach((role) => {
      const hadCoverage = previousCoverage[competition][role].length > 0;
      const hasCoverage = nextCoverage[competition][role].length > 0;
      if (hadCoverage && !hasCoverage) {
        uncovered.push(`${role} za ${competition}`);
      }
    });
  });

  if (uncovered.length) {
    const error = new Error(
      `Ova promjena ostavila bi natjecanje bez obaveznog povjerenika: ${uncovered.join(', ')}.`
    );
    error.statusCode = 400;
    throw error;
  }
};

module.exports = {
  COMMISSIONER_ROLES,
  buildCoverage,
  missingCommissionerRoles,
  assertCompetitionHasCommissioners,
  assertCoverageAfterChange
};
