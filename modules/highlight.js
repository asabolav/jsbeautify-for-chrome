import { htmlEscape } from './utils.js';

const KEYWORDS = new Set(['const','let','var','function','return','if','else','for','while','switch','case','break','continue','new','class','extends','import','export','default','await','async','try','catch','finally','throw']);

export function highlightJs(code) {
  const escaped = htmlEscape(code);
  return escaped
    .replace(/(\/\/.*$)/gm, '<span class="tok-comment">$1</span>')
    .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="tok-comment">$1</span>')
    .replace(/(["'`])((?:\\.|(?!\1).)*)\1/g, '<span class="tok-string">$&</span>')
    .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-number">$1</span>')
    .replace(/\b([a-zA-Z_$][\w$]*)\b/g, (m, id) => (KEYWORDS.has(id) ? `<span class="tok-keyword">${id}</span>` : m));
}
