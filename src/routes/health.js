const { Router } = require('express');
const mongoose = require('mongoose');
const { limiterConnection } = require('../config/redis');

const router = Router();

router.get('/', async (_req, res) => {
  const mongo = mongoose.connection.readyState === 1 ? 'up' : 'down';
  let redis = 'down';
  try {
    redis = (await limiterConnection.ping()) === 'PONG' ? 'up' : 'down';
  } catch (_error) {
    redis = 'down';
  }

  const healthy = mongo === 'up' && redis === 'up';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    checks: { mongo, redis },
    uptime: process.uptime(),
  });
});

module.exports = router;
