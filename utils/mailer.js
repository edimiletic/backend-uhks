const nodemailer = require('nodemailer');

const isMailConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM);

const minIntervalMs = () => Math.max(0, Number(process.env.SMTP_MIN_INTERVAL_MS || 0));

const isRateLimitedError = (error) =>
  /too many emails|rate limit|550 5\.7\.0/i.test(String(error && error.message));

let transporter;
let sendQueue = Promise.resolve();
let lastSendAt = 0;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getTransporter = () => {
  if (!isMailConfigured()) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || '') === 'true',
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        : undefined
    });
  }
  return transporter;
};

const sendWithRetry = async (transport, mail, attempt = 0) => {
  const wait = lastSendAt + minIntervalMs() - Date.now();
  if (wait > 0) {
    await delay(wait);
  }
  try {
    await transport.sendMail(mail);
    lastSendAt = Date.now();
    console.log(`Mail sent: ${mail.subject} -> ${mail.to}`);
    return { sent: true };
  } catch (error) {
    lastSendAt = Date.now();
    if (isRateLimitedError(error) && attempt < 5) {
      await delay(minIntervalMs() * (attempt + 2));
      return sendWithRetry(transport, mail, attempt + 1);
    }
    throw error;
  }
};

const sendMail = async ({ to, subject, text }) => {
  if (!to || !subject || !text) {
    return { sent: false, reason: 'incomplete' };
  }
  const transport = getTransporter();
  if (!transport) {
    console.warn('Mail skipped (SMTP_HOST/MAIL_FROM nisu učitani). Restartaj API nakon izmjene .env.');
    return { sent: false, reason: 'not-configured' };
  }

  const mail = {
    from: process.env.MAIL_FROM,
    to,
    subject,
    text
  };

  const result = sendQueue.then(() => sendWithRetry(transport, mail));
  sendQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
};

module.exports = {
  isMailConfigured,
  isRateLimitedError,
  sendMail
};
