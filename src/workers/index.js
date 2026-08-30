const { Worker } = require('bullmq');
const { queueConnection } = require('../config/redis');
const { CHANNELS } = require('../utils/channels');
const { queueName, defaultJobOptions } = require('../queues');
const { processDelivery } = require('./processor');
const { attachFailedJobHandlers } = require('./failedJob.handler');
const { logger } = require('../utils/logger');

const workers = [];

function startWorkers() {
  for (const channel of CHANNELS) {
    const worker = new Worker(queueName(channel), processDelivery, {
      connection: queueConnection,
      concurrency: channel === 'sms' ? 4 : 8,
    });

    worker.on('error', (error) => {
      logger.error({ err: error, channel }, 'worker error');
    });

    workers.push(worker);
    logger.info({ channel, attempts: defaultJobOptions.attempts }, 'worker started');
  }

  attachFailedJobHandlers();
  return workers;
}

async function stopWorkers() {
  await Promise.all(workers.map((worker) => worker.close()));
}

module.exports = { startWorkers, stopWorkers };
