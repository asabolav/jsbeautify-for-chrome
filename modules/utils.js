export function isLikelyJavaScriptUrl(url = '') {
  if (!url) return false;
  if (url.startsWith('view-source:')) {
    return isLikelyJavaScriptUrl(url.replace(/^view-source:/, ''));
  }
  if (url.startsWith('data:text/javascript') || url.startsWith('data:application/javascript')) return true;
  return /\.m?js(\?.*)?(#.*)?$/i.test(url) || /[?&](file|name)=.*\.m?js/i.test(url);
}

export function detectRawJavaScriptDocument() {
  const bodyText = document.body?.innerText || '';
  const contentType = (document.contentType || '').toLowerCase();
  const hasSinglePre = document.body?.children.length === 1 && document.body.children[0].tagName === 'PRE';
  return {
    contentType,
    isJsContentType: /javascript|ecmascript|x-javascript/.test(contentType),
    hasSinglePre,
    bodyText,
    title: document.title || 'script.js'
  };
}

export function htmlEscape(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function applySemicolonPolicy(source, policy) {
  if (policy === 'add') {
    return source.replace(/([^;\s{}])\n(?=\s*(?:\/\/|\/\*|$|[a-zA-Z_$]))/g, '$1;\n');
  }
  if (policy === 'remove') {
    return source.replace(/;(?=\s*(?:\n|$))/g, '');
  }
  return source;
}

export function getFilename(url, fallback = 'beautified.js') {
  try {
    const normalized = url.startsWith('view-source:') ? url.replace(/^view-source:/, '') : url;
    const pathname = new URL(normalized).pathname;
    const name = pathname.split('/').pop();
    return sanitizeFilename(name || fallback);
  } catch {
    return sanitizeFilename(fallback);
  }
}

export function sanitizeFilename(name) {
  return String(name || 'beautified.js').replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_').slice(0, 180);
}

export function createDataHtml(filename, bodyHtml, theme = 'dark') {
  const safeTitle = htmlEscape(filename);
  const css = `body{margin:0;font-family:ui-monospace,Consolas,monospace;background:${theme === 'dark' ? '#0b1020' : '#ffffff'};color:${theme === 'dark' ? '#e2e8f0' : '#0f172a'};}pre{margin:0;padding:16px;white-space:pre-wrap;word-break:break-word;}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title><style>${css}</style></head><body>${bodyHtml}</body></html>`;
}
