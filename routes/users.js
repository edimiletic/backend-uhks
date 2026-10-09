// backend/routes/users.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const BasketballGame = require('../models/BasketballGames');
const {
  canSeeAllGames,
  isAdminUser,
  gameAssignmentRoleQuery,
  normalizeRoleAssignments,
  pickPrimaryRole,
  REFEREE_RANKS,
  ALL_COMPETITIONS,
  COMMISSIONER_ROLES,
  ELIGIBLE_OFFICIAL_ROLES,
  getRoleNames,
  userHasRole,
  canViewEligibleOfficials,
  getStatisticsRoles,
  getEligibilityCompetitions,
  isEligibleForCompetition,
  getCompetitionRank,
  incompatibleRolesMessage
} = require('../config/roles');
const {
  assertCoverageAfterChange,
  takeCommissionerCompetitionsFromOthers
} = require('../utils/commissionerCoverage');
const authenticateUser = require('../middleware/authMiddleware');

const officialCapsError = (assignments, rang, najvisaLiga) => {
  const isSudac = assignments.some((assignment) => assignment.name === 'Sudac');
  const needsLiga = assignments.some((assignment) => ELIGIBLE_OFFICIAL_ROLES.includes(assignment.name));
  const sanitizedRang = isSudac ? String(rang || '').trim() : '';
  const sanitizedNajvisaLiga = needsLiga ? String(najvisaLiga || '').trim() : '';

  if (isSudac && !REFEREE_RANKS.includes(sanitizedRang)) {
    return { error: 'Za suca obavezno odaberi rang (Državni sudac ili Županijski sudac).' };
  }
  if (needsLiga && !ALL_COMPETITIONS.includes(sanitizedNajvisaLiga)) {
    return {
      error: isSudac
        ? 'Za suca obavezno odaberi najvišu ligu.'
        : 'Za delegata i kontrolora obavezno odaberi najvišu ligu.'
    };
  }
  return { rang: sanitizedRang, najvisaLiga: sanitizedNajvisaLiga };
};

const commissionerAssignmentsError = (assignments) => {
  const missingCompetitions = assignments.filter(
    (assignment) =>
      COMMISSIONER_ROLES.includes(assignment.name) &&
      !(assignment.competitions && assignment.competitions.length)
  );
  if (missingCompetitions.length) {
    return 'Povjereniku odaberi barem jedno natjecanje. Sve postojeće lige već imaju povjerenika — dodijeli novo natjecanje ili preuzmi natjecanje s postojećeg povjerenika.';
  }
  const invalidCompetition = assignments.some(
    (assignment) =>
      COMMISSIONER_ROLES.includes(assignment.name) &&
      assignment.competitions.some((competition) => !ALL_COMPETITIONS.includes(competition))
  );
  if (invalidCompetition) {
    return 'Natjecanje povjerenika nije valjano.';
  }
  return null;
};

// Apply authentication middleware to all routes
router.use(authenticateUser);

// GET - Get all referees (Admin only)
router.get('/referees', async (req, res) => {
  try {
    // Check if user is admin
    if (!canSeeAllGames(req.user)) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const referees = await User.find(gameAssignmentRoleQuery())
    .select('_id name surname email role roles personalCode rang najvisaLiga')
    .sort({ role: 1, surname: 1, name: 1 });

    const allowedRoles = getStatisticsRoles(req.user);
    const visibleReferees = allowedRoles.length
      ? referees.filter((referee) => allowedRoles.some((role) => userHasRole(referee, role)))
      : referees;

    res.json(visibleReferees);
  } catch (error) {
    console.error('Get referees error:', error);
    res.status(500).json({ error: 'Failed to fetch referees' });
  }
});

router.get('/eligible-officials', async (req, res) => {
  try {
    if (!canViewEligibleOfficials(req.user)) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const competitions = getEligibilityCompetitions(req.user)
      .slice()
      .sort((a, b) => getCompetitionRank(b) - getCompetitionRank(a) || a.localeCompare(b));

    const officials = await User.find(gameAssignmentRoleQuery())
      .select('_id name surname email role roles rang najvisaLiga')
      .sort({ surname: 1, name: 1 });

    const placed = new Set();
    const groups = competitions.map((competition) => {
      const rows = officials.filter((official) => {
        const id = String(official._id);
        if (placed.has(id) || !isEligibleForCompetition(official, competition)) return false;
        placed.add(id);
        return true;
      }).map((official) => ({
        _id: official._id,
        name: official.name,
        surname: official.surname,
        email: official.email,
        roles: getRoleNames(official).filter((role) => ELIGIBLE_OFFICIAL_ROLES.includes(role)),
        rang: official.rang || '',
        najvisaLiga: official.najvisaLiga || ''
      }));

      return { competition, officials: rows };
    });

    res.json({ competitions: groups });
  } catch (error) {
    console.error('Get eligible officials error:', error);
    res.status(500).json({ error: 'Failed to fetch eligible officials' });
  }
});

