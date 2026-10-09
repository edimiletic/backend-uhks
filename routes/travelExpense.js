const fs = require('fs');
const express = require('express');
const router = express.Router();
const TravelExpense = require('../models/TravelExpense');
const BasketballGame = require('../models/BasketballGames');
const Notification = require('../models/Notification');
const authenticateUser = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const {
  isAdminUser,
  canManageCalendar,
  canNominateOfficials,
  userHasRole,
  GAME_ASSIGNMENT_ROLES,
  canonicalCompetition
} = require('../config/roles');
const {
  upload,
  TEMPLATE_PATH,
  toStoredFile,
  absolutePath,
  removeStoredFile,
  removeExpenseFiles
} = require('../utils/travelExpenseFiles');

router.use(authenticateUser);

const assignmentUserId = (assignment) => {
  const assigned = assignment?.userId;
  return String(typeof assigned === 'object' && assigned ? (assigned._id || assigned.id) : assigned || '');
};

const acceptedAssignment = (game, userId) =>
  (game?.refereeAssignments || []).find(
    (assignment) =>
      assignmentUserId(assignment) === String(userId) &&
      assignment.assignmentStatus === 'Accepted' &&
      GAME_ASSIGNMENT_ROLES.includes(assignment.role)
  );

const ownerId = (expense) => {
  const user = expense.userId;
  if (!user) return '';
  return String(user._id || user);
};

const isOwner = (expense, user) => ownerId(expense) === String(user._id);

const gameCompetition = (expense) => {
  const game = expense.gameId;
  if (game && typeof game === 'object') return canonicalCompetition(game.competition);
  return '';
};

const canAccessTravelExpense = (viewer, expense) => {
  if (isAdminUser(viewer) || isOwner(expense, viewer)) return true;
  const competition = gameCompetition(expense);
  return canManageCalendar(viewer, competition) || canNominateOfficials(viewer, competition);
};

const canReviewTravelExpense = (viewer, expense) => {
  if (isOwner(expense, viewer)) return false;
  if (isAdminUser(viewer)) return true;
  if (!userHasRole(viewer, 'Povjerenik natjecanja')) return false;
  return canManageCalendar(viewer, gameCompetition(expense));
};

const multerFields = upload.fields([
  { name: 'nalog', maxCount: 1 },
  { name: 'fuelReceipt', maxCount: 1 },
  { name: 'tollReceipt', maxCount: 1 }
]);

const handleUpload = (req, res, next) => {
  multerFields(req, res, (error) => {
    if (!error) return next();
    return res.status(400).json({ error: error.message || 'Prijenos datoteke nije uspio.' });
  });
};

const parseUsedHighway = (value) => value === true || value === 'true' || value === '1';

router.get('/template', (_req, res) => {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    return res.status(404).json({ error: 'Predložak putnog naloga nije pronađen.' });
  }
  res.download(TEMPLATE_PATH, 'Putni nalog HKS.xls');
});

router.get('/eligible-games', async (req, res) => {
  try {
    const games = await BasketballGame.find({
      refereeAssignments: {
        $elemMatch: {
          userId: req.user._id,
          assignmentStatus: 'Accepted',
          role: { $in: GAME_ASSIGNMENT_ROLES }
        }
      }
    }).sort({ date: -1 });

    const existing = await TravelExpense.find({ userId: req.user._id }).select('gameId state');
    const blocking = new Set(
      existing
        .filter((expense) => expense.state !== 'Odbijeno')
        .map((expense) => String(expense.gameId))
    );

    const eligible = games
      .map((game) => {
        const assignment = acceptedAssignment(game, req.user._id);
        if (!assignment || blocking.has(String(game._id))) return null;
        return {
          _id: game._id,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          date: game.date,
          time: game.time,
          venue: game.venue,
          competition: game.competition,
          assignmentRole: assignment.role
        };
      })
      .filter(Boolean);

    res.json(eligible);
  } catch (error) {
    console.error('Eligible travel games error:', error);
    res.status(500).json({ error: 'Neuspješno dohvaćanje utakmica za nalog.' });
  }
});

