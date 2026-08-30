const { FailedJob, Notification } = require('../models');
const { queues, queueEvents } = require('../queues');
const { CHANNELS } = require('../utils/channels');
const { bump } = require('../services/metrics.service');
const { logger } = require('../utils/logger');

function attachFailedJobHandlers() {
  for (const channel of CHANNELS) {
    queueEvents[channel].on('failed', async ({ jobId, failedReason, prev }) => {
      try {
        const job = await queues[channel].getJob(jobId);
        if (!job) return;
        const state = await job.getState();
        if (state !== 'failed') return;

        await FailedJob.create({
          jobId: String(job.id),
          queue: `notifications-${channel}`,
          notificationId: job.data.notificationId,
          userId: job.data.userId,
          channel,
          payload: job.data,
          error: failedReason || prev || 'Unknown failure',
          attempts: job.attemptsMade,
        });

        if (job.data.notificationId) {
          await Notification.updateDelivery(job.data.notificationId, channel, {
            status: 'failed',
            lastError: failedReason,
          });
        }

        await bump('deadletter:total');
        logger.warn({ jobId, channel, failedReason }, 'job moved to failed-job store');
      } catch (error) {
        logger.error({ err: error, jobId, channel }, 'failed-job handler error');
      }
    });
  }
}

module.exports = { attachFailedJobHandlers };
