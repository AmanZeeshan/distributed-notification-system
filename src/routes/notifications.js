const { Router } = require('express');
const { Notification } = require('../models');
const { sendNotification, cancelNotification, sendBatch } = require('../services/notification.service');
const { validate } = require('../middleware/validate');
const { sendNotificationSchema, batchSchema } = require('./schemas');

const router = Router();

router.post('/', validate(sendNotificationSchema), async (req, res, next) => {
  try {
    const result = await sendNotification(req.validated.body);
    res.status(result.deduped ? 200 : 202).json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/batch', validate(batchSchema), async (req, res, next) => {
  try {
    const results = await sendBatch(req.validated.body.notifications);
    res.status(202).json({ results });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { userId, status, limit = 20 } = req.query;
    const filter = {};
    if (userId) filter.userId = userId;
    if (status) filter.status = status;
    const items = await Notification.find(filter).sort({ createdAt: -1 }).limit(Number(limit));
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json({ notification });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const notification = await cancelNotification(req.params.id);
    res.json({ notification });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
