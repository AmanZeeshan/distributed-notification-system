const Handlebars = require('handlebars');

const cache = new Map();

function render(template, data = {}) {
  if (template === undefined || template === null) return '';
  const source = String(template);
  let compiled = cache.get(source);
  if (!compiled) {
    compiled = Handlebars.compile(source, { noEscape: false });
    cache.set(source, compiled);
  }
  return compiled(data);
}

function renderChannel(channelTemplate = {}, data = {}) {
  const rendered = {};
  for (const [key, value] of Object.entries(channelTemplate)) {
    rendered[key] = typeof value === 'string' ? render(value, data) : value;
  }
  return rendered;
}

module.exports = { render, renderChannel };
