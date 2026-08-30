const { v4: uuid } = require('uuid');
const morgan = require('morgan');
const { logger } = require('../utils/logger');

function requestId(req, res, next) {
  req.id = req.headers['x-request-id'] || uuid();
  res.setHeader('X-Request-Id', req.id);
  next();
}

morgan.token('id', (req) => req.id);

const httpLogger = morgan(':id :method :url :status :response-time ms', {
  stream: {
    write: (message) => logger.info({ type: 'http' }, message.trim()),
  },
});

module.exports = { requestId, httpLogger };
