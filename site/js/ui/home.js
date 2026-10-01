// 冒險首頁：學習成果摘要、選來源、選環境、出發
import { L, state, save, RULES } from '../engine/store.js';
import { buildRun, currentSituation, situationProgress } from '../engine/run.js';
import * as T from '../engine/territory.js';
import { canListen } from '../audio.js';
import { esc } from './sheet.js';
import { shape } from './glyph.js';

const ENVS = [
  { id: 'speak', icon: shape('circle', 'red'), name: '開口', desc: '可以聽和說' },
  { id: 'ear', icon: shape('half', 'blue'), name: '耳機', desc: '只能聽' },
  { id: 'mute', icon: shape('square', 'ink'), name: '靜音', desc: '只能看' },
];

export function createHome(root, { getLang, onStart }) {
  function render() {
    const lang = getLang(), lg = L();
    const srcId = lg.source && lang.sources.some(s => s.id === lg.source) ? lg.source : lang.sources[0].id;
    const targets = [...lang.lemmas.values()].filter(x => x.target).map(x => x.lemma);
    const counts = [1, 2, 3, 4, 5].map(n => targets.filter(l => (lg.words[l]?.lv || 1) === n).length);
    const plan = buildRun(lang, srcId, state.env);
    const kinds = k => new Set(plan.queue.filter(i => i.kind === k).map(i => i.lemma)).size;

    root.innerHTML = `<div class="home-body">
      <div class="hero-num"><b>${T.count()}</b><span>領土格數（學過的實詞）</span></div>
      <div class="summary">${counts.map((c, i) => `<div><b>${c}</b><span>Lv${i + 1}</span></div>`).join('')}</div>

      <h3>來源</h3>
      ${lang.sources.map(src => {
        const sit = currentSituation(lang, src.id), p = situationProgress(lang, sit);
        const need = Math.ceil(p.total * RULES.completeRatio);
        return `<button class="src-card${src.id === srcId ? ' sel' : ''}" data-src="${src.id}">
          <div class="cover">${shape('square', 'yellow')}</div>
          <div style="flex:1;min-width:0">
            <b>${esc(src.title)}</b>
            <small><span class="tag">${esc(src.kind)}</span>第 ${sit.index + 1} / ${src.situations.length} 段：${esc(sit.title)}</small>
            <div class="bar"><i style="width:${Math.min(100, (p.done / need) * 100)}%"></i></div>
            <small>完成本段：${p.done} / ${need} 個實詞達到 Lv3</small>
          </div></button>`;
      }).join('')}

      <h3>環境（開局後不能更換）</h3>
      <div class="env-row">${ENVS.map(e => `<button class="env${state.env === e.id ? ' sel' : ''}" data-env="${e.id}">
        <i>${e.icon}</i><b>${e.name}</b><small>${e.desc}<br>積分 ×${RULES.envPoints[e.id]}</small></button>`).join('')}</div>
      ${state.env === 'speak' && !canListen ? '<p class="muted">這個瀏覽器不支援語音辨識，開口環境會改用點選作答（積分以耳機計）。</p>' : ''}

      <div class="plan"><span>本局練習 <b>${kinds('main')}</b> 字</span><span>複習 <b>${kinds('review')}</b></span><span>抽查 <b>${kinds('spot')}</b></span></div>
      <button class="btn gold big" id="go">出發！</button>
    </div>`;

    root.querySelectorAll('[data-src]').forEach(b => (b.onclick = () => { lg.source = b.dataset.src; save(); render(); }));
    root.querySelectorAll('[data-env]').forEach(b => (b.onclick = () => { state.env = b.dataset.env; save(); render(); }));
    root.querySelector('#go').onclick = () => onStart(srcId, state.env);
  }
  return { render, show: render, hide() {} };
}