router.post('/', handleUpload, async (req, res) => {
  const uploaded = [
    req.files?.nalog?.[0],
    req.files?.fuelReceipt?.[0],
    req.files?.tollReceipt?.[0]
  ].filter(Boolean);

  try {
    const gameId = req.body.gameId;
    const usedHighway = parseUsedHighway(req.body.usedHighway);
    const nalog = req.files?.nalog?.[0];
    const fuelReceipt = req.files?.fuelReceipt?.[0];
    const tollReceipt = req.files?.tollReceipt?.[0];

    if (!gameId) {
      uploaded.forEach((file) => fs.unlink(file.path, () => {}));
      return res.status(400).json({ error: 'Odaberite utakmicu.' });
    }
    if (!nalog || !fuelReceipt) {
      uploaded.forEach((file) => fs.unlink(file.path, () => {}));
      return res.status(400).json({ error: 'Obavezni su putni nalog i PDF računa goriva.' });
    }
    if (usedHighway && !tollReceipt) {
      uploaded.forEach((file) => fs.unlink(file.path, () => {}));
      return res.status(400).json({ error: 'Za autocestu priložite PDF računa cestarine.' });
    }

    const game = await BasketballGame.findById(gameId);
    if (!game) {
      uploaded.forEach((file) => fs.unlink(file.path, () => {}));
      return res.status(404).json({ error: 'Utakmica nije pronađena.' });
    }

    const assignment = acceptedAssignment(game, req.user._id);
    if (!assignment) {
      uploaded.forEach((file) => fs.unlink(file.path, () => {}));
      return res.status(403).json({
        error: 'Putni nalog može predati samo osoba s prihvaćenom nominacijom na toj utakmici.'
      });
    }

    const existing = await TravelExpense.findOne({ userId: req.user._id, gameId: game._id });
    if (existing && existing.state !== 'Odbijeno') {
      uploaded.forEach((file) => fs.unlink(file.path, () => {}));
      return res.status(400).json({ error: 'Za ovu utakmicu već postoji putni nalog.' });
    }

    if (existing) {
      removeExpenseFiles(existing);
      existing.assignmentRole = assignment.role;
      existing.usedHighway = usedHighway;
      existing.nalogFile = toStoredFile(nalog);
      existing.fuelReceiptFile = toStoredFile(fuelReceipt);
      existing.tollReceiptFile = usedHighway ? toStoredFile(tollReceipt) : undefined;
      existing.state = 'Predano';
      existing.submittedAt = new Date();
      existing.reviewedAt = undefined;
      existing.reviewedBy = undefined;
      existing.reviewComments = '';
      const saved = await existing.save();
      await saved.populate('userId', 'name surname');
      await saved.populate('gameId', 'homeTeam awayTeam date time venue competition');
      return res.status(200).json(saved);
    }

    const travelExpense = new TravelExpense({
      userId: req.user._id,
      gameId: game._id,
      assignmentRole: assignment.role,
      usedHighway,
      nalogFile: toStoredFile(nalog),
      fuelReceiptFile: toStoredFile(fuelReceipt),
      tollReceiptFile: usedHighway ? toStoredFile(tollReceipt) : undefined,
      state: 'Predano',
      submittedAt: new Date()
    });
    const saved = await travelExpense.save();
    await saved.populate('userId', 'name surname');
    await saved.populate('gameId', 'homeTeam awayTeam date time venue competition');
    res.status(201).json(saved);
  } catch (error) {
    uploaded.forEach((file) => fs.unlink(file.path, () => {}));
    console.error('Create travel expense error:', error);
    res.status(500).json({ error: 'Neuspješno spremanje putnog naloga.' });
  }
});

router.get('/my', async (req, res) => {
  try {
    const expenses = await TravelExpense.find({ userId: req.user._id })
      .populate('userId', 'name surname')
      .populate('gameId', 'homeTeam awayTeam date time venue competition')
      .populate('reviewedBy', 'name surname')
      .sort({ createdAt: -1 });
    res.json(expenses);
  } catch (error) {
    console.error('Get user travel expenses error:', error);
    res.status(500).json({ error: 'Neuspješno dohvaćanje putnih naloga.' });
  }
});

router.get('/', requireRole(['Admin', 'Povjerenik natjecanja', 'Povjerenik za službene osobe']), async (req, res) => {
  try {
    const expenses = await TravelExpense.find({})
      .populate('userId', 'name surname role roles')
      .populate('gameId', 'homeTeam awayTeam date time venue competition')
      .populate('reviewedBy', 'name surname')
      .sort({ createdAt: -1 });

    const visible = expenses.filter((expense) => canAccessTravelExpense(req.user, expense));
    res.json(visible);
  } catch (error) {
    console.error('Get all travel expenses error:', error);
    res.status(500).json({ error: 'Neuspješno dohvaćanje putnih naloga.' });
  }
});

