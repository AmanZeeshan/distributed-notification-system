const { DelayedError, UnrecoverableError } = require('bullmq');
const { Notification, DeliveryLog, User } = require('../models');
const { deliver } = require('../channels');
const { consumeChannelLimit } = require('../middleware/rateLimiter');
const { bump, observeJob } = require('../services/metrics.service');
const { logger } = require('../utils/logger');

async function processDelivery(job, token) {
  const started = Date.now();
  const { notificationId, channel } = job.data;
  let notification = await Notification.findById(notificationId);
  if (!notification) {
    logger.warn({ notificationId, channel, jobId: job.id }, 'notification missing; dropping job');
    return { skipped: true };
  }

  if (notification.status === 'cancelled') {
    await markSkipped(notification, channel, 'cancelled');
    return { skipped: true };
  }

  const user = await User.findById(notification.userId);
  if (!user) {
    const error = new Error('User no longer exists');
    error.retryable = false;
    throw error;
  }

  const rate = await consumeChannelLimit(channel);
  if (!rate.allowed) {
    await job.moveToDelayed(Date.now() + rate.delayMs, token);
    throw new DelayedError();
  }

  notification = await Notification.updateDelivery(notification._id, channel, {
    status: 'processing',
    attempts: job.attemptsMade + 1,
  });

  try {
    const result = await deliver(channel, { user, notification, payload: notification.payload });
    await Notification.updateDelivery(notification._id, channel, {
      status: 'delivered',
      providerId: result.providerId,
      sentAt: new Date(),
      lastError: '',
    });
    await DeliveryLog.create({
      notificationId: notification._id,
      userId: notification.userId,
      channel,
      status: 'delivered',
      attempt: job.attemptsMade + 1,
      latencyMs: Date.now() - started,
      providerId: result.providerId,
      providerResponse: result.providerResponse,
    });
    await bump(`${channel}:delivered`);
    observeJob(channel, 'delivered', (Date.now() - started) / 1000);
    logger.info({ notificationId, channel, jobId: job.id, attempt: job.attemptsMade + 1 }, 'delivery succeeded');
    return { delivered: true, providerId: result.providerId };
  } catch (error) {
    await Notification.updateDelivery(notification._id, channel, {
      status: job.attemptsMade + 1 >= (job.opts.attempts || 5) ? 'failed' : 'queued',
      lastError: error.message,
    });
    await DeliveryLog.create({
      notificationId: notification._id,
      userId: notification.userId,
      channel,
      status: 'failed',
      attempt: job.attemptsMade + 1,
      latencyMs: Date.now() - started,
      error: error.message,
    });
    await bump(`${channel}:failed`);
    observeJob(channel, 'failed', (Date.now() - started) / 1000);
    logger.error({ err: error, notificationId, channel, jobId: job.id }, 'delivery failed');
    if (error.retryable === false) {
      throw new UnrecoverableError(error.message);
    }
    throw error;
  }
}

async function markSkipped(notification, channel, reason) {
  await Notification.updateDelivery(notification._id, channel, {
    status: 'skipped',
    skippedReason: reason,
  });
}

module.exports = { processDelivery };
