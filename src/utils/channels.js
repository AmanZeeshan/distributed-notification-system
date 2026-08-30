const CHANNELS = ['email', 'push', 'sms', 'inapp'];
const CATEGORIES = ['transactional', 'marketing', 'alerts'];
const PRIORITIES = ['high', 'normal', 'low'];

const PRIORITY_SCORE = {
  high: 1,
  normal: 5,
  low: 10,
};

function assertChannel(channel) {
  if (!CHANNELS.includes(channel)) {
    throw new Error(`Unsupported channel: ${channel}`);
  }
  return channel;
}

module.exports = {
  CHANNELS,
  CATEGORIES,
  PRIORITIES,
  PRIORITY_SCORE,
  assertChannel,
};
