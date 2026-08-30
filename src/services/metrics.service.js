const client = require('prom-client');
const { metricsConnection } = require('../config/redis');

const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

const jobsEnqueued = new client.Counter({
  name: 'notifications_enqueued_total',
  help: 'Notifications enqueued by channel',
  labelNames: ['channel'],
  registers: [registry],
});

const jobsProcessed = new client.Counter({
  name: 'notifications_processed_total',
  help: 'Notification jobs processed by channel and result',
  labelNames: ['channel', 'result'],
  registers: [registry],
});

const jobDuration = new client.Histogram({
  name: 'notifications_job_duration_seconds',
  help: 'Worker processing time',
  labelNames: ['channel'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [registry],
});

const queueDepth = new client.Gauge({
  name: 'notifications_queue_depth',
  help: 'BullMQ queue depth by state',
  labelNames: ['queue', 'state'],
  registers: [registry],
});

async function bump(key, amount = 1) {
  await metricsConnection.hincrby('metrics:counters', key, amount);
}

async function getCounters() {
  const raw = await metricsConnection.hgetall('metrics:counters');
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Number(value)]));
}

function observeJob(channel, result, seconds) {
  jobsProcessed.inc({ channel, result });
  jobDuration.observe({ channel }, seconds);
}

function observeEnqueue(channel) {
  jobsEnqueued.inc({ channel });
}

function setQueueDepth(queue, state, value) {
  queueDepth.set({ queue, state }, value);
}

module.exports = {
  registry,
  bump,
  getCounters,
  observeJob,
  observeEnqueue,
  setQueueDepth,
};
