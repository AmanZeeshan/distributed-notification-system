const mongoose = require('mongoose');
const { CATEGORIES } = require('../utils/channels');

const templateSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    category: { type: String, enum: CATEGORIES, default: 'transactional' },
    description: { type: String, default: '' },
    channels: {
      email: {
        subject: { type: String, default: '' },
        html: { type: String, default: '' },
        text: { type: String, default: '' },
      },
      push: {
        title: { type: String, default: '' },
        body: { type: String, default: '' },
      },
      sms: {
        body: { type: String, default: '' },
      },
      inapp: {
        title: { type: String, default: '' },
        body: { type: String, default: '' },
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Template', templateSchema);
