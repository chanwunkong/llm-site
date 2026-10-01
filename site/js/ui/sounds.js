// 發音頁（外層的參考入口，不計分）：沿用 IPA Mapper 的多語言比較
// 只列目標語言有的音；和「我會的語言」比較，分成「已經會／難音」；可以逐音標記我會／不會
import { L } from '../engine/store.js';
import * as P from '../engine/phono.js';
import { INVENTORY_SOURCES } from '../data/phonology.js';
import { LANGS } from '../data/wals.js';
import { speak } from '../audio.js';
import { esc, openSheet } from './sheet.js';
import { editKnown, knownRow, langName } from './known.js';

const GROUPS = [['consonant', '子音'], ['vowel', '母音']];

export function createSounds(root, { getLang }) {
  let onlyHard = false;
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

  function render() {
    const t = target(), inv = P.inventory(t), ks = P.knownSet(t);
    const st = s => P.soundStatus(s, t, ks);
    const hardN = inv.filter(s => st(s) === 'hard').length;
    const src = INVENTORY_SOURCES[t];
    root.innerHTML = `<div class="skills-page">
      <h2>🗣️ 發音</h2>
      ${knownRow(t)}
      <div class="panel stage-card">
        <div class="stage-head"><b>${esc(langName(t))}的音</b><span class="muted">共 ${inv.length} 個</span></div>
        <div class="stage-sum"><span><b class="hardc">${hardN}</b> 難音</span><span><b>${inv.length - hardN}</b> 已經會</span></div>
      </div>
      <p class="muted">「難音」是你會的語言裡都沒有的音。點一個音，可以聽含有這個音的字，也可以自己標記會或不會。</p>
      <div class="row-between"><span></span><button class="btn ghost sm" id="hardBtn">${onlyHard ? '只看難音 ●' : '顯示全部 ○'}</button></div>
      ${GROUPS.map(([cls, name]) => {
        const list = inv.filter(s => P.segClass(s) === cls && (!onlyHard || st(s) === 'hard'));
        return list.length ? `<h3>${name}（${list.length}）</h3><div class="snd-grid">${list.map(s =>
          `<button class="snd ${st(s)}" data-s="${esc(s)}">${esc(s)}${P.markOf(s) !== undefined ? '<i>✎</i>' : ''}</button>`).join('')}</div>` : '';
      }).join('')}
      <p class="muted">音位清單：PHOIBLE 2.0（Moran & McCloy 2019, CC BY-SA 3.0）${src ? `，${esc(langName(t))}採用 ${esc(src.source.toUpperCase())} 第 ${esc(src.inventory)} 號清單` : ''}。字的發音由 eSpeak NG（英文）與 pyopenjtalk（日文）產生。</p>
    </div>`;
    root.querySelector('[data-edit-known]').onclick = () => editKnown(t, render);
    root.querySelector('#hardBtn').onclick = () => { onlyHard = !onlyHard; render(); };
    root.querySelectorAll('[data-s]').forEach(b => (b.onclick = () => detail(b.dataset.s)));
  }

  function detail(seg) {
    const t = target(), lang = getLang(), status = P.soundStatus(seg, t);
    const have = LANGS.filter(l => l.id !== t && P.inventory(l.id).some(x => P.norm(x) === P.norm(seg)));
    const words = wordsWith(seg);
    const row = w => {
      const sg = P.wordSegs(lang.id, w) || [];
      return `<button class="ex-row" data-w="${esc(w)}">${esc(w)}　/${sg.map(x => x === seg ? `<mark>${esc(x)}</mark>` : esc(x)).join('')}/ 🔊</button>`;
    };
    const mark = P.markOf(seg);
    openSheet(`
      <h2 class="snd-title">${esc(seg)} <span class="tag ${status === 'hard' ? 'hard' : 'ok'}">${status === 'hard' ? '難音' : '已經會'}</span></h2>
      <p class="muted">${have.length ? `有這個音的語言：${have.map(l => esc(l.zh)).join('、')}` : '其他 19 種語言的清單裡都沒有這個音。'}</p>
      <div class="row">
        <button class="btn ${mark === true ? 'gold' : 'ghost'} sm" id="mk1">✓ 這個音我會</button>
        <button class="btn ${mark === false ? 'gold' : 'ghost'} sm" id="mk0">✗ 我還不會</button>
        ${mark !== undefined ? '<button class="btn ghost sm" id="mkx">恢復預設</button>' : ''}
      </div>
      <h3>你學過、含有這個音的字</h3>
      ${words.learned.length ? `<div class="stack">${words.learned.slice(0, 8).map(row).join('')}</div>` : '<p class="muted">還沒有。</p>'}
      ${words.other.length ? `<h3>來源裡含有這個音的字</h3><div class="stack">${words.other.slice(0, 5).map(row).join('')}</div>` : ''}
    `, {}, body => {
      body.querySelectorAll('[data-w]').forEach(b => (b.onclick = () => speak(b.dataset.w, { rate: 0.8 })));
      body.querySelector('#mk1').onclick = () => { P.setMark(seg, true); render(); detail(seg); };
      body.querySelector('#mk0').onclick = () => { P.setMark(seg, false); render(); detail(seg); };
      body.querySelector('#mkx')?.addEventListener('click', () => { P.setMark(seg, null); render(); detail(seg); });
    });
  }

  return { show: render, hide() {}, render };
}
