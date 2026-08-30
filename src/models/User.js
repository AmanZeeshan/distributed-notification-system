const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true },
    platform: { type: String, enum: ['ios', 'android', 'web'], default: 'web' },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '' },
    deviceTokens: { type: [deviceTokenSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
