const { Router } = require('express');
const { FailedJob, DeliveryLog, Notification } = require('../models');
const { getQueueCounts, retryFailedJob, enqueueChannel } = require('../queues');
const { getCounters, setQueueDepth, registry } = require('../services/metrics.service');

const router = Router();

router.get('/metrics', async (_req, res, next) => {
  try {
    const [queues, counters, totals] = await Promise.all([
      getQueueCounts(),
      getCounters(),
      Notification.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    for (const [queue, states] of Object.entries(queues)) {
      for (const [state, value] of Object.entries(states)) {
        setQueueDepth(queue, state, value);
      }
    }

    res.json({
      queues,
      counters,
      notificationsByStatus: Object.fromEntries(totals.map((row) => [row._id, row.count])),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/prometheus', async (_req, res, next) => {
  try {
    res.set('Content-Type', registry.contentType);
    res.send(await registry.metrics());
  } catch (error) {
    next(error);
  }
});

router.get('/failed-jobs', async (req, res, next) => {
  try {
    const resolved = req.query.resolved === 'true';
    const items = await FailedJob.find(req.query.resolved ? { resolved } : {})
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit || 50));
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.post('/failed-jobs/:id/retry', async (req, res, next) => {
  try {
    const failed = await FailedJob.findById(req.params.id);
    if (!failed) return res.status(404).json({ error: 'Failed job not found' });

    let retried = await retryFailedJob(failed.channel, failed.jobId);
    if (!retried) {
      retried = await enqueueChannel(failed.channel, failed.payload, { priority: 'high' });
    }

    failed.retried = true;
    failed.retriedAt = new Date();
    failed.resolved = true;
    await failed.save();
    res.json({ failed, jobId: retried?.id });
  } catch (error) {
    next(error);
  }
});

router.get('/logs', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.channel) filter.channel = req.query.channel;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.userId) filter.userId = req.query.userId;
    const items = await DeliveryLog.find(filter).sort({ createdAt: -1 }).limit(Number(req.query.limit || 50));
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
