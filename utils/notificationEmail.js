const User = require('../models/User');
const { frontendBaseUrl } = require('./passwordReset');
const { sendMail } = require('./mailer');

const SUBJECTS = {
  GAME_ASSIGNMENT: 'Nova nominacija',
  ASSIGNMENT_RESPONSE: 'Odgovor na nominaciju',
  ASSIGNMENT_RELEASED: 'Nominacija povučena',
  GAME_SCHEDULE_CHANGED: 'Promjena termina utakmice',
  ASSIGNMENT_REMOVED: 'Nominacija povučena',
  COLLEAGUE_REPLACED: 'Promjena na utakmici',
  NOMINATION_EXPIRED: 'Nominacija pala zbog neodziva',
  EXPENSE_APPROVED: 'Putni nalog odobren',
  EXPENSE_REJECTED: 'Putni nalog odbijen',
  GAME_CREATED: 'Nova utakmica za nominacije'
};

const stripDecorations = (value) =>
  String(value || '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

const subjectForType = (type) => SUBJECTS[type] || 'Obavijest UHKS nominacije';

const linkForNotification = (doc) => {
  const base = frontendBaseUrl();
  if (doc.travelExpenseId) {
    return `${base}/expenses/${doc.travelExpenseId}`;
  }
  if (doc.gameId) {
    return `${base}/assigned`;
  }
  return base;
};

const bodyForNotification = (doc) => {
  const message = stripDecorations(doc.message);
  const link = linkForNotification(doc);
  return `${message}\n\nOtvori u aplikaciji: ${link}\n`;
};

const queueNotificationEmail = (doc) => {
  if (!doc || !doc.userId) {
    return;
  }
  setImmediate(() => {
    deliverNotificationEmail(doc).catch((error) => {
      console.error('Notification email failed:', error.message);
    });
  });
};

const deliverNotificationEmail = async (doc) => {
  const user = await User.findById(doc.userId).select('email name surname');
  if (!user || !user.email) {
    return { sent: false, reason: 'no-user' };
  }
  return sendMail({
    to: user.email,
    subject: subjectForType(doc.type),
    text: bodyForNotification(doc)
  });
};

const queueInviteEmail = (user, inviteUrl) => {
  if (!user || !user.email || !inviteUrl) {
    return;
  }
  setImmediate(() => {
    sendMail({
      to: user.email,
      subject: 'Postavi lozinku — UHKS nominacije',
      text:
        `Pozdrav${user.name ? ` ${user.name}` : ''},\n\n` +
        `Admin ti je otvorio račun u sustavu nominacija. Postavi lozinku na ovom linku (vrijedi 24 sata):\n\n` +
        `${inviteUrl}\n`
    }).catch((error) => {
      console.error('Invite email failed:', error.message);
    });
  });
};

module.exports = {
  SUBJECTS,
  stripDecorations,
  subjectForType,
  linkForNotification,
  bodyForNotification,
  queueNotificationEmail,
  deliverNotificationEmail,
  queueInviteEmail
};
