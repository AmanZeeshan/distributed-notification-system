const CHANNELS = ['email', 'push', 'sms', 'inapp'];
const TEMPLATE_FIELDS = {
  'password-reset': [
    ['code', 'Reset code', '482911'],
    ['minutes', 'Expires in (minutes)', '15'],
  ],
  'order-shipped': [
    ['orderId', 'Order ID', 'A-100'],
    ['carrier', 'Carrier', 'DHL'],
    ['tracking', 'Tracking', '1Z999'],
  ],
  'weekly-promo': [
    ['headline', 'Headline', 'Weekend sale'],
    ['offer', 'Offer', '30% off'],
  ],
};

const copy = {
  overview: ['Operations', 'Delivery overview', 'Queue depth, channel health, and the latest delivery attempts.'],
  compose: ['Dispatch', 'Compose a notification', 'Pick a recipient, template, and channels. Preferences and quiet hours still apply.'],
  inbox: ['In-app', 'Recipient inbox', 'Messages stored after the in-app worker delivers them. Live updates stay open for the selected user.'],
  activity: ['History', 'Notification activity', 'Every accepted notification and the current status of each channel.'],
  failed: ['Dead letter', 'Failed jobs', 'Jobs that exhausted retries. Replay them after the provider issue is gone.'],
  users: ['Directory', 'Users and preferences', 'Seeded recipients plus the channels they allow.'],
  templates: ['Library', 'Message templates', 'Handlebars snippets rendered per channel before enqueue.'],
};

const state = { users: [], templates: [], view: 'overview', stream: null };

const $ = (id) => document.getElementById(id);

function fmt(value) {
  return Number(value || 0).toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function initials(name) {
  return String(name || '?')
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function pill(status) {
  const tone = status === 'delivered' || status === 'ok' || status === 'up' ? 'ok'
    : status === 'failed' || status === 'cancelled' || status === 'down' ? 'bad'
    : status === 'scheduled' || status === 'partial' || status === 'processing' ? 'warn'
    : 'idle';
  return `<span class="pill ${tone}">${escapeHtml(status)}</span>`;
}

function toast(message) {
  const node = $('toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 3200);
}

async function api(path, options) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function setView(view) {
  state.view = view;
  document.querySelectorAll('.nav button').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === view);
  });
  document.querySelectorAll('main > section').forEach((section) => {
    section.classList.toggle('hidden', section.id !== `view-${view}`);
  });
  const [eyebrow, title, subtitle] = copy[view];
  $('eyebrow').textContent = eyebrow;
  $('title').textContent = title;
  $('subtitle').textContent = subtitle;
  if (view === 'inbox') openInboxStream();
  else closeInboxStream();
}

function fillSelect(id, items, getLabel) {
  const select = $(id);
  const current = select.value;
  select.innerHTML = items.map((item) => `<option value="${item._id || item.slug}">${escapeHtml(getLabel(item))}</option>`).join('');
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}

function renderComposeChannels() {
  $('compose-channels').innerHTML = CHANNELS.map((channel) => `
    <label class="chip on">
      <input type="checkbox" name="channel" value="${channel}" checked />
      ${channel}
    </label>
  `).join('');
  $('compose-channels').querySelectorAll('input').forEach((input) => {
    input.addEventListener('change', () => {
      input.closest('.chip').classList.toggle('on', input.checked);
    });
  });
}

function renderTemplateFields() {
  const slug = $('compose-template').value;
  const fields = TEMPLATE_FIELDS[slug] || [];
  $('compose-custom').classList.toggle('hidden', Boolean(slug));
  $('compose-data').classList.toggle('hidden', !fields.length);
  $('compose-data').innerHTML = fields.map(([key, label, placeholder]) => `
    <label>${label}<input data-key="${key}" placeholder="${placeholder}" /></label>
  `).join('');
}

async function loadHealth() {
  try {
    const health = await api('/health');
    $('api-status').className = `pill ${health.status === 'ok' ? 'ok' : 'bad'}`;
    $('api-status').textContent = health.status;
    $('mongo-status').textContent = health.checks.mongo;
    $('redis-status').textContent = health.checks.redis;
  } catch (_error) {
    $('api-status').className = 'pill bad';
    $('api-status').textContent = 'down';
  }
}

