const Absence = require('../models/Absence');
const BasketballGame = require('../models/BasketballGames');
const TravelExpense = require('../models/TravelExpense');
const { backfillDisplayIds } = require('../utils/displayId');

const seedDisplayIds = async () => {
  await backfillDisplayIds(Absence, 'absence');
  await backfillDisplayIds(BasketballGame, 'basketballGame');
  await backfillDisplayIds(TravelExpense, 'travelExpense');
};

module.exports = seedDisplayIds;
