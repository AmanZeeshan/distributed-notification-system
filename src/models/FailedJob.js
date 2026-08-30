const mongoose = require('mongoose');

const failedJobSchema = new mongoose.Schema(
  {
    jobId: { type: String, required: true, index: true },
    queue: { type: String, required: true },
    notificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notification' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    channel: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    error: { type: String, required: true },
    attempts: { type: Number, required: true },
    retried: { type: Boolean, default: false },
    retriedAt: { type: Date },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

failedJobSchema.index({ createdAt: -1 });
failedJobSchema.index({ resolved: 1, createdAt: -1 });

module.exports = mongoose.model('FailedJob', failedJobSchema);
