const Team = require('../models/Team');
const Venue = require('../models/Venue');
const { TEAMS, VENUES } = require('../config/catalog');

const seedCatalog = async () => {
  for (const team of TEAMS) {
    await Team.updateOne(
      { name: team.name },
      { $set: { name: team.name, competitions: team.competitions } },
      { upsert: true }
    );
  }

  for (const name of VENUES) {
    await Venue.updateOne(
      { name },
      { $set: { name } },
      { upsert: true }
    );
  }

  console.log(`✅ Catalog seeded (${TEAMS.length} teams, ${VENUES.length} venues)`);
};

module.exports = seedCatalog;
