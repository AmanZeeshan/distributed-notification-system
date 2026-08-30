const mongoose = require('mongoose');
const { CHANNELS } = require('../utils/channels');

const deliveryLogSchema = new mongoose.Schema(
  {
    notificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notification', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    channel: { type: String, enum: CHANNELS, required: true },
    status: { type: String, enum: ['delivered', 'failed', 'skipped'], required: true },
    attempt: { type: Number, required: true },
    latencyMs: { type: Number, default: 0 },
    providerId: { type: String, default: '' },
    providerResponse: { type: mongoose.Schema.Types.Mixed, default: {} },
    error: { type: String, default: '' },
  },
  { timestamps: true }
);

deliveryLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('DeliveryLog', deliveryLogSchema);
