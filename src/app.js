const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { apiRateLimit } = require('./middleware/rateLimiter');
const { requestId, httpLogger } = require('./middleware/requestLogger');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const notifications = require('./routes/notifications');
const users = require('./routes/users');
const preferences = require('./routes/preferences');
const templates = require('./routes/templates');
const inbox = require('./routes/inbox');
const admin = require('./routes/admin');
const health = require('./routes/health');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(compression({
    filter: (req, res) => {
      if (req.path.includes('/stream')) return false;
      return compression.filter(req, res);
    },
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestId);
  app.use(httpLogger);
  app.use(apiRateLimit);

  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use('/health', health);
  app.use('/api/notifications', notifications);
  app.use('/api/users', users);
  app.use('/api/preferences', preferences);
  app.use('/api/templates', templates);
  app.use('/api/inbox', inbox);
  app.use('/api/admin', admin);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
