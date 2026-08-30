const { Queue, QueueEvents } = require('bullmq');
const { queueConnection } = require('../config/redis');
const { CHANNELS, PRIORITY_SCORE } = require('../utils/channels');

const QUEUE_PREFIX = 'notifications';

function queueName(channel) {
  return `${QUEUE_PREFIX}-${channel}`;
}

const defaultJobOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};

const queues = {};
const queueEvents = {};

for (const channel of CHANNELS) {
  const name = queueName(channel);
  queues[channel] = new Queue(name, {
    connection: queueConnection,
    defaultJobOptions,
  });
  queueEvents[channel] = new QueueEvents(name, { connection: queueConnection.duplicate() });
}

function jobOptions({ priority = 'normal', delayMs = 0 } = {}) {
  const options = {
    priority: PRIORITY_SCORE[priority] || PRIORITY_SCORE.normal,
  };
  if (delayMs > 0) options.delay = delayMs;
  return options;
}

async function enqueueChannel(channel, payload, options = {}) {
  return queues[channel].add(`${channel}-delivery`, payload, jobOptions(options));
}

async function getQueueCounts() {
  const counts = {};
  for (const channel of CHANNELS) {
    counts[channel] = await queues[channel].getJobCounts(
      'wait',
      'active',
      'delayed',
      'completed',
      'failed',
      'paused'
    );
  }
  return counts;
}

async function retryFailedJob(channel, jobId) {
  const job = await queues[channel].getJob(jobId);
  if (!job) return null;
  await job.retry();
  return job;
}

async function closeQueues() {
  await Promise.all([
    ...Object.values(queues).map((queue) => queue.close()),
    ...Object.values(queueEvents).map((events) => events.close()),
  ]);
}

module.exports = {
  queues,
  queueEvents,
  defaultJobOptions,
  enqueueChannel,
  getQueueCounts,
  retryFailedJob,
  closeQueues,
  QUEUE_PREFIX,
  queueName,
};
