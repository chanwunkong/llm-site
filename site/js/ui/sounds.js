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
import { PLACES, MANNERS, HEIGHTS, BACKS, position } from '../engine/ipa-chart.js';
import { known } from '../engine/store.js';


export function createSounds(root, { getLang }) {
  let hideEmpty = true;
  const target = () => getLang().wals;

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

  function grid(rows, cols, all, keyOf, rowKey, colKey, sideKey) {
    const cell = (r, c, side) => all.filter(x => keyOf(x) && x.pos[rowKey] === r && x.pos[colKey] === c && x.pos[sideKey] === side);
    const rowsUsed = rows.filter(([r]) => !hideEmpty || cols.some(([c]) => cell(r, c, false).length || cell(r, c, true).length));
    const colsUsed = cols.filter(([c]) => !hideEmpty || rows.some(([r]) => cell(r, c, false).length || cell(r, c, true).length));
    if (!rowsUsed.length) return '';
    return `<div class="ipa-wrap"><table class="ipa"><thead><tr><th></th>${colsUsed.map(([, zh]) => `<th colspan="2">${zh}</th>`).join('')}</tr></thead>
      <tbody>${rowsUsed.map(([r, zh]) => `<tr><th>${zh}</th>${colsUsed.map(([c]) =>
        `<td>${cell(r, c, false).map(btn).join('')}</td><td class="r">${cell(r, c, true).map(btn).join('')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function render() {
    const t = target(), all = items();
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
      ${grid(HEIGHTS, BACKS, all, x => x.pos.kind === 'vowel', 'height', 'back', 'round')}
      ${diph.length ? `<h3>雙母音</h3><div class="ipa-list">${diph.map(btn).join('')}</div>` : ''}
      ${other.length ? `<h3>其他</h3><div class="ipa-list">${other.map(btn).join('')}</div>` : ''}
      <p class="muted">音位清單：PHOIBLE 2.0（Moran & McCloy 2019, CC BY-SA 3.0）${src ? `，${esc(langName(t))}採用 ${esc(src.source.toUpperCase())} 第 ${esc(src.inventory)} 號清單` : ''}。字的發音由 eSpeak NG（英文）與 pyopenjtalk（日文）產生。</p>
    </div>`;
    root.querySelector('[data-edit-known]').onclick = () => editKnown(t, render);
    root.querySelector('#emptyBtn').onclick = () => { hideEmpty = !hideEmpty; render(); };
    root.querySelectorAll('[data-s]').forEach(b => (b.onclick = () => detail(b.dataset.s)));
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
