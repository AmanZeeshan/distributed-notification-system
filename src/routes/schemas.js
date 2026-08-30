const { z } = require('zod');
const { CHANNELS, CATEGORIES, PRIORITIES } = require('../utils/channels');

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');

const sendNotificationSchema = z.object({
  body: z.object({
    userId: objectId,
    templateSlug: z.string().min(1).optional(),
    category: z.enum(CATEGORIES).optional(),
    channels: z.array(z.enum(CHANNELS)).min(1).optional(),
    title: z.string().optional(),
    subject: z.string().optional(),
    body: z.string().optional(),
    html: z.string().optional(),
    data: z.record(z.any()).optional(),
    scheduledAt: z.string().datetime().optional(),
    priority: z.enum(PRIORITIES).optional(),
    idempotencyKey: z.string().min(8).optional(),
  }),
});

const batchSchema = z.object({
  body: z.object({
    notifications: z.array(sendNotificationSchema.shape.body).min(1).max(100),
  }),
});

const userSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    deviceTokens: z
      .array(
        z.object({
          token: z.string().min(1),
          platform: z.enum(['ios', 'android', 'web']).optional(),
        })
      )
      .optional(),
  }),
});

const preferenceSchema = z.object({
  params: z.object({ userId: objectId }),
  body: z.object({
    channels: z.record(z.enum(CHANNELS), z.boolean()).optional(),
    categories: z.record(z.enum(CATEGORIES), z.record(z.enum(CHANNELS), z.boolean())).optional(),
    quietHours: z
      .object({
        enabled: z.boolean().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        timezone: z.string().optional(),
      })
      .optional(),
  }),
});

const templateSchema = z.object({
  body: z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    category: z.enum(CATEGORIES).optional(),
    description: z.string().optional(),
    channels: z.object({
      email: z.object({ subject: z.string().optional(), html: z.string().optional(), text: z.string().optional() }).optional(),
      push: z.object({ title: z.string().optional(), body: z.string().optional() }).optional(),
      sms: z.object({ body: z.string().optional() }).optional(),
      inapp: z.object({ title: z.string().optional(), body: z.string().optional() }).optional(),
    }).optional(),
  }),
});

module.exports = {
  sendNotificationSchema,
  batchSchema,
  userSchema,
  preferenceSchema,
  templateSchema,
  objectId,
};
