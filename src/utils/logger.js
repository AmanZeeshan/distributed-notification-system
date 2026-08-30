const winston = require('winston');
const { env } = require('../config/env');

const base = winston.createLogger({
  level: env.logLevel,
  defaultMeta: { service: 'notification-service' },
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

function wrap(level) {
  return (arg1, arg2) => {
    if (typeof arg1 === 'string') return base[level](arg1, arg2);
    if (arg1 instanceof Error) return base[level](arg1.message, { err: arg1, ...(arg2 || {}) });
    if (typeof arg2 === 'string') return base[level]({ ...arg1, message: arg2 });
    return base[level](arg1);
  };
}

const logger = {
  debug: wrap('debug'),
  info: wrap('info'),
  warn: wrap('warn'),
  error: wrap('error'),
};

module.exports = { logger };
