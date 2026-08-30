const mongoose = require('mongoose');
const { env } = require('./env');
const { logger } = require('../utils/logger');

async function connectDb() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri);
  logger.info({ mongoUri: env.mongoUri }, 'connected to mongodb');
}

async function disconnectDb() {
  await mongoose.disconnect();
}

module.exports = { connectDb, disconnectDb };
