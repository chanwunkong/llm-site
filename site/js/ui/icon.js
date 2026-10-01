// 概念圖示：單一 emoji，或四種固定的組合模板
//   place / role：主圖大、修飾的小圖放角落（🏠＋🍳 廚房、🧑＋🚗 司機）
//   action：A → B（💵→🛍️ 買）
//   contrast：兩個並排，框起來的是答案（[🐘] 🐭 大）
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function iconHtml(spec, size = '') {
  if (!spec) return '';
  const cls = `cicon ${size}`;
  const s = spec.icon;
  if (spec.template === 'place' || spec.template === 'role') {
    const [a, b] = s.split('+');
    return `<span class="${cls} combo">${esc(a)}<small>${esc(b)}</small></span>`;
  }
  if (spec.template === 'action') {
    const [a, b] = s.split('>');
    return `<span class="${cls} act">${esc(a)}<i>➜</i>${esc(b)}</span>`;
  }
  if (spec.template === 'contrast') {
    return `<span class="${cls} pair">${s.split('|').map(x => {
      const e = x.replace('*', ''), n = [...new Intl.Segmenter().segment(e)].length;
      return `<span class="${x.startsWith('*') ? 'ans' : ''}"${n > 1 ? ` style="font-size:${Math.max(0.45, 1 - n * 0.15)}em"` : ''}>${esc(e)}</span>`;
    }).join('')}</span>`;
  }
  return `<span class="${cls}">${esc(s)}</span>`;
}
