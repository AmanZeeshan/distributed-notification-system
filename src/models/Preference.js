const mongoose = require('mongoose');
const { CHANNELS, CATEGORIES } = require('../utils/channels');

const channelFlags = CHANNELS.reduce((acc, channel) => {
  acc[channel] = { type: Boolean, default: true };
  return acc;
}, {});

const preferenceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    channels: channelFlags,
    categories: {
      type: Map,
      of: new mongoose.Schema(channelFlags, { _id: false }),
      default: () =>
        CATEGORIES.reduce((acc, category) => {
          acc[category] = CHANNELS.reduce((flags, channel) => {
            flags[channel] = true;
            return flags;
          }, {});
          return acc;
        }, {}),
    },
    quietHours: {
      enabled: { type: Boolean, default: false },
      start: { type: String, default: '22:00' },
      end: { type: String, default: '07:00' },
      timezone: { type: String, default: 'UTC' },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Preference', preferenceSchema);
