// 發音頁（外層的參考入口，不計分）：沿用 IPA Mapper 的多語言比較
// 只列目標語言有的音；和「我會的語言」比較，分成「已經會／難音」；可以逐音標記我會／不會
import { L } from '../engine/store.js';
import * as P from '../engine/phono.js';
import { INVENTORY_SOURCES } from '../data/phonology.js';
import { LANGS } from '../data/wals.js';
import { speak } from '../audio.js';
import { esc, openSheet } from './sheet.js';
import { editKnown, knownRow, langName } from './known.js';
import { G } from './glyph.js';
import { PLACES, MANNERS, HEIGHTS, BACKS, position, base } from '../engine/ipa-chart.js';
import { known } from '../engine/store.js';


export function createSounds(root, { getLang }) {
  let hideEmpty = true;
  // 母音表分兩層：mono 單母音、multi 多母音（點起點母音才畫出箭頭）
  let layer = 'mono', start = null, focus = null, lastAll = [];
  const target = () => getLang().wals;
  addEventListener('resize', () => drawArrows());

  // 含有某個音的字：學過的（Lv2 以上）優先，其次是來源裡的字
  function wordsWith(seg) {
    const lang = getLang(), lg = L(), out = { learned: [], other: [] };
    for (const [lemma, info] of lang.lemmas) {
      if (!info.target) continue;
      const sg = P.wordSegs(lang.id, lemma);
      if (!sg || !sg.includes(seg)) continue;
      ((lg.words[lemma]?.lv || 1) >= 2 ? out.learned : out.other).push(lemma);
    }
    return out;
  }

  // 表格裡要放的音：目標語言的音（標狀態），加上只有「我會的語言」才有的音（灰色，用來比較相鄰的音）
  function items() {
    const t = target(), ks = P.knownSet(t), tn = new Set(P.inventory(t).map(P.norm));
    const out = P.inventory(t).map(seg => ({ seg, who: 'target', status: P.soundStatus(seg, t, ks) }));
    const seen = new Set();
    for (const id of known().filter(id => id !== t))
      for (const seg of P.inventory(id)) {
        const n = P.norm(seg);
        if (tn.has(n) || seen.has(n)) continue;
        seen.add(n);
        out.push({ seg, who: 'known', status: 'absent' });
      }
    return out.map(x => ({ ...x, pos: position(x.seg) }));
  }

  const btn = x => `<button class="ipa-s ${x.who === 'target' ? x.status : 'absent'}" data-s="${esc(x.seg)}">${esc(x.seg)}${x.who === 'target' && P.markOf(x.seg) !== undefined ? '<i>✎</i>' : ''}</button>`;

  const diphs = all => all.filter(x => x.pos.kind === 'diphthong');
  // 每個起點母音有幾個多母音
  const startCounts = all => {
    const m = new Map();
    for (const d of diphs(all)) { const c = d.pos.parts[0].c; m.set(c, (m.get(c) || 0) + 1); }
    return m;
  };
  // 多母音層：多母音的組成母音若不在表上（例如英語 aɪ 的 a），補一個定位點
  function vowelItems(all) {
    const v = all.filter(x => x.pos.kind === 'vowel');
    if (layer === 'mono') return v;
    const have = new Set(v.map(x => base(x.seg))), extra = [];
    for (const d of diphs(all))
      for (const p of d.pos.parts)
        if (!have.has(p.c)) { have.add(p.c); extra.push({ seg: p.c, who: 'anchor', pos: { kind: 'vowel', height: p.height, back: p.back, round: p.round } }); }
    return v.concat(extra);
  }
  // 多母音層的母音：能當起點的標出數量，其餘變淡
  function vbtn(counts) {
    return x => {
      const b = base(x.seg), n = counts.get(b) || 0;
      return `<button class="ipa-s ${n ? 'start' : 'dim'}${start === b ? ' sel' : ''}" data-v="${esc(b)}"${n ? '' : ' tabindex="-1"'}>${esc(x.seg)}${n ? `<sup>${n}</sup>` : ''}</button>`;
    };
  }

  function grid(rows, cols, all, keyOf, rowKey, colKey, sideKey, cellHtml = btn, stage = false) {
    const cell = (r, c, side) => all.filter(x => keyOf(x) && x.pos[rowKey] === r && x.pos[colKey] === c && x.pos[sideKey] === side);
    const rowsUsed = rows.filter(([r]) => !hideEmpty || cols.some(([c]) => cell(r, c, false).length || cell(r, c, true).length));
    const colsUsed = cols.filter(([c]) => !hideEmpty || rows.some(([r]) => cell(r, c, false).length || cell(r, c, true).length));
    if (!rowsUsed.length) return '';
    return `<div class="ipa-wrap">${stage ? '<div class="ipa-stage">' : ''}<table class="ipa"><thead><tr><th></th>${colsUsed.map(([, zh]) => `<th colspan="2">${zh}</th>`).join('')}</tr></thead>
      <tbody>${rowsUsed.map(([r, zh]) => `<tr><th>${zh}</th>${colsUsed.map(([c]) =>
        `<td>${cell(r, c, false).map(cellHtml).join('')}</td><td class="r">${cell(r, c, true).map(cellHtml).join('')}</td>`).join('')}</tr>`).join('')}</tbody></table>${stage ? '<svg class="ipa-arrows"></svg><div class="ipa-labels"></div></div>' : ''}</div>`;
  }

  function render() {
    const t = target(), all = items();
    lastAll = all;
    const mine = all.filter(x => x.who === 'target');
    const hardN = mine.filter(x => x.status === 'hard').length;
    const src = INVENTORY_SOURCES[t];
    const diph = all.filter(x => x.pos.kind === 'diphthong'), other = all.filter(x => x.pos.kind === 'other');
    root.innerHTML = `<div class="skills-page">
      <h2>發音</h2>
      ${knownRow(t)}
      <div class="panel stage-card">
        <div class="stage-head"><b>${esc(langName(t))}的音</b><span class="muted">共 ${mine.length} 個</span></div>
        <div class="stage-sum"><span><b class="hardc">${hardN}</b> 難音</span><span><b>${mine.length - hardN}</b> 已經會</span></div>
      </div>
      <div class="legend"><span class="ipa-s hard">難音</span><span class="ipa-s known">已經會</span><span class="ipa-s absent">只有你會的語言有</span></div>
      <p class="muted">位置相鄰的音，發音方式也相近。看難音旁邊有哪些你已經會的音，就知道要調整哪裡。點一個音可以聽例字。</p>
      <div class="row-between"><span></span><button class="btn ghost sm" id="emptyBtn">${hideEmpty ? '隱藏空欄位 ●' : '顯示空欄位 ○'}</button></div>
      <h3>子音 <small>（列：發音方法；欄：發音部位；每格左清右濁）</small></h3>
      ${grid(MANNERS, PLACES, all, x => x.pos.kind === 'consonant', 'manner', 'place', 'voiced')}
      <h3>母音 <small>（列：舌位高低；欄：前後；每格左展右圓）</small></h3>
      ${diph.length ? `<div class="seg-toggle"><button data-layer="mono" class="${layer === 'mono' ? 'on' : ''}">單母音</button><button data-layer="multi" class="${layer === 'multi' ? 'on' : ''}">多母音</button></div>` : ''}
      ${layer === 'multi' ? `<p class="muted">點一個標有數字的母音，畫出從它出發的多母音；點終點旁的標籤可以聽例字。</p>` : ''}
      ${grid(HEIGHTS, BACKS, vowelItems(all), x => x.pos.kind === 'vowel', 'height', 'back', 'round', layer === 'multi' ? vbtn(startCounts(all)) : btn, layer === 'multi')}
      ${diph.length ? `<h3>多母音</h3><div class="ipa-list">${diph.map(x => btn(x).replace('data-s=', 'data-d=')).join('')}</div>` : ''}
      ${other.length ? `<h3>其他</h3><div class="ipa-list">${other.map(btn).join('')}</div>` : ''}
      <p class="muted">音位清單：PHOIBLE 2.0（Moran & McCloy 2019, CC BY-SA 3.0）${src ? `，${esc(langName(t))}採用 ${esc(src.source.toUpperCase())} 第 ${esc(src.inventory)} 號清單` : ''}。字的發音由 eSpeak NG（英文）與 pyopenjtalk（日文）產生。</p>
    </div>`;
    root.querySelector('[data-edit-known]').onclick = () => editKnown(t, render);
    root.querySelector('#emptyBtn').onclick = () => { hideEmpty = !hideEmpty; render(); };
    root.querySelectorAll('[data-s]').forEach(b => (b.onclick = () => detail(b.dataset.s)));
    root.querySelectorAll('[data-layer]').forEach(b => (b.onclick = () => { layer = b.dataset.layer; start = focus = null; render(); }));
    // 清單裡的多母音：切到多母音層、選取它的起點，並標示這條箭頭
    root.querySelectorAll('.ipa-list [data-d]').forEach(b => (b.onclick = () => {
      const d = lastAll.find(x => x.seg === b.dataset.d);
      layer = 'multi'; start = d.pos.parts[0].c; focus = d.seg;
      render();
      root.querySelector('.ipa-stage')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }));
    const stage = root.querySelector('.ipa-stage');
    if (stage) stage.onclick = e => {
      const v = e.target.closest('[data-v]');
      if (e.target.closest('.ipa-labels button, [data-hit]')) return;
      const b = v && v.classList.contains('start') ? v.dataset.v : null;
      start = b && b !== start ? b : null;   // 再點同一個起點或點空白處：收起
      focus = null;
      stage.querySelectorAll('[data-v]').forEach(el => el.classList.toggle('sel', el.dataset.v === start));
      drawArrows();
    };
    drawArrows();
  }

  // 從選取的起點畫出箭頭（三合母音畫成折線），終點旁放標籤
  const STROKE = { hard: '#D7262E', known: '#111111', absent: '#8A8A8A' };
  function drawArrows() {
    const stage = root.querySelector('.ipa-stage');
    if (!stage) return;
    const svg = stage.querySelector('svg'), lab = stage.querySelector('.ipa-labels');
    const sr = stage.getBoundingClientRect();
    svg.setAttribute('width', sr.width); svg.setAttribute('height', sr.height);
    svg.innerHTML = ''; lab.innerHTML = '';
    if (!start) return;
    const pt = c => {
      const el = stage.querySelector(`[data-v="${CSS.escape(c)}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return [r.left - sr.left + r.width / 2, r.top - sr.top + r.height / 2];
    };
    const list = diphs(lastAll).filter(d => d.pos.parts[0].c === start);
    const defs = Object.entries(STROKE).map(([k, c]) =>
      `<marker id="ah-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="${c}"/></marker>`).join('');
    const stack = new Map();   // 同一個終點的標籤往上疊
    let paths = '';
    for (const d of list) {
      const st = d.who === 'target' ? d.status : 'absent';
      const pts = d.pos.parts.map(p => pt(p.c)).filter(Boolean)
        .filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
      if (!pts.length) continue;
      const dim = focus && focus !== d.seg ? ' style="opacity:.2"' : '';
      const w = focus === d.seg ? 3.5 : 2.5, dash = st === 'absent' ? ' stroke-dasharray="5 4"' : '';
      let geom;
      if (pts.length === 1) {   // 起點和終點是同一個母音（例如 ii̯）：畫一個小圈
        const [x, y] = pts[0];
        geom = `<circle cx="${x}" cy="${y}" r="18" fill="none"`;
      } else {
        // 兩端各縮短一點，不蓋住符號
        const trim = (a, b, k) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [a[0] + dx / l * k, a[1] + dy / l * k]; };
        const q = pts.slice();
        q[0] = trim(pts[0], pts[1], 14);
        q[q.length - 1] = trim(pts[pts.length - 1], pts[pts.length - 2], 16);
        geom = `<polyline points="${q.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}" fill="none" marker-end="url(#ah-${st})"`;
      }
      paths += `<g data-hit="${esc(d.seg)}"${dim}>${geom} stroke="${STROKE[st]}" stroke-width="${w}"${dash} stroke-linejoin="round"/>${geom.replace(/ marker-end="[^"]*"/, '')} stroke="transparent" stroke-width="16" style="pointer-events:stroke;cursor:pointer"/></g>`;
      const end = pts[pts.length - 1], key = end.join(), k = stack.get(key) || 0;
      stack.set(key, k + 1);
      lab.insertAdjacentHTML('beforeend', `<button class="ipa-s ${st}${focus === d.seg ? ' focus' : ''}" data-l="${esc(d.seg)}" style="left:${end[0] + 14}px;top:${end[1] - 13 + k * 26}px"${dim}>${esc(d.seg)}</button>`);
    }
    svg.innerHTML = `<defs>${defs}</defs>${paths}`;
    svg.querySelectorAll('[data-hit]').forEach(g => (g.onclick = () => detail(g.dataset.hit)));
    lab.querySelectorAll('[data-l]').forEach(b => (b.onclick = () => detail(b.dataset.l)));
  }

  function detail(seg) {
    const t = target(), lang = getLang();
    const inTarget = P.inventory(t).includes(seg);
    const status = inTarget ? P.soundStatus(seg, t) : 'absent';
    const have = LANGS.filter(l => l.id !== t && P.inventory(l.id).some(x => P.norm(x) === P.norm(seg)));
    const words = inTarget ? wordsWith(seg) : { learned: [], other: [] };
    const row = w => {
      const sg = P.wordSegs(lang.id, w) || [];
      return `<button class="ex-row" data-w="${esc(w)}">${esc(w)}　/${sg.map(x => x === seg ? `<mark>${esc(x)}</mark>` : esc(x)).join('')}/ ${G.speaker(14)}</button>`;
    };
    const mark = P.markOf(seg);
    const TAG = { hard: '<span class="tag hard">難音</span>', known: '<span class="tag ok">已經會</span>', absent: `<span class="tag">${esc(langName(t))}沒有這個音</span>` };
    openSheet(`
      <h2 class="snd-title">${esc(seg)} ${TAG[status]}</h2>
      <p class="muted">${have.length ? `有這個音的語言：${have.map(l => esc(l.zh)).join('、')}` : '其他語言的清單裡都沒有這個音。'}</p>
      ${inTarget ? `<div class="row">
        <button class="btn ${mark === true ? 'gold' : 'ghost'} sm" id="mk1">這個音我會</button>
        <button class="btn ${mark === false ? 'gold' : 'ghost'} sm" id="mk0">我還不會</button>
        ${mark !== undefined ? '<button class="btn ghost sm" id="mkx">恢復預設</button>' : ''}
      </div>
      <h3>你學過、含有這個音的字</h3>
      ${words.learned.length ? `<div class="stack">${words.learned.slice(0, 8).map(row).join('')}</div>` : '<p class="muted">還沒有。</p>'}
      ${words.other.length ? `<h3>來源裡含有這個音的字</h3><div class="stack">${words.other.slice(0, 5).map(row).join('')}</div>` : ''}`
      : '<p class="muted">這是你會的語言裡有、但目標語言沒有的音。放在表格裡，是為了和旁邊目標語言的音比較。</p>'}
    `, {}, body => {
      body.querySelectorAll('[data-w]').forEach(b => (b.onclick = () => speak(b.dataset.w, { rate: 0.8 })));
      body.querySelector('#mk1')?.addEventListener('click', () => { P.setMark(seg, true); render(); detail(seg); });
      body.querySelector('#mk0')?.addEventListener('click', () => { P.setMark(seg, false); render(); detail(seg); });
      body.querySelector('#mkx')?.addEventListener('click', () => { P.setMark(seg, null); render(); detail(seg); });
    });
  }

  return { show: render, hide() {}, render };
}
