const { RateLimiterRedis } = require('rate-limiter-flexible');
const { limiterConnection } = require('../config/redis');
const { env } = require('../config/env');
const { CHANNELS } = require('../utils/channels');

const apiLimiter = new RateLimiterRedis({
  storeClient: limiterConnection,
  keyPrefix: 'rl:api',
  points: env.limits.apiPoints,
  duration: env.limits.apiDuration,
});

const userLimiter = new RateLimiterRedis({
  storeClient: limiterConnection,
  keyPrefix: 'rl:user',
  points: env.limits.userPoints,
  duration: env.limits.userDuration,
});

const channelLimiters = Object.fromEntries(
  CHANNELS.map((channel) => [
    channel,
    new RateLimiterRedis({
      storeClient: limiterConnection,
      keyPrefix: `rl:channel:${channel}`,
      points: env.limits.channels[channel],
      duration: 60,
    }),
  ])
);

function apiRateLimit(req, res, next) {
  const key = req.ip || 'anonymous';
  apiLimiter
    .consume(key)
    .then((result) => {
      res.set('X-RateLimit-Remaining', String(result.remainingPoints));
      next();
    })
    .catch((error) => {
      const retryAfter = Math.ceil((error.msBeforeNext || 1000) / 1000);
      res.set('Retry-After', String(retryAfter));
      res.status(429).json({ error: 'Too many requests', retryAfter });
    });
}

async function consumeUserLimit(userId) {
  try {
    await userLimiter.consume(String(userId));
    return { allowed: true };
  } catch (error) {
    return {
      allowed: false,
      retryAfter: Math.ceil((error.msBeforeNext || 1000) / 1000),
    };
  }
}

async function consumeChannelLimit(channel) {
  const limiter = channelLimiters[channel];
  try {
    await limiter.consume('global');
    return { allowed: true, delayMs: 0 };
  } catch (error) {
    return {
      allowed: false,
      delayMs: error.msBeforeNext || 1000,
    };
  }
}

module.exports = {
  apiRateLimit,
  consumeUserLimit,
  consumeChannelLimit,
};
