import { detectRawJavaScriptDocument } from './modules/utils.js';
import { highlightJs } from './modules/highlight.js';

let originalCode = '';
let beautifiedCode = '';
let showingBeautified = true;
let rendered = false;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_PAGE_SOURCE') {
    const info = detectRawJavaScriptDocument();
    const isLikelyJs = info.isJsContentType || info.hasSinglePre || /\.m?js(\?|$)/i.test(location.href) || location.protocol === 'view-source:';
    sendResponse({ ok: true, text: info.bodyText, isLikelyJs, title: info.title });
    return true;
  }

  if (message.type === 'RENDER_BEAUTIFIED') {
    originalCode = message.payload.original || '';
    beautifiedCode = message.payload.formatted || '';
    showingBeautified = true;
    renderCode(message.payload.filename || 'script.js', message.payload.theme || 'dark');
  }

  if (message.type === 'BEAUTIFY_ERROR') {
    renderError(message.error || 'Beautify failed.');
  }

  return false;
});

(async function autoDetect() {
  const info = detectRawJavaScriptDocument();
  if (!info.bodyText.trim()) return;
  if (!(info.isJsContentType || info.hasSinglePre || /\.m?js(\?|$)/i.test(location.href))) return;

  const task = () => {
    chrome.runtime.sendMessage({ type: 'BEAUTIFY_TEXT', payload: { text: info.bodyText } }, (response) => {
      if (!response?.ok || rendered) return;
      originalCode = info.bodyText;
      beautifiedCode = response.formatted || info.bodyText;
      showingBeautified = true;
      renderCode(info.title || 'script.js', 'dark');
    });
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(task, { timeout: 600 });
  } else {
    setTimeout(task, 0);
  }
})();

function renderCode(filename, theme) {
  rendered = true;
  const safeFilename = filename.replace(/[\r\n]/g, ' ').slice(0, 180);

  document.documentElement.replaceChildren();
  const head = document.createElement('head');
  const meta = document.createElement('meta');
  meta.setAttribute('charset', 'utf-8');
  head.appendChild(meta);

  const style = document.createElement('style');
  style.textContent = `
    body{margin:0}
    #beautify-shell{min-height:100vh;font-family:ui-monospace,Consolas,monospace;background:var(--bg);color:var(--fg)}
    #beautify-shell[data-theme="dark"]{--bg:#0b1020;--fg:#e2e8f0;--header:#111827}
    #beautify-shell[data-theme="light"]{--bg:#fff;--fg:#0f172a;--header:#e2e8f0}
    header{position:sticky;top:0;display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 16px;background:var(--header)}
    .actions{display:flex;gap:8px;flex-wrap:wrap}
    .actions button{padding:6px 10px;border:1px solid #334155;background:transparent;color:inherit;border-radius:6px;cursor:pointer}
    pre{margin:0;padding:16px;white-space:pre-wrap;word-break:break-word;line-height:1.4}
    .tok-keyword{color:#c084fc}.tok-number{color:#f59e0b}.tok-string{color:#34d399}.tok-comment{color:#64748b}
  `;
  head.appendChild(style);

  const body = document.createElement('body');
  const shell = document.createElement('div');
  shell.id = 'beautify-shell';
  shell.dataset.theme = theme === 'light' ? 'light' : 'dark';

  const header = document.createElement('header');
  const title = document.createElement('strong');
  title.textContent = safeFilename;

  const actions = document.createElement('div');
  actions.className = 'actions';

  const toggleButton = document.createElement('button');
  toggleButton.id = 'toggle-view';
  toggleButton.textContent = 'Show original';

  const copyButton = document.createElement('button');
  copyButton.id = 'copy-code';
  copyButton.textContent = 'Copy';

  const downloadButton = document.createElement('button');
  downloadButton.id = 'download-code';
  downloadButton.textContent = 'Download';

  actions.append(toggleButton, copyButton, downloadButton);
  header.append(title, actions);

  const pre = document.createElement('pre');
  const code = document.createElement('code');
  code.id = 'code-block';
  pre.appendChild(code);

  shell.append(header, pre);
  body.appendChild(shell);

  document.documentElement.append(head, body);
  document.title = `${safeFilename} (Beautified)`;

  const updateCode = () => {
    code.innerHTML = highlightJs(showingBeautified ? beautifiedCode : originalCode);
  };

  updateCode();

  toggleButton.addEventListener('click', () => {
    showingBeautified = !showingBeautified;
    toggleButton.textContent = showingBeautified ? 'Show original' : 'Show beautified';
    updateCode();
  });

  copyButton.addEventListener('click', async () => {
    await navigator.clipboard.writeText(showingBeautified ? beautifiedCode : originalCode);
  });

  downloadButton.addEventListener('click', () => {
    const blob = new Blob([showingBeautified ? beautifiedCode : originalCode], { type: 'application/javascript' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = safeFilename || 'beautified.js';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  });
}

function renderError(message) {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;top:8px;right:8px;z-index:999999;background:#7f1d1d;color:#fff;padding:8px 10px;border-radius:6px;font:12px sans-serif;max-width:60vw';
  box.textContent = String(message);
  document.body?.appendChild(box);
  setTimeout(() => box.remove(), 5000);
}
