const { User, Notification } = require('../models');
const { enqueueChannel } = require('../queues');
const { consumeUserLimit } = require('../middleware/rateLimiter');
const { getOrCreate, resolveChannels } = require('./preference.service');
const { renderTemplate } = require('./template.service');
const { observeEnqueue, bump } = require('./metrics.service');
const { CHANNELS } = require('../utils/channels');
const { logger } = require('../utils/logger');

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function sendNotification(input) {
  const user = await User.findById(input.userId);
  if (!user) throw httpError(404, 'User not found');

  if (input.idempotencyKey) {
    const existing = await Notification.findOne({
      userId: user._id,
      idempotencyKey: input.idempotencyKey,
    });
    if (existing) return { notification: existing, deduped: true };
  }

  const userLimit = await consumeUserLimit(user._id);
  if (!userLimit.allowed) {
    throw httpError(429, `User send rate limit exceeded. Retry after ${userLimit.retryAfter}s`);
  }

  let category = input.category || 'transactional';
  let payload = {
    subject: input.subject || '',
    title: input.title || '',
    body: input.body || '',
    html: input.html || '',
    data: input.data || {},
    rendered: {},
  };
  let templateSlug = '';

  if (input.templateSlug) {
    const rendered = await renderTemplate(input.templateSlug, {
      user: { name: user.name, email: user.email, phone: user.phone },
      ...(input.data || {}),
    });
    templateSlug = rendered.template.slug;
    category = input.category || rendered.category;
    payload = {
      ...payload,
      ...rendered.fallback,
      data: input.data || {},
      rendered: rendered.rendered,
    };
  }

  const preference = await getOrCreate(user._id);
  const requested = input.channels?.length ? input.channels : CHANNELS;
  const decision = resolveChannels(preference, {
    requested,
    category,
    priority: input.priority || 'normal',
  });

  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  const now = Date.now();
  const scheduleDelay = scheduledAt && scheduledAt.getTime() > now ? scheduledAt.getTime() - now : 0;
  const quietDelay = decision.delayUntil ? Math.max(0, decision.delayUntil.getTime() - now) : 0;
  const delayMs = Math.max(scheduleDelay, quietDelay);
  const initialStatus = delayMs > 0 ? 'scheduled' : 'queued';

  const deliveries = [
    ...decision.allowed.map((channel) => ({ channel, status: 'queued' })),
    ...decision.skipped.map((item) => ({
      channel: item.channel,
      status: 'skipped',
      skippedReason: item.reason,
    })),
  ];

  const notification = await Notification.create({
    userId: user._id,
    templateSlug,
    category,
    priority: input.priority || 'normal',
    channels: requested,
    payload,
    status: decision.allowed.length ? initialStatus : 'failed',
    scheduledAt: delayMs > 0 ? new Date(now + delayMs) : undefined,
    idempotencyKey: input.idempotencyKey || undefined,
    deliveries,
  });

  for (const channel of decision.allowed) {
    await enqueueChannel(
      channel,
      {
        notificationId: String(notification._id),
        userId: String(user._id),
        channel,
      },
      { priority: notification.priority, delayMs }
    );
    observeEnqueue(channel);
    await bump(`${channel}:enqueued`);
  }

  logger.info(
    {
      notificationId: notification._id,
      userId: user._id,
      channels: decision.allowed,
      skipped: decision.skipped,
      delayMs,
    },
    'notification accepted'
  );

  return { notification, deduped: false };
}

async function cancelNotification(id) {
  const notification = await Notification.findById(id);
  if (!notification) throw httpError(404, 'Notification not found');
  if (['delivered', 'failed', 'cancelled'].includes(notification.status)) {
    throw httpError(409, `Cannot cancel a ${notification.status} notification`);
  }
  notification.status = 'cancelled';
  notification.cancelledAt = new Date();
  for (const delivery of notification.deliveries) {
    if (['queued', 'processing'].includes(delivery.status)) {
      delivery.status = 'skipped';
      delivery.skippedReason = 'cancelled';
    }
  }
  await notification.save();
  return notification;
}

async function sendBatch(items) {
  const results = [];
  for (const item of items) {
    try {
      const result = await sendNotification(item);
      results.push({ ok: true, notification: result.notification, deduped: result.deduped });
    } catch (error) {
      results.push({ ok: false, error: error.message, status: error.status || 500 });
    }
  }
  return results;
}

module.exports = {
  sendNotification,
  cancelNotification,
  sendBatch,
};
