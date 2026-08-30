const IORedis = require('ioredis');
const { env } = require('./env');
const { logger } = require('../utils/logger');

function createRedis(name) {
  const client = new IORedis(env.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  client.on('error', (error) => {
    logger.error({ err: error, redis: name }, 'redis error');
  });

  client.on('connect', () => {
    logger.info({ redis: name }, 'redis connected');
  });

  return client;
}

const queueConnection = createRedis('queues');
const limiterConnection = createRedis('limiter');
const metricsConnection = createRedis('metrics');

module.exports = {
  queueConnection,
  limiterConnection,
  metricsConnection,
  createRedis,
};
