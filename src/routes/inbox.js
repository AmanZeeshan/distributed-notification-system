const { Router } = require('express');
const { Notification } = require('../models');
const { subscribe } = require('../channels/inapp.channel');

const router = Router();

router.get('/:userId', async (req, res, next) => {
  try {
    const { unread, limit = 50 } = req.query;
    const filter = {
      userId: req.params.userId,
      'deliveries.channel': 'inapp',
      'deliveries.status': 'delivered',
    };
    if (unread === 'true') filter.readAt = { $exists: false };
    const items = await Notification.find(filter).sort({ createdAt: -1 }).limit(Number(limit));
    const unreadCount = await Notification.countDocuments({
      userId: req.params.userId,
      'deliveries.channel': 'inapp',
      'deliveries.status': 'delivered',
      readAt: { $exists: false },
    });
    res.json({ items, unreadCount });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/read', async (req, res, next) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { readAt: new Date() },
      { new: true }
    );
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json({ notification });
  } catch (error) {
    next(error);
  }
});

router.get('/:userId/stream', async (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders?.();
  res.write(`event: ready\ndata: ${JSON.stringify({ userId: req.params.userId })}\n\n`);

  const unsubscribe = subscribe(req.params.userId, (event) => {
    res.write(`event: notification\ndata: ${JSON.stringify(event)}\n\n`);
  });

  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

module.exports = router;