// GET - Get all users (Admin only)
router.get('/', async (req, res) => {
  try {
    // Check if user is admin
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const users = await User.find()
      .select('-password')
      .sort({ role: 1, surname: 1, name: 1 });

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET - Get user by ID (Admin only)
router.get('/:id', async (req, res) => {
  try {
    // Check if user is admin
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST - Create new user (Admin only)
router.post('/', async (req, res) => {
  try {
    // Check if user is admin
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const {
      username,
      name,
      surname,
      email,
      password,
      birthdate,
      personalCode,
      address,
      role,
      roles,
      rang,
      najvisaLiga
    } = req.body;

    const assignments = normalizeRoleAssignments({ role, roles });
    const roleConflict = incompatibleRolesMessage(assignments.map((assignment) => assignment.name));
    if (roleConflict) {
      return res.status(400).json({ error: roleConflict });
    }

    const caps = officialCapsError(assignments, rang, najvisaLiga);
    if (caps.error) {
      return res.status(400).json({ error: caps.error });
    }
    const sanitizedRang = caps.rang;
    const sanitizedNajvisaLiga = caps.najvisaLiga;

    if (!username || !name || !surname || !email || !password || !birthdate || !personalCode || !address) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!assignments.length) {
      return res.status(400).json({ error: 'At least one valid role is required' });
    }

    const commissionerError = commissionerAssignmentsError(assignments);
    if (commissionerError) {
      return res.status(400).json({ error: commissionerError });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }, { personalCode }]
    });

    if (existingUser) {
      return res.status(400).json({ 
        error: 'User with this username, email or personal code already exists' 
      });
    }

    try {
      await takeCommissionerCompetitionsFromOthers(null, assignments);
    } catch (coverageError) {
      return res.status(coverageError.statusCode || 400).json({ error: coverageError.message });
    }

    // Hash the password
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new User({
      username,
      name,
      surname,
      email,
      password: hashedPassword,
      birthdate,
      personalCode,
      address,
      role: pickPrimaryRole(assignments),
      roles: assignments,
      rang: sanitizedRang,
      najvisaLiga: sanitizedNajvisaLiga
    });

    await newUser.save();

    // Return user without password
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json(userResponse);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT - Update user (Admin only)
router.put('/:id', async (req, res) => {
  try {
    // Check if user is admin
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const {
      username,
      name,
      surname,
      email,
      password,
      birthdate,
      personalCode,
      address,
      role,
      roles,
      rang,
      najvisaLiga
    } = req.body;

    // Check for duplicate username, email, or personalCode (excluding current user)
    if (username || email || personalCode) {
      const duplicateQuery = {
        _id: { $ne: req.params.id },
        $or: []
      };

      if (username) duplicateQuery.$or.push({ username });
      if (email) duplicateQuery.$or.push({ email });
      if (personalCode) duplicateQuery.$or.push({ personalCode });

      const existingUser = await User.findOne(duplicateQuery);
      if (existingUser) {
        return res.status(400).json({ 
          error: 'Username, email or personal code already exists' 
        });
      }
    }

    // Update fields
    if (username) user.username = username;
    if (name) user.name = name;
    if (surname) user.surname = surname;
    if (email) user.email = email;
    if (birthdate) user.birthdate = birthdate;
    if (personalCode) user.personalCode = personalCode;
    if (address) user.address = address;
    if (roles || role) {
      const assignments = normalizeRoleAssignments({
        role: role || user.role,
        roles: roles || user.roles
      });
      if (!assignments.length) {
        return res.status(400).json({ error: 'At least one valid role is required' });
      }
      const roleConflict = incompatibleRolesMessage(assignments.map((assignment) => assignment.name));
      if (roleConflict) {
        return res.status(400).json({ error: roleConflict });
      }
      const commissionerError = commissionerAssignmentsError(assignments);
      if (commissionerError) {
        return res.status(400).json({ error: commissionerError });
      }
      try {
        await takeCommissionerCompetitionsFromOthers(user._id, assignments);
        await assertCoverageAfterChange(user._id, assignments);
      } catch (coverageError) {
        return res.status(coverageError.statusCode || 400).json({ error: coverageError.message });
      }
      user.roles = assignments;
      user.role = pickPrimaryRole(assignments);
    }

    // Hash new password if provided
    if (password) {
      const bcrypt = require('bcrypt');
      user.password = await bcrypt.hash(password, 10);
    }

    const finalAssignments = normalizeRoleAssignments(user);
    const caps = officialCapsError(
      finalAssignments,
      rang !== undefined ? rang : user.rang,
      najvisaLiga !== undefined ? najvisaLiga : user.najvisaLiga
    );
    if (caps.error) {
      return res.status(400).json({ error: caps.error });
    }
    user.rang = caps.rang;
    user.najvisaLiga = caps.najvisaLiga;

    const updatedUser = await user.save();

    // Return user without password
    const userResponse = updatedUser.toObject();
    delete userResponse.password;

    res.json(userResponse);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE - Delete user (Admin only)
router.delete('/:id', async (req, res) => {
  try {
    // Check if user is admin
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    // Prevent admin from deleting themselves
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ error: 'Ne možeš obrisati vlastiti račun.' });
    }

    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'Korisnik nije pronađen.' });
    }

    const assignedGames = await BasketballGame.find({
      'refereeAssignments.userId': req.params.id
    }).select('_id').lean();

    if (assignedGames.length > 0) {
      return res.status(400).json({
        error: 'Korisnik ima nominacije na utakmicama. Prvo ukloni dodjele, pa ga obriši.'
      });
    }

    try {
      await assertCoverageAfterChange(user._id, [], { removing: true });
    } catch (coverageError) {
      return res.status(coverageError.statusCode || 400).json({ error: coverageError.message });
    }

    await User.deleteOne({ _id: req.params.id });
    res.json({ message: 'Korisnik je obrisan.' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Brisanje korisnika nije uspjelo.' });
  }
});

module.exports = router;