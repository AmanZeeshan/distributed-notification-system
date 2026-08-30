require('dotenv').config();

function number(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: number('PORT', 3000),
  logLevel: process.env.LOG_LEVEL || 'info',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/notifications',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  runWorkers: (process.env.RUN_WORKERS || 'true') !== 'false',
  simulatedFailureRate: number('SIMULATED_FAILURE_RATE', 0.08),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: number('SMTP_PORT', 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@notifications.local',
  },
  limits: {
    userPoints: number('USER_RATE_LIMIT_POINTS', 30),
    userDuration: number('USER_RATE_LIMIT_DURATION', 60),
    apiPoints: number('API_RATE_LIMIT_POINTS', 120),
    apiDuration: number('API_RATE_LIMIT_DURATION', 60),
    channels: {
      email: number('EMAIL_RATE_LIMIT', 80),
      push: number('PUSH_RATE_LIMIT', 200),
      sms: number('SMS_RATE_LIMIT', 20),
      inapp: number('INAPP_RATE_LIMIT', 400),
    },
  },
};

module.exports = { env };
