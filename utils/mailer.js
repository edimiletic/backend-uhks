const nodemailer = require('nodemailer');

const isMailConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM);

let transporter;

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

const sendMail = async ({ to, subject, text }) => {
  if (!to || !subject || !text) {
    return { sent: false, reason: 'incomplete' };
  }
  const transport = getTransporter();
  if (!transport) {
    console.warn('Mail skipped (SMTP_HOST/MAIL_FROM nisu učitani). Restartaj API nakon izmjene .env.');
    return { sent: false, reason: 'not-configured' };
  }
  await transport.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    text
  });
  console.log(`Mail sent: ${subject} -> ${to}`);
  return { sent: true };
};

module.exports = {
  isMailConfigured,
  sendMail
};
