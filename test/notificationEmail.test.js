const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  subjectForType,
  stripDecorations,
  linkForNotification,
  bodyForNotification
} = require('../utils/notificationEmail');
const { isMailConfigured } = require('../utils/mailer');

describe('notificationEmail', () => {
  it('mapira tip obavijesti na predmet maila', () => {
    assert.equal(subjectForType('GAME_ASSIGNMENT'), 'Nova nominacija');
    assert.equal(subjectForType('NOMINATION_EXPIRED'), 'Nominacija pala zbog neodziva');
    assert.equal(subjectForType('EXPENSE_REJECTED'), 'Putni nalog odbijen');
  });

  it('skida dekoracije iz in-app poruke', () => {
    assert.equal(
      stripDecorations('🏀 Nova nominacija: Split vs Zadar'),
      'Nova nominacija: Split vs Zadar'
    );
  });

  it('vodi na assigned ili expenses', () => {
    const previous = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = 'https://app.example';
    assert.equal(
      linkForNotification({ gameId: 'g1' }),
      'https://app.example/assigned'
    );
    assert.equal(
      linkForNotification({ travelExpenseId: 'e1' }),
      'https://app.example/expenses/e1'
    );
    if (previous === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = previous;
    }
  });

  it('u tijelu maila ima poruku i link', () => {
    const body = bodyForNotification({
      message: '✅ Odobreno',
      travelExpenseId: 'e1'
    });
    assert.match(body, /Odobreno/);
    assert.match(body, /expenses\/e1/);
    assert.equal(body.includes('✅'), false);
  });

  it('bez SMTP_HOST i MAIL_FROM nije konfiguriran', () => {
    const host = process.env.SMTP_HOST;
    const from = process.env.MAIL_FROM;
    delete process.env.SMTP_HOST;
    delete process.env.MAIL_FROM;
    assert.equal(isMailConfigured(), false);
    if (host !== undefined) process.env.SMTP_HOST = host;
    if (from !== undefined) process.env.MAIL_FROM = from;
  });
});
