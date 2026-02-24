import { js_beautify } from './lib/js-beautify.js';
import { DEFAULT_SETTINGS, MAX_AUTO_BYTES } from './modules/defaults.js';
import { getSettings } from './modules/storage.js';
import { applySemicolonPolicy, createDataHtml, getFilename, htmlEscape, isLikelyJavaScriptUrl } from './modules/utils.js';

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  await chrome.storage.sync.set({ ...DEFAULT_SETTINGS, ...existing });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === 'BEAUTIFY_TEXT') {
      const settings = await getSettings();
      sendResponse({ ok: true, formatted: formatJs(message.payload.text || '', settings) });
      return;
    }

    if (message.type === 'MANUAL_BEAUTIFY_TAB') {
      const tabId = message.payload?.tabId ?? sender.tab?.id;
      const url = message.payload?.url ?? sender.tab?.url;
      if (!tabId) {
        sendResponse({ ok: false, error: 'Missing tab id' });
        return;
      }
      sendResponse(await runBeautify(tabId, url, true));
      return;
    }

    sendResponse({ ok: false, error: 'Unknown message' });
  })();

  return true;
});

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== 'complete' || !tab.url) return;

  const settings = await getSettings();
  if (!settings.enabled) return;

  await runBeautify(tabId, tab.url, false);
});

async function runBeautify(tabId, url, force) {
  if (!url || /^chrome(-extension)?:\/\//.test(url)) return { ok: false, error: 'Unsupported URL' };

  const settings = await getSettings();
  const targetUrl = url.startsWith('view-source:') ? url.replace(/^view-source:/, '') : url;

  if (!force && !isLikelyJavaScriptUrl(targetUrl)) {
    const extracted = await getPageSource(tabId);
    if (!extracted.ok || !extracted.isLikelyJs) {
      return { ok: false, error: 'Not a JavaScript document' };
    }
  }

  const source = await getSourceText(tabId, targetUrl, force);
  if (!source.ok) {
    await notifyError(tabId, source.error);
    return source;
  }

  if (!source.text.trim()) {
    await notifyError(tabId, 'Empty response, nothing to beautify.');
    return { ok: false, error: 'Empty response' };
  }

  if (!force && source.text.length > MAX_AUTO_BYTES) {
    await notifyError(tabId, 'File is larger than 5MB. Use popup button for manual beautify.');
    return { ok: false, error: 'Too large for auto mode' };
  }

  const formatted = formatJs(source.text, settings);
  const filename = getFilename(targetUrl);

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'RENDER_BEAUTIFIED',
      payload: { original: source.text, formatted, filename, theme: settings.theme }
    });
  } catch {
    const html = createDataHtml(filename, `<pre><code>${htmlEscape(formatted)}</code></pre>`, settings.theme);
    await chrome.tabs.update(tabId, { url: `data:text/html;charset=utf-8,${encodeURIComponent(html)}` });
  }

  return { ok: true };
}

async function getSourceText(tabId, url, force) {
  const extracted = await getPageSource(tabId);
  if (extracted.ok && extracted.text?.trim()) {
    return { ok: true, text: extracted.text };
  }

  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return { ok: false, error: 'Unable to access blob/data source for this tab.' };
  }

  if (!force) {
    const allowed = await chrome.permissions.contains({ origins: [new URL(url).origin + '/*'] }).catch(() => false);
    if (!allowed) {
      return { ok: false, error: 'Host permission unavailable for auto-fetch on this origin.' };
    }
  }

  if (force) {
    const originPattern = new URL(url).origin + '/*';
    const hasOrigin = await chrome.permissions.contains({ origins: [originPattern] }).catch(() => false);
    if (!hasOrigin) {
      const granted = await chrome.permissions.request({ origins: [originPattern] }).catch(() => false);
      if (!granted) {
        return { ok: false, error: 'Host permission denied for this origin.' };
      }
    }
  }

  try {
    const response = await fetch(url, { credentials: 'include', cache: 'no-cache' });
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!/javascript|ecmascript/.test(contentType) && !isLikelyJavaScriptUrl(url)) {
      return { ok: false, error: 'Content is not JavaScript.' };
    }

    return { ok: true, text: await response.text() };
  } catch (error) {
    return { ok: false, error: `Unable to fetch script: ${error.message}` };
  }
}

async function getPageSource(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_SOURCE' });
    return response?.ok ? response : { ok: false, error: 'No page source response' };
  } catch {
    return { ok: false, error: 'Page source not accessible' };
  }
}

async function notifyError(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'BEAUTIFY_ERROR', error: message });
  } catch {
    // ignore
  }
}

function formatJs(source, settings) {
  const beautified = js_beautify(source, {
    indent_size: settings.indentWithTabs ? 1 : Number(settings.indentSize),
    indent_char: settings.indentWithTabs ? '\t' : ' ',
    wrap_line_length: Number(settings.maxLineLength),
    braces_on_own_line: settings.braceStyle === 'expand',
    space_in_empty_paren: Boolean(settings.spaceInEmptyParens),
    preserve_newlines: true,
    max_preserve_newlines: Number(settings.maxPreserveNewlines)
  });

  return applySemicolonPolicy(beautified, settings.semicolonStyle);
}
