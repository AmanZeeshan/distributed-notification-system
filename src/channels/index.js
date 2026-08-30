const { sendEmail } = require('./email.channel');
const { sendPush } = require('./push.channel');
const { sendSms } = require('./sms.channel');
const { sendInApp } = require('./inapp.channel');

const senders = {
  email: sendEmail,
  push: sendPush,
  sms: sendSms,
  inapp: sendInApp,
};

async function deliver(channel, context) {
  const sender = senders[channel];
  if (!sender) throw new Error(`No sender for channel ${channel}`);
  return sender(context);
}

module.exports = { deliver, senders };