function renderOverview(metrics, logs) {
  const counters = metrics.counters || {};
  const delivered = CHANNELS.reduce((sum, channel) => sum + (counters[`${channel}:delivered`] || 0), 0);
  const failed = CHANNELS.reduce((sum, channel) => sum + (counters[`${channel}:failed`] || 0), 0);
  const enqueued = CHANNELS.reduce((sum, channel) => sum + (counters[`${channel}:enqueued`] || 0), 0);
  const statuses = metrics.notificationsByStatus || {};
  const total = Object.values(statuses).reduce((sum, value) => sum + value, 0);

  $('kpis').innerHTML = [
    ['Delivered', delivered, `${fmt(enqueued)} enqueued`],
    ['Failed attempts', failed, `${fmt(counters['deadletter:total'])} dead letters`],
    ['In flight', (statuses.queued || 0) + (statuses.processing || 0) + (statuses.scheduled || 0), `${fmt(statuses.scheduled)} scheduled`],
    ['Notifications', total, `${fmt(statuses.delivered)} fully delivered`],
  ].map(([label, value, hint]) => `
    <article class="card kpi"><span>${label}</span><strong>${fmt(value)}</strong><em>${hint}</em></article>
  `).join('');

  const max = Math.max(1, ...CHANNELS.map((channel) => counters[`${channel}:delivered`] || 0));
  $('channels').innerHTML = CHANNELS.map((channel) => {
    const count = counters[`${channel}:delivered`] || 0;
    return `
      <div class="channel">
        <strong>${channel}</strong>
        <div class="bar ${channel}"><i style="width:${Math.round((count / max) * 100)}%"></i></div>
        <span class="muted">${fmt(count)}</span>
      </div>
    `;
  }).join('');

  $('queues').innerHTML = `
    <tr><th>Channel</th><th>Wait</th><th>Active</th><th>Delayed</th><th>Failed</th><th>Done</th></tr>
    ${Object.entries(metrics.queues || {}).map(([name, queue]) => `
      <tr>
        <td>${name}</td><td>${fmt(queue.wait)}</td><td>${fmt(queue.active)}</td>
        <td>${fmt(queue.delayed)}</td><td>${fmt(queue.failed)}</td><td>${fmt(queue.completed)}</td>
      </tr>
    `).join('')}
  `;

  $('overview-logs').innerHTML = renderLogTable(logs);
}

function renderLogTable(items) {
  if (!items.length) return '<tr><td class="empty" colspan="6">No delivery attempts yet</td></tr>';
  return `
    <tr><th>Time</th><th>Channel</th><th>Status</th><th>Attempt</th><th>Latency</th><th>Detail</th></tr>
    ${items.map((item) => `
      <tr>
        <td>${new Date(item.createdAt).toLocaleTimeString()}</td>
        <td>${item.channel}</td>
        <td>${pill(item.status)}</td>
        <td>${item.attempt}</td>
        <td>${item.latencyMs}ms</td>
        <td class="truncate">${escapeHtml(item.error || item.providerId || '')}</td>
      </tr>
    `).join('')}
  `;
}

function renderInbox(items, unreadCount) {
  $('unread').textContent = `${unreadCount} unread`;
  $('unread').className = `pill ${unreadCount ? 'warn' : 'idle'}`;
  if (!items.length) {
    $('inbox').innerHTML = '<article class="card empty">Nothing in this inbox yet. Send an in-app notification to see it here.</article>';
    return;
  }
  $('inbox').innerHTML = items.map((item) => `
    <article class="card note">
      <div class="note-head">
        <div>
          <h3>${escapeHtml(item.payload?.rendered?.inapp?.title || item.payload?.title || 'Notification')}</h3>
          <p>${escapeHtml(item.payload?.rendered?.inapp?.body || item.payload?.body || '')}</p>
        </div>
        ${pill(item.readAt ? 'read' : 'unread')}
      </div>
      <div class="section-title">
        <span class="muted">${new Date(item.createdAt).toLocaleString()}</span>
        ${item.readAt ? '' : `<button class="btn small ghost" data-read="${item._id}">Mark read</button>`}
      </div>
    </article>
  `).join('');
}

function renderActivity(items) {
  if (!items.length) {
    $('activity').innerHTML = '<tr><td class="empty">No notifications yet</td></tr>';
    return;
  }
  $('activity').innerHTML = `
    <tr><th>When</th><th>Recipient</th><th>Template</th><th>Status</th><th>Channels</th></tr>
    ${items.map((item) => {
      const user = state.users.find((entry) => entry._id === item.userId) || {};
      return `
        <tr>
          <td>${new Date(item.createdAt).toLocaleString()}</td>
          <td>${escapeHtml(user.name || item.userId)}</td>
          <td>${escapeHtml(item.templateSlug || 'custom')}</td>
          <td>${pill(item.status)}</td>
          <td>${(item.deliveries || []).map((delivery) => pill(`${delivery.channel}:${delivery.status}`)).join(' ')}</td>
        </tr>
      `;
    }).join('')}
  `;
}

function renderFailed(items) {
  if (!items.length) {
    $('failed').innerHTML = '<tr><td class="empty">No failed jobs. Simulated provider failures will land here after retries.</td></tr>';
    return;
  }
  $('failed').innerHTML = `
    <tr><th>When</th><th>Channel</th><th>Attempts</th><th>Error</th><th></th></tr>
    ${items.map((item) => `
      <tr>
        <td>${new Date(item.createdAt).toLocaleString()}</td>
        <td>${item.channel}</td>
        <td>${item.attempts}</td>
        <td class="truncate">${escapeHtml(item.error)}</td>
        <td>${item.resolved ? pill('resolved') : `<button class="btn small" data-retry="${item._id}">Retry</button>`}</td>
      </tr>
    `).join('')}
  `;
}

