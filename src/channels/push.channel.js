const { v4: uuid } = require('uuid');
const { env } = require('../config/env');
const { logger } = require('../utils/logger');

function maybeFail() {
  if (Math.random() < env.simulatedFailureRate) {
    const error = new Error('Simulated push provider failure');
    error.retryable = true;
    throw error;
  }
}

async function sendPush({ user, payload }) {
  maybeFail();
  const tokens = (user.deviceTokens || []).map((item) => item.token);
  if (!tokens.length) {
    const error = new Error('No device tokens registered');
    error.retryable = false;
    throw error;
  }

  const rendered = payload.rendered?.push || {};
  const providerId = `sim-push-${uuid()}`;
  const message = {
    title: rendered.title || payload.title || 'Notification',
    body: rendered.body || payload.body || '',
    data: payload.data || {},
  };

  logger.info({ userId: user._id, tokens: tokens.length, providerId, title: message.title }, 'push simulated');
  return {
    providerId,
    providerResponse: { simulated: true, tokens, message },
  };
}

module.exports = { sendPush };
