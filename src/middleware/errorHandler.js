const { logger } = require('../utils/logger');

function notFound(req, res) {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
}

function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  logger.error({ err, requestId: req.id, path: req.originalUrl }, err.message);
  res.status(status).json({
    error: err.message || 'Internal server error',
    requestId: req.id,
  });
}

module.exports = { notFound, errorHandler };
