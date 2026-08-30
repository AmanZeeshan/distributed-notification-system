const mongoose = require('mongoose');
const { CHANNELS, CATEGORIES, PRIORITIES } = require('../utils/channels');

const deliverySchema = new mongoose.Schema(
  {
    channel: { type: String, enum: CHANNELS, required: true },
    status: {
      type: String,
      enum: ['queued', 'processing', 'delivered', 'failed', 'skipped'],
      default: 'queued',
    },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: '' },
    providerId: { type: String, default: '' },
    sentAt: { type: Date },
    skippedReason: { type: String, default: '' },
  },
  { _id: false }
);

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    templateSlug: { type: String, default: '' },
    category: { type: String, enum: CATEGORIES, default: 'transactional' },
    priority: { type: String, enum: PRIORITIES, default: 'normal' },
    channels: [{ type: String, enum: CHANNELS }],
    payload: {
      subject: { type: String, default: '' },
      title: { type: String, default: '' },
      body: { type: String, default: '' },
      html: { type: String, default: '' },
      data: { type: mongoose.Schema.Types.Mixed, default: {} },
      rendered: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    status: {
      type: String,
      enum: ['queued', 'scheduled', 'processing', 'partial', 'delivered', 'failed', 'cancelled'],
      default: 'queued',
      index: true,
    },
    scheduledAt: { type: Date },
    cancelledAt: { type: Date },
    idempotencyKey: { type: String, index: true, sparse: true },
    deliveries: { type: [deliverySchema], default: [] },
    readAt: { type: Date },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

function computeStatus(deliveries, current = 'queued') {
  if (current === 'cancelled') return 'cancelled';
  const active = deliveries.filter((item) => item.status !== 'skipped');
  if (!active.length) return 'failed';
  const delivered = active.filter((item) => item.status === 'delivered').length;
  const failed = active.filter((item) => item.status === 'failed').length;
  const pending = active.filter((item) => ['queued', 'processing'].includes(item.status)).length;
  if (pending) return current === 'scheduled' ? 'scheduled' : 'processing';
  if (delivered && failed) return 'partial';
  if (delivered) return 'delivered';
  return 'failed';
}

notificationSchema.methods.recomputeStatus = function recomputeStatus() {
  this.status = computeStatus(this.deliveries, this.status);
  return this.status;
};

notificationSchema.statics.updateDelivery = async function updateDelivery(id, channel, patch) {
  const set = Object.fromEntries(
    Object.entries(patch).map(([key, value]) => [`deliveries.$[d].${key}`, value])
  );
  await this.updateOne({ _id: id }, { $set: set }, { arrayFilters: [{ 'd.channel': channel }] });
  await this.recomputeStatusAtomic(id);
  return this.findById(id);
};

notificationSchema.statics.recomputeStatusAtomic = async function recomputeStatusAtomic(id) {
  await this.updateOne({ _id: id, status: { $ne: 'cancelled' } }, [
    {
      $set: {
        status: {
          $let: {
            vars: {
              active: {
                $filter: { input: '$deliveries', as: 'item', cond: { $ne: ['$$item.status', 'skipped'] } },
              },
            },
            in: {
              $cond: [
                { $eq: [{ $size: '$$active' }, 0] },
                'failed',
                {
                  $let: {
                    vars: {
                      delivered: {
                        $size: {
                          $filter: { input: '$$active', as: 'item', cond: { $eq: ['$$item.status', 'delivered'] } },
                        },
                      },
                      failed: {
                        $size: {
                          $filter: { input: '$$active', as: 'item', cond: { $eq: ['$$item.status', 'failed'] } },
                        },
                      },
                      pending: {
                        $size: {
                          $filter: {
                            input: '$$active',
                            as: 'item',
                            cond: { $in: ['$$item.status', ['queued', 'processing']] },
                          },
                        },
                      },
                    },
                    in: {
                      $switch: {
                        branches: [
                          { case: { $gt: ['$$pending', 0] }, then: 'processing' },
                          {
                            case: { $and: [{ $gt: ['$$delivered', 0] }, { $gt: ['$$failed', 0] }] },
                            then: 'partial',
                          },
                          { case: { $gt: ['$$delivered', 0] }, then: 'delivered' },
                        ],
                        default: 'failed',
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
    },
  ]);
};

module.exports = mongoose.model('Notification', notificationSchema);
