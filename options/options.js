import { DEFAULT_SETTINGS } from '../modules/defaults.js';

const keys = ['indentSize','indentWithTabs','maxLineLength','semicolonStyle','braceStyle','spaceInEmptyParens','theme'];

async function init() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  for (const key of keys) {
    const el = document.getElementById(key);
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = Boolean(settings[key]);
    else el.value = settings[key];
  }
}

document.getElementById('save').addEventListener('click', async () => {
  const payload = {};
  for (const key of keys) {
    const el = document.getElementById(key);
    payload[key] = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? Number(el.value) : el.value);
  }
  await chrome.storage.sync.set(payload);
  document.getElementById('status').textContent = 'Saved.';
});

init();
