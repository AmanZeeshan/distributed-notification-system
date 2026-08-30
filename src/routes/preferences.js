const { Router } = require('express');
const { getOrCreate } = require('../services/preference.service');
const { validate } = require('../middleware/validate');
const { preferenceSchema } = require('./schemas');

const router = Router();

router.get('/:userId', async (req, res, next) => {
  try {
    const preference = await getOrCreate(req.params.userId);
    res.json({ preference });
  } catch (error) {
    next(error);
  }
});

router.put('/:userId', validate(preferenceSchema), async (req, res, next) => {
  try {
    const preference = await getOrCreate(req.params.userId);
    if (req.validated.body.channels) {
      preference.channels = { ...preference.channels.toObject?.() || preference.channels, ...req.validated.body.channels };
    }
    if (req.validated.body.categories) {
      for (const [category, flags] of Object.entries(req.validated.body.categories)) {
        const current = preference.categories.get(category) || {};
        preference.categories.set(category, { ...current, ...flags });
      }
    }
    if (req.validated.body.quietHours) {
      preference.quietHours = { ...preference.quietHours.toObject?.() || preference.quietHours, ...req.validated.body.quietHours };
    }
    await preference.save();
    res.json({ preference });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
