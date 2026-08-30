const nodemailer = require('nodemailer');
const { v4: uuid } = require('uuid');
const { env } = require('../config/env');
const { logger } = require('../utils/logger');

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  if (!env.smtp.host) return null;
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
  return transporter;
}

function maybeFail(channel) {
  if (Math.random() < env.simulatedFailureRate) {
    const error = new Error(`Simulated ${channel} provider failure`);
    error.retryable = true;
    throw error;
  }
}

async function sendEmail({ user, payload }) {
  maybeFail('email');
  const rendered = payload.rendered?.email || {};
  const message = {
    from: env.smtp.from,
    to: user.email,
    subject: rendered.subject || payload.subject || payload.title || 'Notification',
    text: rendered.text || payload.body || '',
    html: rendered.html || payload.html || `<p>${payload.body || ''}</p>`,
  };

  const smtp = getTransporter();
  if (smtp) {
    const info = await smtp.sendMail(message);
    logger.info({ to: user.email, messageId: info.messageId }, 'email sent via smtp');
    return { providerId: info.messageId, providerResponse: { accepted: info.accepted } };
  }

  const providerId = `sim-email-${uuid()}`;
  logger.info({ to: user.email, subject: message.subject, providerId }, 'email simulated');
  return {
    providerId,
    providerResponse: { simulated: true, to: user.email, subject: message.subject },
  };
}

module.exports = { sendEmail };
