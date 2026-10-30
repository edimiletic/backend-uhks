const DEMO_USERNAMES = [
  'pnat1', 'pnat2', 'psluz1', 'psluz2',
  'sudac1', 'sudac2', 'sudac3', 'sudac4', 'sudac5',
  'sudac6', 'sudac7', 'sudac8', 'sudac9', 'sudac10',
  'delegat1', 'delegat2', 'delegat3', 'delegat4', 'delegat5',
  'kontrolor1', 'kontrolor2', 'kontrolor3'
];

const isDemoUsername = (username) =>
  DEMO_USERNAMES.includes(String(username || '').trim().toLowerCase());

module.exports = { DEMO_USERNAMES, isDemoUsername };
