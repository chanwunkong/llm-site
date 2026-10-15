// 寫下理解：用圖示（emoji）和已經會的字組合。沒有標準答案，系統不判斷對錯。
// 圖示只能從調色盤挑（不提供用名稱搜尋：名稱是某個語言的字，會多一層翻譯）。
import { esc } from './sheet.js';
import { iconHtml } from './icon.js';
import { usableWords, isEmojiPart } from '../engine/v2.js';
import { speak, sfx } from '../audio.js';

// 圖示設定（基元與概念清單的 icon）拆成可以單獨使用的 emoji
const pieces = spec => (spec?.icon ? spec.icon.replace(/[*]/g, '').split(/[+>|]/).map(x => x.trim()).filter(Boolean) : []);
function palette(lang, suggest) {
  const out = new Set(pieces(suggest));
  for (const p of lang.core || []) pieces(p.icon).forEach(e => out.add(e));
  for (const spec of Object.values(lang.base || {})) pieces(spec).forEach(e => out.add(e));
  return [...out];
}

export const partHtml = (p, attrs = '') => (isEmojiPart(p) ? `<span class="mpart emoji" ${attrs}>${esc(p.slice(6))}</span>` : `<span class="mpart word" ${attrs} dir="auto">${esc(p)}</span>`);
export const partsHtml = parts => parts.map(p => partHtml(p)).join('<i>＋</i>');

// 在 container 裡畫出組合工具。onSave(parts)
export function mountComposer(container, { lang, lemma, initial = [], suggest = null, onSave }) {
  let parts = [...initial], tab = 'emoji', filter = '';
  const emojis = palette(lang, suggest), words = usableWords(lemma).sort((a, b) => a.localeCompare(b));
  const draw = () => {
    const list = words.filter(w => !filter || w.toLocaleLowerCase().includes(filter.toLocaleLowerCase()));
    container.innerHTML = `
      <div class="mine compose" id="parts">${parts.length ? parts.map((p, i) => partHtml(p, `data-rm="${i}"`)).join('<i>＋</i>') : '<span class="muted">從下面挑圖示或字</span>'}</div>
      <div class="seg-toggle"><button data-t="emoji" class="${tab === 'emoji' ? 'on' : ''}">圖示</button><button data-t="word" class="${tab === 'word' ? 'on' : ''}">我會的字（${words.length}）</button></div>
      ${tab === 'emoji' ? `<div class="palette">${emojis.map((e, i) => `<button class="pal${i < pieces(suggest).length ? ' sug' : ''}" data-e="${esc(e)}">${esc(e)}</button>`).join('')}</div>`
        : `<input class="filter" id="wf" placeholder="找字" value="${esc(filter)}" autocomplete="off" autocapitalize="off" spellcheck="false">
          <div class="materials">${list.map(w => `<button class="mpart word" data-w="${esc(w)}" dir="auto">${esc(w)}</button>`).join('') || `<span class="muted">${words.length ? '找不到' : '還沒有會的字。先用圖示'}</span>`}</div>`}
      <button class="btn gold big" id="saveU"${parts.length ? '' : ' disabled'}>完成</button>`;
    container.querySelectorAll('[data-rm]').forEach(b => (b.onclick = () => { parts.splice(+b.dataset.rm, 1); draw(); }));
    container.querySelectorAll('[data-t]').forEach(b => (b.onclick = () => { tab = b.dataset.t; draw(); }));
    container.querySelectorAll('[data-e]').forEach(b => (b.onclick = () => { parts.push(`emoji:${b.dataset.e}`); sfx('tap'); draw(); }));
    container.querySelectorAll('[data-w]').forEach(b => (b.onclick = () => { parts.push(b.dataset.w); sfx('tap'); speak(b.dataset.w, { rate: 0.85 }); draw(); }));
    const wf = container.querySelector('#wf');
    if (wf) wf.oninput = e => { filter = e.target.value; const pos = e.target.selectionStart; draw(); const n = container.querySelector('#wf'); n.focus(); n.setSelectionRange(pos, pos); };
    container.querySelector('#saveU').onclick = () => parts.length && onSave(parts);
  };
  draw();
}
export { iconHtml };
