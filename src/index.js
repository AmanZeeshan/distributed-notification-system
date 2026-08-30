const { env } = require('./config/env');
const { connectDb } = require('./config/db');
const { createApp } = require('./app');
const { startWorkers, stopWorkers } = require('./workers');
const { closeQueues } = require('./queues');
const { queueConnection, limiterConnection, metricsConnection } = require('./config/redis');
const { logger } = require('./utils/logger');

async function main() {
  await connectDb();
  if (env.runWorkers) startWorkers();

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info({ port: env.port, workers: env.runWorkers }, 'notification api listening');
  });

  const shutdown = async (signal) => {
    logger.info({ signal }, 'shutting down');
    server.close();
    if (env.runWorkers) await stopWorkers();
    await closeQueues();
    await Promise.all([queueConnection.quit(), limiterConnection.quit(), metricsConnection.quit()]);
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  logger.error({ err: error }, 'fatal startup error');
  process.exit(1);
});