function renderUsers(users, prefs) {
  $('users').innerHTML = users.map((user) => {
    const preference = prefs[user._id] || { channels: {} };
    return `
      <article class="card user-card">
        <div class="user-head">
          <div class="avatar">${initials(user.name)}</div>
          <div>
            <h3>${escapeHtml(user.name)}</h3>
            <p>${escapeHtml(user.email)}</p>
            <p>${escapeHtml(user.phone || 'No phone')}</p>
          </div>
        </div>
        <div>${CHANNELS.map((channel) => pill(preference.channels?.[channel] === false ? `${channel} off` : channel)).join(' ')}</div>
      </article>
    `;
  }).join('');
}

function renderTemplates(templates) {
  $('templates').innerHTML = templates.map((template) => `
    <article class="card template-card">
      <h3>${escapeHtml(template.name)}</h3>
      <p>${escapeHtml(template.description || template.slug)}</p>
      <div>${pill(template.category)} ${pill(template.slug)}</div>
    </article>
  `).join('');
}

async function refreshDirectory() {
  const [users, templates] = await Promise.all([
    api('/api/users'),
    api('/api/templates'),
  ]);
  state.users = users.users || [];
  state.templates = templates.templates || [];
  fillSelect('compose-user', state.users, (user) => `${user.name} · ${user.email}`);
  fillSelect('inbox-user', state.users, (user) => user.name);
  const templateSelect = $('compose-template');
  const current = templateSelect.value;
  templateSelect.innerHTML = `<option value="">Custom message</option>${state.templates.map((template) => `<option value="${template.slug}">${escapeHtml(template.name)}</option>`).join('')}`;
  templateSelect.value = current;
  renderTemplates(state.templates);

  const prefs = {};
  await Promise.all(state.users.map(async (user) => {
    const result = await api(`/api/preferences/${user._id}`);
    prefs[user._id] = result.preference;
  }));
  renderUsers(state.users, prefs);
}

async function refreshInbox() {
  const userId = $('inbox-user').value;
  if (!userId) return;
  const inbox = await api(`/api/inbox/${userId}`);
  renderInbox(inbox.items || [], inbox.unreadCount || 0);
}

function closeInboxStream() {
  if (state.stream) {
    state.stream.close();
    state.stream = null;
  }
}

function openInboxStream() {
  closeInboxStream();
  const userId = $('inbox-user').value;
  if (!userId) return;
  state.stream = new EventSource(`/api/inbox/${userId}/stream`);
  state.stream.addEventListener('notification', () => refreshInbox());
}

async function load() {
  await loadHealth();
  const [metrics, failed, logs, notifications] = await Promise.all([
    api('/api/admin/metrics'),
    api('/api/admin/failed-jobs?limit=20'),
    api('/api/admin/logs?limit=12'),
    api('/api/notifications?limit=20'),
  ]);
  $('stamp').textContent = `Updated ${new Date(metrics.generatedAt).toLocaleTimeString()}`;
  renderOverview(metrics, logs.items || []);
  renderFailed(failed.items || []);
  renderActivity(notifications.items || []);
  if (state.view === 'inbox') await refreshInbox();
}

async function sendNotification(event) {
  event.preventDefault();
  const button = $('send-btn');
  button.disabled = true;
  try {
    const slug = $('compose-template').value;
    const channels = [...document.querySelectorAll('input[name="channel"]:checked')].map((input) => input.value);
    const payload = {
      userId: $('compose-user').value,
      priority: $('compose-priority').value,
      channels,
    };
    if (slug) payload.templateSlug = slug;
    else {
      payload.title = $('compose-title').value;
      payload.body = $('compose-body').value;
    }
    const schedule = $('compose-schedule').value;
    if (schedule) payload.scheduledAt = new Date(schedule).toISOString();
    const data = {};
    $('compose-data').querySelectorAll('input').forEach((input) => {
      if (input.value) data[input.dataset.key] = input.value;
    });
    if (Object.keys(data).length) payload.data = data;
    const result = await api('/api/notifications', { method: 'POST', body: JSON.stringify(payload) });
    toast(result.deduped ? 'Duplicate ignored via idempotency key' : `Queued · ${result.notification.status}`);
    await load();
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
  }
}

document.querySelectorAll('.nav button').forEach((button) => {
  button.addEventListener('click', () => setView(button.dataset.view));
});
$('compose-template').addEventListener('change', renderTemplateFields);
$('compose-form').addEventListener('submit', sendNotification);
$('inbox-user').addEventListener('change', () => {
  refreshInbox();
  if (state.view === 'inbox') openInboxStream();
});
document.addEventListener('click', async (event) => {
  const retryId = event.target.dataset.retry;
  const readId = event.target.dataset.read;
  try {
    if (retryId) {
      await api(`/api/admin/failed-jobs/${retryId}/retry`, { method: 'POST' });
      toast('Job re-queued');
      await load();
    }
    if (readId) {
      await api(`/api/inbox/${readId}/read`, { method: 'POST' });
      await refreshInbox();
    }
  } catch (error) {
    toast(error.message);
  }
});

renderComposeChannels();
renderTemplateFields();
refreshDirectory().then(load).catch((error) => toast(error.message));
setInterval(load, 4000);
