const crypto = require('crypto');
const bcrypt = require('bcrypt');

const RESET_TTL_MS = 24 * 60 * 60 * 1000;

const hashToken = (token) =>
  crypto.createHash('sha256').update(String(token || '')).digest('hex');

const createResetToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MS)
  };
};

const frontendBaseUrl = () =>
  String(process.env.FRONTEND_URL || 'http://localhost:4200').replace(/\/$/, '');

const resetUrlForToken = (token) =>
  `${frontendBaseUrl()}/set-password?token=${encodeURIComponent(token)}`;

const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_POLICY_MESSAGE = 'Lozinka mora imati najmanje 10 znakova, slovo i broj.';

const passwordPolicyError = (password) => {
  const value = String(password || '');
  if (value.length < PASSWORD_MIN_LENGTH || !/\p{L}/u.test(value) || !/\d/.test(value)) {
    return PASSWORD_POLICY_MESSAGE;
  }
  return null;
};

const hashUnusablePassword = () => bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

const issuePasswordReset = async (user) => {
  const { token, tokenHash, expiresAt } = createResetToken();
  user.passwordResetTokenHash = tokenHash;
  user.passwordResetExpires = expiresAt;
  await user.save();
  const invite = {
    inviteUrl: resetUrlForToken(token),
    inviteExpiresAt: expiresAt.toISOString()
  };
  try {
    require('./notificationEmail').queueInviteEmail(user, invite.inviteUrl);
  } catch (error) {
    console.error('Invite email queue failed:', error.message);
  }
  return invite;
};

const clearPasswordReset = (user) => {
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  if (typeof user.set === 'function') {
    user.set('passwordResetTokenHash', undefined);
    user.set('passwordResetExpires', undefined);
  }
};

module.exports = {
  RESET_TTL_MS,
  hashToken,
  createResetToken,
  frontendBaseUrl,
  resetUrlForToken,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  passwordPolicyError,
  hashUnusablePassword,
  issuePasswordReset,
  clearPasswordReset
};
