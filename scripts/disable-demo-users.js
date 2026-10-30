require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { isAdminUser } = require('../config/roles');
const { hashUnusablePassword, clearPasswordReset } = require('../utils/passwordReset');
const { DEMO_USERNAMES } = require('../utils/demoUsernames');

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set.');
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverApi: { version: '1', strict: true, deprecationErrors: true }
  });

  const users = await User.find({ username: { $in: DEMO_USERNAMES } });
  const skippedAdmins = [];
  const disabled = [];

  for (const user of users) {
    if (isAdminUser(user)) {
      skippedAdmins.push(user.username);
      continue;
    }
    user.password = await hashUnusablePassword();
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    clearPasswordReset(user);
    await user.save();
    disabled.push(user.username);
  }

  const missing = DEMO_USERNAMES.filter(
    (name) => !users.some((user) => user.username === name)
  );

  console.log(`Disabled demo logins (${disabled.length}): ${disabled.join(', ') || '(none found)'}`);
  if (skippedAdmins.length) {
    console.log(`Skipped admins: ${skippedAdmins.join(', ')}`);
  }
  if (missing.length) {
    console.log(`Not in this database: ${missing.join(', ')}`);
  }
  console.log('Those accounts cannot sign in with Lozinka123!. Invite them again from Admin if you still need them.');

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error.message || error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
