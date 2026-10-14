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

const passwordPolicyError = (password) => {
  if (!password || String(password).length < 8) {
    return 'Lozinka mora imati najmanje 8 znakova.';
  }
  return null;
};

const hashUnusablePassword = () => bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

const issuePasswordReset = async (user) => {
  const { token, tokenHash, expiresAt } = createResetToken();
  user.passwordResetTokenHash = tokenHash;
  user.passwordResetExpires = expiresAt;
  await user.save();
  return {
    inviteUrl: resetUrlForToken(token),
    inviteExpiresAt: expiresAt.toISOString()
  };
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
  passwordPolicyError,
  hashUnusablePassword,
  issuePasswordReset,
  clearPasswordReset
};
