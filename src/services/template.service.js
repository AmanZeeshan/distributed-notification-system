const { Template } = require('../models');
const { renderChannel } = require('../utils/templateEngine');
const { CHANNELS } = require('../utils/channels');

async function renderTemplate(slug, data = {}) {
  const template = await Template.findOne({ slug });
  if (!template) {
    const error = new Error(`Template not found: ${slug}`);
    error.status = 404;
    throw error;
  }

  const rendered = {};
  for (const channel of CHANNELS) {
    rendered[channel] = renderChannel(template.channels?.[channel]?.toObject?.() || template.channels?.[channel] || {}, data);
  }

  return {
    template,
    rendered,
    category: template.category,
    fallback: {
      subject: rendered.email.subject,
      title: rendered.push.title || rendered.inapp.title,
      body: rendered.sms.body || rendered.inapp.body || rendered.email.text,
      html: rendered.email.html,
    },
  };
}

module.exports = { renderTemplate };
