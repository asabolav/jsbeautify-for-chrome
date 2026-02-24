import { DEFAULT_SETTINGS } from '../modules/defaults.js';

const enabled = document.getElementById('enabled');
const status = document.getElementById('status');

function setStatus(text) {
  status.textContent = text;
}

document.getElementById('beautify-now').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus('No active tab.');
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: 'MANUAL_BEAUTIFY_TAB',
    payload: { tabId: tab.id, url: tab.url }
  });

  setStatus(response?.ok ? 'Beautified.' : `Failed: ${response?.error || 'Unknown error'}`);
});

enabled.addEventListener('change', async () => {
  await chrome.storage.sync.set({ enabled: enabled.checked });
  setStatus(enabled.checked ? 'Auto beautify enabled.' : 'Auto beautify disabled.');
});

chrome.storage.sync.get(DEFAULT_SETTINGS).then((s) => {
  enabled.checked = Boolean(s.enabled);
});
