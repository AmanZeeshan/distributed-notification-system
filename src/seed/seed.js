const { connectDb, disconnectDb } = require('../config/db');
const { User, Preference, Template } = require('../models');
const { logger } = require('../utils/logger');

const users = [
  {
    name: 'Ava Chen',
    email: 'ava@example.com',
    phone: '+15550001001',
    deviceTokens: [{ token: 'device-ava-web', platform: 'web' }],
  },
  {
    name: 'Noah Patel',
    email: 'noah@example.com',
    phone: '+15550001002',
    deviceTokens: [{ token: 'device-noah-ios', platform: 'ios' }],
  },
  {
    name: 'Mia Brooks',
    email: 'mia@example.com',
    phone: '',
    deviceTokens: [],
  },
];

const templates = [
  {
    slug: 'welcome',
    name: 'Welcome',
    category: 'transactional',
    description: 'Sent after signup',
    channels: {
      email: {
        subject: 'Welcome to Notify, {{user.name}}',
        text: 'Hi {{user.name}}, your account is ready.',
        html: '<h1>Welcome, {{user.name}}</h1><p>Your account is ready.</p>',
      },
      push: { title: 'Welcome {{user.name}}', body: 'Your account is ready.' },
      sms: { body: 'Welcome {{user.name}}! Your Notify account is ready.' },
      inapp: { title: 'Welcome', body: 'Thanks for joining Notify, {{user.name}}.' },
    },
  },
  {
    slug: 'password-reset',
    name: 'Password reset',
    category: 'transactional',
    description: 'One-time password reset code',
    channels: {
      email: {
        subject: 'Reset your password',
        text: 'Your reset code is {{code}}. It expires in {{minutes}} minutes.',
        html: '<p>Your reset code is <strong>{{code}}</strong>. It expires in {{minutes}} minutes.</p>',
      },
      push: { title: 'Password reset', body: 'Code {{code}} expires in {{minutes}} minutes.' },
      sms: { body: 'Notify reset code: {{code}}. Expires in {{minutes}} min.' },
      inapp: { title: 'Password reset requested', body: 'Use code {{code}} within {{minutes}} minutes.' },
    },
  },
  {
    slug: 'order-shipped',
    name: 'Order shipped',
    category: 'alerts',
    description: 'Fulfillment update',
    channels: {
      email: {
        subject: 'Order {{orderId}} is on the way',
        text: 'Order {{orderId}} shipped via {{carrier}}. Tracking: {{tracking}}.',
        html: '<p>Order <strong>{{orderId}}</strong> shipped via {{carrier}}.</p><p>Tracking: {{tracking}}</p>',
      },
      push: { title: 'Order shipped', body: '{{orderId}} is on the way. {{carrier}} {{tracking}}' },
      sms: { body: 'Order {{orderId}} shipped. Track: {{tracking}}' },
      inapp: { title: 'Order {{orderId}} shipped', body: 'Carrier {{carrier}} · {{tracking}}' },
    },
  },
  {
    slug: 'weekly-promo',
    name: 'Weekly promo',
    category: 'marketing',
    description: 'Optional promotional blast',
    channels: {
      email: {
        subject: '{{headline}}',
        text: '{{headline}} — {{offer}}',
        html: '<h2>{{headline}}</h2><p>{{offer}}</p>',
      },
      push: { title: '{{headline}}', body: '{{offer}}' },
      sms: { body: '{{headline}}: {{offer}}' },
      inapp: { title: '{{headline}}', body: '{{offer}}' },
    },
  },
];

async function seed() {
  await connectDb();
  await Promise.all([User.deleteMany({}), Preference.deleteMany({}), Template.deleteMany({})]);

  const createdUsers = await User.insertMany(users);
  await Template.insertMany(templates);

  await Preference.create({
    userId: createdUsers[0]._id,
    channels: { email: true, push: true, sms: true, inapp: true },
  });

  await Preference.create({
    userId: createdUsers[1]._id,
    channels: { email: true, push: true, sms: false, inapp: true },
    categories: {
      marketing: { email: false, push: false, sms: false, inapp: true },
      transactional: { email: true, push: true, sms: false, inapp: true },
      alerts: { email: true, push: true, sms: false, inapp: true },
    },
  });

  await Preference.create({
    userId: createdUsers[2]._id,
    channels: { email: true, push: false, sms: false, inapp: true },
    quietHours: { enabled: true, start: '22:00', end: '07:00', timezone: 'UTC' },
  });

  logger.info(
    {
      users: createdUsers.map((user) => ({ id: String(user._id), email: user.email })),
      templates: templates.map((item) => item.slug),
    },
    'seed complete'
  );

  await disconnectDb();
}

seed().catch((error) => {
  logger.error({ err: error }, 'seed failed');
  process.exit(1);
});
