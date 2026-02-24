(function () {
  let originalCode = '';
  let beautifiedCode = '';
  let showingBeautified = true;
  let rendered = false;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'GET_PAGE_SOURCE') {
      const info = detectRawJavaScriptDocument();
      const isLikelyJs =
        info.isJsContentType ||
        info.hasSinglePre ||
        /\.m?js(\?|$)/i.test(location.href) ||
        location.protocol === 'view-source:';

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

  (function autoDetect() {
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

  function detectRawJavaScriptDocument() {
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

  function htmlEscape(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  function highlightJs(code) {
    const escaped = htmlEscape(code);

    const tokenized = escaped
      .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="tok-comment">$1</span>')
      .replace(/(\/\/.*$)/gm, '<span class="tok-comment">$1</span>')
      .replace(/(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, '<span class="tok-string">$1</span>')
      .replace(/\b(0x[\da-fA-F]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b/g, '<span class="tok-number">$1</span>')
      .replace(/\b(true|false|null|undefined|NaN|Infinity)\b/g, '<span class="tok-const">$1</span>')
      .replace(/\b(this|super|new|instanceof|typeof|void|delete|in|of|await|async|yield)\b/g, '<span class="tok-opkw">$1</span>')
      .replace(/\b(class|extends|constructor|function|return|if|else|switch|case|default|for|while|do|break|continue|throw|try|catch|finally|import|export|from|as|let|const|var)\b/g, '<span class="tok-keyword">$1</span>')
      .replace(/\b([A-Za-z_$][\w$]*)(?=\s*\()/g, '<span class="tok-function">$1</span>')
      .replace(/([{}()[\].,;:])/g, '<span class="tok-punct">$1</span>')
      .replace(/(===|!==|==|!=|<=|>=|=>|\+\+|--|&&|\|\||\+|-|\*|\/|%|=|!|\?|\||&|\^|~|<|>)/g, '<span class="tok-operator">$1</span>');

    return tokenized;
  }

  function renderCode(filename, theme) {
    rendered = true;
    const safeFilename = String(filename || 'script.js').replace(/[\r\n]/g, ' ').slice(0, 180);

    document.documentElement.replaceChildren();
    const head = document.createElement('head');
    const meta = document.createElement('meta');
    meta.setAttribute('charset', 'utf-8');
    head.appendChild(meta);

    const style = document.createElement('style');
    style.textContent = `
      body{margin:0}
      #beautify-shell{min-height:100vh;font-family:'JetBrains Mono','Fira Code',ui-monospace,Consolas,monospace;background:var(--bg);color:var(--fg)}
      #beautify-shell[data-theme="dark"]{--bg:#0d1117;--fg:#c9d1d9;--panel:#161b22;--border:#30363d}
      #beautify-shell[data-theme="light"]{--bg:#ffffff;--fg:#1f2328;--panel:#f6f8fa;--border:#d0d7de}
      #action-tab{position:fixed;top:8px;right:8px;display:flex;gap:6px;z-index:9999;background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:6px;box-shadow:0 4px 14px rgba(0,0,0,.2)}
      #action-tab button{padding:4px 8px;border:1px solid var(--border);background:transparent;color:inherit;border-radius:6px;cursor:pointer;font-size:12px}
      #action-tab button.active{border-color:#58a6ff;color:#58a6ff}
      pre{margin:0;padding:40px 16px 16px 16px;white-space:pre;overflow:auto;line-height:1.55;tab-size:2}
      .tok-keyword{color:#ff7b72;font-weight:600}
      .tok-opkw{color:#d2a8ff}
      .tok-function{color:#d2a8ff}
      .tok-string{color:#a5d6ff}
      .tok-number{color:#79c0ff}
      .tok-const{color:#79c0ff}
      .tok-comment{color:#8b949e;font-style:italic}
      .tok-operator{color:#ff7b72}
      .tok-punct{color:#c9d1d9}
    `;
    head.appendChild(style);

    const body = document.createElement('body');
    const shell = document.createElement('div');
    shell.id = 'beautify-shell';
    shell.dataset.theme = theme === 'light' ? 'light' : 'dark';

    const actionTab = document.createElement('div');
    actionTab.id = 'action-tab';

    const showOriginalBtn = document.createElement('button');
    showOriginalBtn.textContent = 'Show Original';

    const beautifyBtn = document.createElement('button');
    beautifyBtn.textContent = 'Beautify';
    beautifyBtn.classList.add('active');

    actionTab.append(showOriginalBtn, beautifyBtn);

    const pre = document.createElement('pre');
    const code = document.createElement('code');
    pre.appendChild(code);

    shell.append(actionTab, pre);
    body.appendChild(shell);

    document.documentElement.append(head, body);
    document.title = `${safeFilename} (Beautified)`;

    const updateCode = () => {
      code.innerHTML = highlightJs(showingBeautified ? beautifiedCode : originalCode);
      showOriginalBtn.classList.toggle('active', !showingBeautified);
      beautifyBtn.classList.toggle('active', showingBeautified);
    };

    updateCode();

    showOriginalBtn.addEventListener('click', () => {
      showingBeautified = false;
      updateCode();
    });

    beautifyBtn.addEventListener('click', () => {
      showingBeautified = true;
      updateCode();
    });
  }

  function renderError(message) {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;top:8px;right:8px;z-index:999999;background:#7f1d1d;color:#fff;padding:8px 10px;border-radius:6px;font:12px sans-serif;max-width:60vw';
    box.textContent = String(message);
    document.body?.appendChild(box);
    setTimeout(() => box.remove(), 5000);
  }
})();
