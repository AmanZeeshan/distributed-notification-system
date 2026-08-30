const { Router } = require('express');
const { User } = require('../models');
const { getOrCreate } = require('../services/preference.service');
const { validate } = require('../middleware/validate');
const { userSchema } = require('./schemas');

const router = Router();

router.post('/', validate(userSchema), async (req, res, next) => {
  try {
    const user = await User.create(req.validated.body);
    await getOrCreate(user._id);
    res.status(201).json({ user });
  } catch (error) {
    if (error.code === 11000) {
      error.status = 409;
      error.message = 'Email already registered';
    }
    next(error);
  }
});

router.get('/', async (_req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
