const { connectDb } = require('./config/db');
const { startWorkers, stopWorkers } = require('./workers');
const { closeQueues } = require('./queues');
const { queueConnection, limiterConnection, metricsConnection } = require('./config/redis');
const { logger } = require('./utils/logger');

async function main() {
  await connectDb();
  startWorkers();
  logger.info('standalone workers running');

  const shutdown = async (signal) => {
    logger.info({ signal }, 'workers shutting down');
    await stopWorkers();
    await closeQueues();
    await Promise.all([queueConnection.quit(), limiterConnection.quit(), metricsConnection.quit()]);
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  logger.error({ err: error }, 'worker startup error');
  process.exit(1);
});
