require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const BasketballGame = require('../models/BasketballGames');
const Absence = require('../models/Absence');
const TravelExpense = require('../models/TravelExpense');
const Notification = require('../models/Notification');
const Kontrola = require('../models/Kontrola');
const { ExamAttempt } = require('../models/Exams');
const { ALL_COMPETITIONS } = require('../config/roles');

const PASSWORD = 'Lozinka123!';

const TOP_COMMISSIONER_COMPETITIONS = [
  'SuperSport Premijer liga',
  'PRVA MUŠKA LIGA'
];
const OTHER_COMMISSIONER_COMPETITIONS = ALL_COMPETITIONS.filter(
  (competition) => !TOP_COMMISSIONER_COMPETITIONS.includes(competition)
);

const newUsers = [
  {
    username: 'pnat1',
    name: 'Ivan',
    surname: 'Horvat',
    email: 'ivan.horvat@ukspgz.test',
    personalCode: '10000000001',
    roles: [{ name: 'Povjerenik natjecanja', competitions: TOP_COMMISSIONER_COMPETITIONS }]
  },
  {
    username: 'pnat2',
    name: 'Marko',
    surname: 'Kovač',
    email: 'marko.kovac@ukspgz.test',
    personalCode: '10000000002',
    roles: [{ name: 'Povjerenik natjecanja', competitions: OTHER_COMMISSIONER_COMPETITIONS }]
  },
  {
    username: 'psluz1',
    name: 'Petra',
    surname: 'Babić',
    email: 'petra.babic@ukspgz.test',
    personalCode: '10000000003',
    roles: [{ name: 'Povjerenik za službene osobe', competitions: TOP_COMMISSIONER_COMPETITIONS }]
  },
  {
    username: 'psluz2',
    name: 'Ana',
    surname: 'Jurić',
    email: 'ana.juric@ukspgz.test',
    personalCode: '10000000004',
    roles: [{ name: 'Povjerenik za službene osobe', competitions: OTHER_COMMISSIONER_COMPETITIONS }]
  },
  {
    username: 'ppom1',
    name: 'Luka',
    surname: 'Novak',
    email: 'luka.novak@ukspgz.test',
    personalCode: '10000000005',
    roles: [{ name: 'Povjerenik za pomoćne suce', competitions: TOP_COMMISSIONER_COMPETITIONS }]
  },
  {
    username: 'ppom2',
    name: 'Tomislav',
    surname: 'Marić',
    email: 'tomislav.maric@ukspgz.test',
    personalCode: '10000000006',
    roles: [{ name: 'Povjerenik za pomoćne suce', competitions: OTHER_COMMISSIONER_COMPETITIONS }]
  },
];

const fieldOfficial = (username, name, surname, personalCode, role, extra = {}) => ({
  username,
  name,
  surname,
  email: `${username}@ukspgz.test`,
  personalCode,
  roles: [{ name: role, competitions: [] }],
  ...extra
});

