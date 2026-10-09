require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const BasketballGame = require('../models/BasketballGames');
const TravelExpense = require('../models/TravelExpense');

const REMOVED_ROLES = ['Pomoćni Sudac', 'Povjerenik za pomoćne suce'];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const users = await User.find();
  let deletedUsers = 0;
  let strippedRoles = 0;
  for (const user of users) {
    const rawRoles = [
      ...(user.roles || []).map((assignment) => assignment.name),
      user.role
    ].filter(Boolean);
    const remaining = (user.roles || []).filter((assignment) => !REMOVED_ROLES.includes(assignment.name));
    const hadRemoved = rawRoles.some((name) => REMOVED_ROLES.includes(name));
    if (hadRemoved && remaining.length === 0) {
      await User.deleteOne({ _id: user._id });
      deletedUsers += 1;
      continue;
    }
    if (hadRemoved) {
      user.roles = remaining;
      await user.save();
      strippedRoles += 1;
    }
  }

  const games = await BasketballGame.updateMany(
    {},
    { $pull: { refereeAssignments: { role: 'Pomoćni Sudac' } } }
  );

  const expenses = await TravelExpense.deleteMany({
    type: 'Troškovno izvješće pomoćnog suca'
  });

  console.log({
    deletedUsers,
    strippedRoles,
    gamesModified: games.modifiedCount,
    expensesDeleted: expenses.deletedCount
  });

  await mongoose.disconnect();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
