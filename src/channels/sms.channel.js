const { v4: uuid } = require('uuid');
const { env } = require('../config/env');
const { logger } = require('../utils/logger');

function maybeFail() {
  if (Math.random() < env.simulatedFailureRate) {
    const error = new Error('Simulated SMS provider failure');
    error.retryable = true;
    throw error;
  }
}

async function sendSms({ user, payload }) {
  maybeFail();
  if (!user.phone) {
    const error = new Error('User has no phone number');
    error.retryable = false;
    throw error;
  }

  const rendered = payload.rendered?.sms || {};
  const body = rendered.body || payload.body || payload.title || '';
  const providerId = `sim-sms-${uuid()}`;

  logger.info({ to: user.phone, body, providerId }, 'sms simulated');
  return {
    providerId,
    providerResponse: { simulated: true, to: user.phone, body, segments: Math.ceil(body.length / 160) },
  };
}

module.exports = { sendSms };