router.get('/:id/files/:kind', async (req, res) => {
  try {
    const expense = await TravelExpense.findById(req.params.id).populate('gameId', 'competition');
    if (!expense) {
      return res.status(404).json({ error: 'Putni nalog nije pronađen.' });
    }
    if (!canAccessTravelExpense(req.user, expense)) {
      return res.status(403).json({ error: 'Pristup odbijen.' });
    }

    const kind = req.params.kind;
    const file =
      kind === 'nalog' ? expense.nalogFile :
      kind === 'fuel' ? expense.fuelReceiptFile :
      kind === 'toll' ? expense.tollReceiptFile :
      null;
    if (!file?.storedName) {
      return res.status(404).json({ error: 'Datoteka nije pronađena.' });
    }

    const filePath = absolutePath(file.storedName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Datoteka nije pronađena na disku.' });
    }
    res.download(filePath, file.originalName);
  } catch (error) {
    console.error('Download travel file error:', error);
    res.status(500).json({ error: 'Preuzimanje datoteke nije uspjelo.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const expense = await TravelExpense.findById(req.params.id)
      .populate('userId', 'name surname personalCode')
      .populate('gameId', 'homeTeam awayTeam date time venue competition')
      .populate('reviewedBy', 'name surname');

    if (!expense) {
      return res.status(404).json({ error: 'Putni nalog nije pronađen.' });
    }
    if (!canAccessTravelExpense(req.user, expense)) {
      return res.status(403).json({ error: 'Pristup odbijen.' });
    }
    res.json(expense);
  } catch (error) {
    console.error('Get travel expense by ID error:', error);
    res.status(500).json({ error: 'Neuspješno dohvaćanje putnog naloga.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const expense = await TravelExpense.findById(req.params.id).populate('gameId', 'competition');
    if (!expense) {
      return res.status(404).json({ error: 'Putni nalog nije pronađen.' });
    }
    if (!isOwner(expense, req.user) && !isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Pristup odbijen.' });
    }
    if (expense.state !== 'Odbijeno' && !isAdminUser(req.user)) {
      return res.status(400).json({ error: 'Možete obrisati samo odbijeni nalog.' });
    }
    if (expense.state === 'Potvrđeno' && !isAdminUser(req.user)) {
      return res.status(400).json({ error: 'Odobreni nalog se ne može obrisati.' });
    }

    removeExpenseFiles(expense);
    await TravelExpense.findByIdAndDelete(req.params.id);
    res.json({ message: 'Putni nalog je obrisan.' });
  } catch (error) {
    console.error('Delete travel expense error:', error);
    res.status(500).json({ error: 'Brisanje putnog naloga nije uspjelo.' });
  }
});

router.patch('/:id/review', requireRole(['Admin', 'Povjerenik natjecanja']), async (req, res) => {
  try {
    const expense = await TravelExpense.findById(req.params.id)
      .populate('gameId', 'homeTeam awayTeam date time venue competition');

    if (!expense) {
      return res.status(404).json({ error: 'Putni nalog nije pronađen.' });
    }
    if (!canReviewTravelExpense(req.user, expense)) {
      return res.status(403).json({ error: 'Pristup odbijen.' });
    }
    if (expense.state !== 'Predano') {
      return res.status(400).json({ error: 'Pregledati se može samo predani nalog.' });
    }

    const { action, reviewComments } = req.body;
    const notes = (reviewComments || '').trim();

    if (action === 'approve') {
      expense.state = 'Potvrđeno';
      expense.reviewComments = notes || expense.reviewComments;
    } else if (action === 'reject') {
      if (!notes) {
        return res.status(400).json({ error: 'Pri odbijanju je obavezna napomena.' });
      }
      expense.state = 'Odbijeno';
      expense.reviewComments = notes;
    } else {
      return res.status(400).json({ error: 'Akcija mora biti approve ili reject.' });
    }

    expense.reviewedAt = new Date();
    expense.reviewedBy = req.user._id;
    const ownerUserId = expense.userId;
    const updated = await expense.save();
    await updated.populate('userId', 'name surname');
    await updated.populate('reviewedBy', 'name surname');
    await updated.populate('gameId', 'homeTeam awayTeam date time venue competition');

    const game = updated.gameId;
    try {
      await Notification.createExpenseReviewNotification(ownerUserId, expense._id, {
        approved: action === 'approve',
        homeTeam: game?.homeTeam,
        awayTeam: game?.awayTeam,
        notes: action === 'reject' ? notes : ''
      });
    } catch (notifyError) {
      console.error('Expense review notification error:', notifyError);
    }

    res.json(updated);
  } catch (error) {
    console.error('Review travel expense error:', error);
    res.status(500).json({ error: 'Pregled putnog naloga nije uspio.' });
  }
});

module.exports = router;