newUsers.push(
  fieldOfficial('sudac1', 'Josip', 'Perić', '10000000007', 'Sudac', { rang: 'Državni sudac', najvisaLiga: 'SuperSport Premijer liga' }),
  fieldOfficial('sudac2', 'Nikola', 'Šimić', '10000000008', 'Sudac', { rang: 'Državni sudac', najvisaLiga: 'SuperSport Premijer liga' }),
  fieldOfficial('sudac3', 'Filip', 'Radić', '10000000009', 'Sudac', { rang: 'Državni sudac', najvisaLiga: 'SuperSport Premijer liga' }),
  fieldOfficial('sudac4', 'Ante', 'Lovrić', '10000000015', 'Sudac', { rang: 'Državni sudac', najvisaLiga: 'SuperSport Premijer liga' }),
  fieldOfficial('sudac5', 'Domagoj', 'Petrović', '10000000016', 'Sudac', { rang: 'Državni sudac', najvisaLiga: 'SuperSport Premijer liga' }),
  fieldOfficial('sudac6', 'Vedran', 'Jukić', '10000000017', 'Sudac', { rang: 'Državni sudac', najvisaLiga: 'PRVA MUŠKA LIGA' }),
  fieldOfficial('sudac7', 'Hrvoje', 'Tomljanović', '10000000018', 'Sudac', { rang: 'Županijski sudac', najvisaLiga: 'PRVA MUŠKA LIGA' }),
  fieldOfficial('sudac8', 'Igor', 'Barišić', '10000000019', 'Sudac', { rang: 'Županijski sudac', najvisaLiga: 'JUNIORI' }),
  fieldOfficial('sudac9', 'Krešimir', 'Grgić', '10000000020', 'Sudac', { rang: 'Županijski sudac', najvisaLiga: 'JUNIORI' }),
  fieldOfficial('sudac10', 'Mario', 'Posavec', '10000000021', 'Sudac', { rang: '', najvisaLiga: 'JUNIORI' }),
  fieldOfficial('delegat1', 'Ivana', 'Matić', '10000000010', 'Delegat', { najvisaLiga: 'PREMIJER ŽENSKA LIGA' }),
  fieldOfficial('delegat2', 'Davor', 'Knežević', '10000000011', 'Delegat', { najvisaLiga: 'SuperSport Premijer liga' }),
  fieldOfficial('delegat3', 'Sanja', 'Kralj', '10000000022', 'Delegat', { najvisaLiga: 'PRVA MUŠKA LIGA' }),
  fieldOfficial('delegat4', 'Boris', 'Herceg', '10000000023', 'Delegat', { najvisaLiga: 'JUNIORI' }),
  fieldOfficial('delegat5', 'Tatjana', 'Vidak', '10000000024', 'Delegat', { najvisaLiga: 'JUNIORI' }),
  fieldOfficial('pomocni1', 'Marin', 'Božić', '10000000012', 'Pomoćni Sudac', { rang: 'Državni sudac' }),
  fieldOfficial('pomocni2', 'Stipe', 'Vuković', '10000000013', 'Pomoćni Sudac', { rang: 'Županijski sudac' }),
  fieldOfficial('pomocni3', 'Karlo', 'Pavlović', '10000000014', 'Pomoćni Sudac', { rang: '' }),
  fieldOfficial('pomocni4', 'Tin', 'Rukavina', '10000000025', 'Pomoćni Sudac', { rang: 'Državni sudac' }),
  fieldOfficial('pomocni5', 'Bruno', 'Kovačević', '10000000026', 'Pomoćni Sudac', { rang: 'Županijski sudac' }),
  fieldOfficial('pomocni6', 'Dino', 'Šarić', '10000000027', 'Pomoćni Sudac', { rang: '' }),
  fieldOfficial('pomocni7', 'Patrik', 'Bilić', '10000000028', 'Pomoćni Sudac', { rang: 'Državni sudac' }),
  fieldOfficial('pomocni8', 'Ivan', 'Čolak', '10000000029', 'Pomoćni Sudac', { rang: 'Županijski sudac' }),
  fieldOfficial('pomocni9', 'Matej', 'Knez', '10000000030', 'Pomoćni Sudac', { rang: '' }),
  fieldOfficial('pomocni10', 'Fran', 'Jelić', '10000000031', 'Pomoćni Sudac', { rang: 'Državni sudac' }),
  fieldOfficial('kontrolor1', 'Zoran', 'Grubišić', '10000000032', 'Kontrolor', { najvisaLiga: 'SuperSport Premijer liga' }),
  fieldOfficial('kontrolor2', 'Alen', 'Mandić', '10000000033', 'Kontrolor', { najvisaLiga: 'SuperSport Premijer liga' }),
  fieldOfficial('kontrolor3', 'Darko', 'Škorić', '10000000034', 'Kontrolor', { najvisaLiga: 'SuperSport Premijer liga' })
);

const isAdmin = (user) =>
  user.role === 'Admin' || (user.roles || []).some((assignment) => assignment.name === 'Admin');

async function run() {
  await mongoose.connect(process.env.MONGO_URI, {
    serverApi: { version: '1', strict: true, deprecationErrors: true }
  });

  const allUsers = await User.find().select('_id username name surname role roles personalCode');
  const admins = allUsers.filter(isAdmin);
  const toDelete = allUsers.filter((user) => !isAdmin(user));

  if (!admins.length) {
    throw new Error('No Admin user found. Aborting.');
  }

  console.log('Keeping admins:', admins.map((user) => user.username).join(', '));
  console.log('Removing users:', toDelete.map((user) => user.username).join(', ') || '(none)');

  const deleteIds = toDelete.map((user) => user._id);
  const deleteCodes = toDelete.map((user) => user.personalCode);

  if (deleteIds.length) {
    await BasketballGame.updateMany(
      {},
      { $pull: { refereeAssignments: { userId: { $in: deleteIds } } } }
    );
    await Absence.deleteMany({ userPersonalCode: { $in: deleteCodes } });
    await TravelExpense.deleteMany({ userId: { $in: deleteIds } });
    await Notification.deleteMany({ userId: { $in: deleteIds } });
    await Kontrola.deleteMany({
      $or: [
        { createdBy: { $in: deleteIds } },
        { updatedBy: { $in: deleteIds } },
        { 'refereeGrades.refereeId': { $in: deleteIds } }
      ]
    });
    await ExamAttempt.deleteMany({ userId: { $in: deleteIds } });
    await User.deleteMany({ _id: { $in: deleteIds } });
  }

  const password = await bcrypt.hash(PASSWORD, 10);

  for (const entry of newUsers) {
    await User.create({
      username: entry.username,
      name: entry.name,
      surname: entry.surname,
      email: entry.email,
      password,
      birthdate: new Date('1990-01-15'),
      personalCode: entry.personalCode,
      address: 'Zagreb',
      roles: entry.roles,
      role: entry.roles[0].name,
      rang: entry.rang || '',
      najvisaLiga: entry.najvisaLiga || ''
    });
  }

  const remaining = await User.find().select('username name surname role roles rang najvisaLiga').sort({ role: 1, username: 1 });
  console.log('\nUsers now in database:');
  remaining.forEach((user) => {
    const competitions = (user.roles || [])
      .flatMap((assignment) => assignment.competitions || [])
      .join(', ');
    console.log(
      `- ${user.username.padEnd(12)} ${user.name} ${user.surname} | ${user.role}` +
      (user.rang ? ` | ${user.rang}` : '') +
      (user.najvisaLiga ? ` | ${user.najvisaLiga}` : '') +
      (competitions ? ` | ${competitions}` : '')
    );
  });
  console.log(`\nPassword for all new users: ${PASSWORD}`);

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
