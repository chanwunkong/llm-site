// 冒險首頁：學習成果摘要、選來源、選環境、出發
import { L, state, save, RULES } from '../engine/store.js';
import { buildRun, currentSituation, situationProgress } from '../engine/run.js';
import * as T from '../engine/territory.js';
import { canListen } from '../audio.js';
import { esc, openSheet, closeSheet } from './sheet.js';
import { openImport } from './import-sheet.js';
import { starRow } from './play.js';
import { iconHtml } from './icon.js';
import { removeImport } from '../engine/importer.js';
import { shape } from './glyph.js';

const ENVS = [
  { id: 'speak', icon: shape('circle', 'red'), name: '開口', desc: '可以聽和說' },
  { id: 'ear', icon: shape('half', 'blue'), name: '耳機', desc: '只能聽' },
  { id: 'mute', icon: shape('square', 'ink'), name: '靜音', desc: '只能看' },
];

export function createHome(root, { getLang, onStart, onSourcesChanged }) {
  const importBtn = '<button class="btn ghost big" id="imp">＋ 匯入文章</button>';
  const afterImport = src => { onSourcesChanged(); L().source = src.id; save(); render(); };
  function render() {
    const lang = getLang(), lg = L();
    // 還沒有任何來源（內建示範只有英文、日文）：只顯示匯入
    if (!lang.sources.length) {
      root.innerHTML = `<div class="home-body">
        <div class="hero-num"><b>${T.count()}</b><span>領土格數（學過的實詞）</span></div>
        <div class="panel"><b>還沒有可以學的文章</b><p class="muted">匯入一篇你想讀的內容，系統會自動拆成句子出題。</p></div>
        ${importBtn}</div>`;
      root.querySelector('#imp').onclick = () => openImport(state.lang, afterImport);
      return;
    }
    const srcId = lg.source && lang.sources.some(s => s.id === lg.source) ? lg.source : lang.sources[0].id;
    // 等級統計：文章裡的字加上基元
    const targets = [...new Set([...[...lang.lemmas.values()].filter(x => x.target).map(x => x.lemma), ...lang.core.map(p => p.key)])];
    const counts = [1, 2, 3, 4, 5].map(n => targets.filter(l => (lg.words[l]?.lv || 1) === n).length);
    const plan = buildRun(lang, srcId, state.env);
    const kinds = k => new Set(plan.queue.filter(i => i.kind === k).map(i => i.lemma)).size;

    root.innerHTML = `<div class="home-body">
      <div class="hero-num"><b>${T.count()}</b><span>領土格數（學過的實詞）</span></div>
      <div class="summary">${counts.map((c, i) => `<div><b>${c}</b><span>Lv${i + 1}</span></div>`).join('')}</div>

      <h3>來源</h3>
      ${coreHint(lang, lg)}
      ${lang.sources.map(src => {
        if (src.core) return coreCard(src, lang, lg, srcId);
        const sit = currentSituation(lang, src.id), p = situationProgress(lang, sit);
        const need = Math.ceil(p.total * RULES.completeRatio);
        return `<button class="src-card${src.id === srcId ? ' sel' : ''}" data-src="${src.id}">
          <div class="cover">${shape('square', 'yellow')}</div>
          <div style="flex:1;min-width:0">
            <b>${esc(src.title)}</b>
            <small><span class="tag">${esc(src.kind)}</span>第 ${sit.index + 1} / ${src.situations.length} 段：${esc(sit.title)}</small>
            <small class="best">${starRow(lg.best?.[sit.key]?.stars || 0, true)}${lg.best?.[sit.key] ? ` 最佳 ${lg.best[sit.key].score} 分` : ' 還沒玩過這段'}</small>
            ${src.credit ? `<small class="credit">${esc(src.credit)}</small>` : ''}
            ${src.imported ? `<span class="linkish" data-del="${src.id}">刪除</span>` : ''}
            <div class="bar"><i style="width:${Math.min(100, (p.done / need) * 100)}%"></i></div>
            <small>完成本段：${p.done} / ${need} 個實詞達到 Lv3</small>
          </div></button>`;
      }).join('')}

      ${importBtn}
      <h3>環境（開局後不能更換）</h3>
      <div class="env-row">${ENVS.map(e => `<button class="env${state.env === e.id ? ' sel' : ''}" data-env="${e.id}">
        <i>${e.icon}</i><b>${e.name}</b><small>${e.desc}<br>積分 ×${RULES.envPoints[e.id]}</small></button>`).join('')}</div>
      ${state.env === 'speak' && !canListen ? '<p class="muted">這個瀏覽器不支援語音辨識，開口環境會改用點選作答（積分以耳機計）。</p>' : ''}

      <div class="plan"><span>本局練習 <b>${kinds('main')}</b> 字</span><span>複習 <b>${kinds('review')}</b></span><span>抽查 <b>${kinds('spot')}</b></span></div>
      <button class="btn gold big" id="go">出發！</button>
    </div>`;

    root.querySelectorAll('[data-src]').forEach(b => (b.onclick = e => {
      if (e.target.dataset.del) return confirmDelete(lang.sources.find(s => s.id === e.target.dataset.del));
      lg.source = b.dataset.src; save(); render();
    }));
    root.querySelector('#imp').onclick = () => openImport(state.lang, afterImport);
    root.querySelectorAll('[data-env]').forEach(b => (b.onclick = () => { state.env = b.dataset.env; save(); render(); }));
    root.querySelector('#go').onclick = () => onStart(srcId, state.env);
  }
  // 「基元 65」的卡片：進度是到達 Lv2 的基元數
  function coreCard(src, lang, lg, srcId) {
    const total = lang.core.length, done = lang.core.filter(p => (lg.words[p.key]?.lv || 1) >= 2).length;
    const sit = currentSituation(lang, src.id);
    return `<button class="src-card${src.id === srcId ? ' sel' : ''}" data-src="${src.id}">
      <div class="cover core-cover">${lang.core[0] ? iconHtml(lang.core[0].icon) : ''}</div>
      <div style="flex:1;min-width:0">
        <b>${esc(src.title)}</b>
        <small><span class="tag">${esc(src.kind)}</span>最基本的 65 個意思，用圖示學，不需要文章</small>
        <small class="best">${starRow(lg.best?.[sit.key]?.stars || 0, true)}${lg.best?.[sit.key] ? ` 最佳 ${lg.best[sit.key].score} 分` : ' 還沒玩過'}</small>
        <small class="credit">${esc(src.credit)}</small>
        <div class="bar"><i style="width:${total ? (done / total) * 100 : 0}%"></i></div>
        <small>${done} / ${total} 個基元達到 Lv2</small>
      </div></button>`;
  }
  // 一半的基元到 Lv2：提示可以開始讀文章
  function coreHint(lang, lg) {
    const total = lang.core.length, done = lang.core.filter(p => (lg.words[p.key]?.lv || 1) >= 2).length;
    if (!total || done < Math.ceil(total / 2)) return '';
    const article = lang.sources.find(s => !s.core);
    return `<div class="panel core-hint"><b>你已經學會 ${done} 個基元，可以開始讀文章了</b>
      <p class="muted">文章裡的基元你都看得懂，可以幫你推測其他字的意思。${article ? '' : '這個語言還沒有文章，請先匯入一篇。'}</p>
      ${article ? `<button class="btn sm" data-src="${article.id}">選「${esc(article.title)}」</button>` : ''}</div>`;
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
