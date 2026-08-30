const { EventEmitter } = require('events');
const { v4: uuid } = require('uuid');
const { logger } = require('../utils/logger');

const hub = new EventEmitter();
hub.setMaxListeners(0);

async function sendInApp({ user, notification, payload }) {
  const rendered = payload.rendered?.inapp || {};
  const event = {
    id: String(notification._id),
    userId: String(user._id),
    title: rendered.title || payload.title || 'Notification',
    body: rendered.body || payload.body || '',
    category: notification.category,
    createdAt: notification.createdAt,
    readAt: notification.readAt || null,
  };

  hub.emit(String(user._id), event);
  const providerId = `inapp-${uuid()}`;
  logger.info({ userId: user._id, notificationId: notification._id, providerId }, 'in-app notification stored');
  return { providerId, providerResponse: { stored: true } };
}

function subscribe(userId, listener) {
  hub.on(userId, listener);
  return () => hub.off(userId, listener);
}

module.exports = { sendInApp, subscribe };
