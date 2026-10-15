// 首頁（最小可行系統）：我會多少、今天要確認的字、選來源、開始一局（3 分鐘）
import { L, state, save } from '../engine/store.js';
import * as T from '../engine/territory.js';
import * as V from '../engine/v2.js';
import { esc, openSheet, closeSheet } from './sheet.js';
import { openImport } from './import-sheet.js';
import { removeImport } from '../engine/importer.js';
import { iconHtml } from './icon.js';
import { shape } from './glyph.js';

export function createHome(root, { getLang, onStart, onSourcesChanged }) {
  const afterImport = src => { onSourcesChanged(); L().source = src.id; save(); render(); };
  function render() {
    const lang = getLang(), lg = L(), d = V.today();
    const words = Object.values(lg.words);
    const counts = [1, 2, 3, 4, 5].map(n => words.filter(w => w.lv === n).length);
    const confirm = words.filter(w => w.okDay != null && w.okDay < d).length;
    const write = words.filter(w => w.lv === 2).length;
    const srcId = lg.source && lang.sources.some(s => s.id === lg.source) ? lg.source : lang.sources[0]?.id;
    root.innerHTML = `<div class="home-body">
      <div class="hero-num"><b>${T.count()}</b><span>領土：我會的東西</span></div>
      <div class="summary">${counts.map((c, i) => `<div><b>${c}</b><span>Lv${i + 1} ${V.LV_NAME[i + 1]}</span></div>`).join('')}</div>
      ${confirm || write ? `<div class="panel"><b>今天可以做的</b><p class="muted">${[confirm && `${confirm} 個字等著再答對一次就升級`, write && `${write} 個字等你寫下理解`].filter(Boolean).join('；')}</p></div>` : ''}
      <h3>學習資料</h3>
      ${lang.sources.map(src => `<button class="src-card${src.id === srcId ? ' sel' : ''}" data-src="${src.id}">
        <div class="cover${src.core ? ' core-cover' : ''}">${src.core && lang.core[0] ? iconHtml(lang.core[0].icon) : shape('square', 'yellow')}</div>
        <div style="flex:1;min-width:0"><b>${esc(src.title)}</b>
          <small><span class="tag">${esc(src.kind)}</span>${src.core ? '最一開始的 65 個字' : `${src.situations.length} 段`}</small>
          ${src.credit ? `<small class="credit">${esc(src.credit)}</small>` : ''}
          ${src.imported ? `<span class="linkish" data-del="${src.id}">刪除</span>` : ''}</div></button>`).join('')}
      <button class="btn ghost big" id="imp">＋ 匯入文章</button>
      ${srcId ? '<button class="btn gold big" id="go">開始（3 分鐘）</button>' : ''}
    </div>`;
    root.querySelectorAll('[data-src]').forEach(b => (b.onclick = e => {
      if (e.target.dataset.del) return confirmDelete(lang.sources.find(s => s.id === e.target.dataset.del));
      lg.source = b.dataset.src; save(); render();
    }));
    root.querySelector('#imp').onclick = () => openImport(state.lang, afterImport);
    root.querySelector('#go')?.addEventListener('click', () => onStart(srcId));
  }
  function confirmDelete(src) {
    openSheet(`<h2>刪除「${esc(src.title)}」？</h2><p class="muted">文章會從這個瀏覽器移除。已經學過的字和領土不受影響。</p>
      <div class="row"><button class="btn ghost big" id="no">取消</button><button class="btn gold big" id="yes">刪除</button></div>`, {}, body => {
      body.querySelector('#no').onclick = closeSheet;
      body.querySelector('#yes').onclick = () => { removeImport(state.lang, src.id); closeSheet(); onSourcesChanged(); render(); };
    });
  }
  return { render, show: render, hide() {} };
}
