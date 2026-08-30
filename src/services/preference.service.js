const { DateTime } = require('luxon');
const { Preference } = require('../models');
const { CHANNELS, CATEGORIES } = require('../utils/channels');

function defaultCategoryFlags() {
  return CATEGORIES.reduce((acc, category) => {
    acc[category] = CHANNELS.reduce((flags, channel) => {
      flags[channel] = true;
      return flags;
    }, {});
    return acc;
  }, {});
}

async function getOrCreate(userId) {
  let preference = await Preference.findOne({ userId });
  if (!preference) {
    preference = await Preference.create({
      userId,
      channels: CHANNELS.reduce((acc, channel) => {
        acc[channel] = true;
        return acc;
      }, {}),
      categories: defaultCategoryFlags(),
    });
  }
  return preference;
}

function isQuietHours(quietHours, now = DateTime.utc()) {
  if (!quietHours?.enabled) return false;
  const zone = quietHours.timezone || 'UTC';
  const local = now.setZone(zone);
  const [startHour, startMinute] = String(quietHours.start || '22:00').split(':').map(Number);
  const [endHour, endMinute] = String(quietHours.end || '07:00').split(':').map(Number);
  const start = local.set({ hour: startHour, minute: startMinute, second: 0, millisecond: 0 });
  let end = local.set({ hour: endHour, minute: endMinute, second: 0, millisecond: 0 });

  if (end <= start) {
    if (local >= start) return { active: true, resumeAt: end.plus({ days: 1 }).toUTC().toJSDate() };
    if (local < end) return { active: true, resumeAt: end.toUTC().toJSDate() };
    return { active: false, resumeAt: null };
  }

  if (local >= start && local < end) {
    return { active: true, resumeAt: end.toUTC().toJSDate() };
  }
  return { active: false, resumeAt: null };
}

function resolveChannels(preference, { requested = [], category = 'transactional', priority = 'normal' }) {
  const wanted = requested.length ? requested : CHANNELS;
  const categoryFlags = preference.categories?.get?.(category) || preference.categories?.[category] || {};
  const allowed = wanted.filter((channel) => {
    if (preference.channels?.[channel] === false) return false;
    if (categoryFlags[channel] === false) return false;
    return true;
  });

  const skipped = wanted
    .filter((channel) => !allowed.includes(channel))
    .map((channel) => ({
      channel,
      reason:
        preference.channels?.[channel] === false
          ? 'channel_disabled'
          : 'category_disabled',
    }));

  const quiet = isQuietHours(preference.quietHours);
  const bypassQuiet = category === 'transactional' || priority === 'high';

  return {
    allowed,
    skipped,
    delayUntil: quiet.active && !bypassQuiet ? quiet.resumeAt : null,
  };
}

module.exports = {
  getOrCreate,
  resolveChannels,
  isQuietHours,
};
