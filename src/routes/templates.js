const { Router } = require('express');
const { Template } = require('../models');
const { validate } = require('../middleware/validate');
const { templateSchema } = require('./schemas');

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const templates = await Template.find().sort({ slug: 1 });
    res.json({ templates });
  } catch (error) {
    next(error);
  }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const template = await Template.findOne({ slug: req.params.slug });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json({ template });
  } catch (error) {
    next(error);
  }
});

router.post('/', validate(templateSchema), async (req, res, next) => {
  try {
    const template = await Template.create(req.validated.body);
    res.status(201).json({ template });
  } catch (error) {
    if (error.code === 11000) {
      error.status = 409;
      error.message = 'Template slug already exists';
    }
    next(error);
  }
});

router.put('/:slug', validate(templateSchema), async (req, res, next) => {
  try {
    const template = await Template.findOneAndUpdate(
      { slug: req.params.slug },
      req.validated.body,
      { new: true }
    );
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json({ template });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
