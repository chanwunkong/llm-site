// 一局（最小可行模型）：看圖示和字、點一下聽發音、唸出來；每個音都評分，得到總分
// 結果像 ELSA：字母和音標依每個音上色（綠＝正確、橙＝有點問題、紅＝需要加強），點一個音看回饋
import * as M from '../engine/lv1.js';
import { speak, stopSpeech, sfx } from '../audio.js';
import { openSheet, closeSheet, esc } from './sheet.js';
import { iconHtml } from './icon.js';
import * as P from '../engine/phono.js';
import { G } from './glyph.js';
import * as PR from '../engine/pronounce.js';
import * as PL from '../engine/pronlog.js';
import * as LT from '../engine/letters.js';
import * as PC from './pron-chart.js';
import { base, position } from '../engine/ipa-chart.js';
import { state, save } from '../engine/store.js';

export function createPlay(root, { onEnd }) {
  let run, key, busy = false;
  const $ = s => root.querySelector(s);

  function start(lang) {
    run = M.startRun(lang);
    result = null; myPcm = null;
    document.body.classList.add('playing');
    root.hidden = false;
    root.innerHTML = `<div class="hud"><button class="icon-btn" id="quit" aria-label="結束">${G.close()}</button>
      <div class="prog"><i></i></div><div class="clock" id="count"></div></div><div class="qcard" id="qcard"></div>`;
    $('#quit').onclick = quit;
    next();
  }

  function next() {
    stopSpeech();
    key = M.current(run);
    if (!key) return finish();
    $('.prog i').style.width = `${(run.pos / run.queue.length) * 100}%`;
    $('#count').textContent = `${run.pos + 1}/${run.queue.length}`;
    render();
    say();
  }
  const say = () => speak(key, { rate: 0.8 });

  // 簡單：只評重點音（目標語言有、我會的語言沒有的難音）；進階：整個字每個音都評
  const mode = () => state.pronMode || 'simple';
  const hardSet = () => new Set([...P.hardSounds(run.lang.wals)].map(base));
  // 這次要評的音（per 的索引）：簡單模式只評難音；字裡沒有難音就全部評
  function judged(r, m = mode()) {
    const all = r.per.map((x, i) => (x ? i : -1)).filter(i => i >= 0);
    if (m !== 'simple') return all;
    const hs = hardSet(), focus = all.filter(i => hs.has(base(r.ipa[i])));
    return focus.length ? focus : all;
  }
  const scoreOf = (r, m = mode()) => {
    if (m !== 'simple') return r.total;
    const js = judged(r, m);
    return Math.round((100 * js.reduce((a, i) => a + r.per[i].p, 0)) / js.length);
  };
  const LEVEL = { good: '正確', close: '有點問題', bad: '需要加強' };
  // 每個音和整個字用同一套門檻（單音節的字，音的分數就是總分，顏色也要一樣）
  const levelOf = pct => (pct >= 80 ? 'good' : pct >= 50 ? 'close' : 'bad');

  // 版面固定：字、音標、狀態列、下面兩排按鈕的位置在唸之前和唸之後都一樣；細節點了才在底部面板打開
  let result = null, myPcm = null;
  function render() {
    const p = M.prime(run, key), before = run.scores[key];
    const shown = result ? before.slice(0, -1) : before;
    const m = mode();
    $('#qcard').innerHTML = `
      <div class="badges pr-top"><span class="badge lv">第 ${shown.length + 1} 次</span><span class="pr-prev">${shown.length ? `之前：${shown.join('、')}` : ''}</span>
        <span class="seg-toggle pr-mode">${[['simple', '簡單'], ['full', '進階']].map(([k, z]) => `<button data-m="${k}" class="${m === k ? 'on' : ''}">${z}</button>`).join('')}</span></div>
      <div class="pr-stage">
        <button class="core-icon icon-tap" id="icon">${iconHtml(p.icon)}</button>
        ${wordHtml()}
        <div class="pr-status" id="status">${statusHtml()}</div>
      </div>
      <div class="pr-bar">
        <button class="btn ghost" id="listen">${G.speaker()} 標準發音</button>
        <button class="btn ghost" id="mine"${myPcm ? '' : ' disabled'}>▶ 我的錄音</button>
      </div>
      <div class="pr-bar">
        <button class="btn gold big mic" id="mic">${G.mic()} ${result ? '再唸一次' : '唸出來'}</button>
        <button class="btn green big" id="cont"${result ? '' : ' disabled'}>繼續 ›</button>
      </div>`;
    $('#icon').onclick = say;
    $('#listen').onclick = say;
    $('#mine').onclick = playMine;
    $('#mic').onclick = () => {
      // 再唸一次：剛才那一次不算
      if (result) { M.undo(run, key); result = null; }
      mic();
    };
    $('#cont').onclick = () => { result = null; myPcm = null; next(); };
    root.querySelectorAll('.pr-mode button').forEach(b => (b.onclick = () => {
      state.pronMode = b.dataset.m;
      save();
      if (result) M.rescore(run, key, scoreOf(result));
      render();
    }));
    root.querySelectorAll('[data-tok]').forEach(b => (b.onclick = () => detail(+b.dataset.tok)));
  }

  // 字和音標：還沒唸時是黑色（簡單模式在音標上把難音畫底線）；唸完依每個音上色
  function wordHtml() {
    if (!result) {
      const ipa = P.wordSegs(run.lang.id, key), hs = mode() === 'simple' ? hardSet() : new Set();
      return `<div class="pr-word" dir="auto">${esc(key)}</div>
        <div class="ipa big pr-ipa">${ipa ? `/${ipa.map(s => (hs.has(base(s)) ? `<u>${esc(s)}</u>` : esc(s))).join('')}/` : ''}</div>`;
    }
    const r = result, js = new Set(judged(r));
    const cls = i => (js.has(i) ? `pr-${r.per[i].level}` : 'pr-off');
    // 一組字母對到的音裡，最差的那個決定顏色
    const rank = { good: 0, close: 1, bad: 2 };
    const worst = toks => toks.filter(i => js.has(i)).sort((a, b) => rank[r.per[b].level] - rank[r.per[a].level] || r.per[a].p - r.per[b].p)[0];
    const word = r.chunks
      ? r.chunks.map(c => { const w = worst(c.toks); return w === undefined ? `<span class="pr-off">${esc(c.text)}</span>` : `<span class="${cls(w)}" data-tok="${w}">${esc(c.text)}</span>`; }).join('')
      : esc(key);
    const ipa = r.ipa.map((s, i) => (r.per[i] && js.has(i) ? `<span class="${cls(i)}" data-tok="${i}">${esc(s)}</span>` : `<span class="pr-off">${esc(s)}</span>`)).join('');
    return `<div class="pr-word" dir="auto">${word}</div><div class="ipa big pr-ipa">/${ipa}/</div>`;
  }

  // 狀態列（固定高度）：唸之前是提示，唸完是分數和一句總結
  function statusHtml(msg = '') {
    if (!result) return `<p class="muted">${esc(msg || '聽完標準發音，按「唸出來」')}</p>`;
    const r = result, js = judged(r), sc = scoreOf(r);
    const lv = levelOf(sc);
    const n = js.filter(i => r.per[i].level !== 'good').length;
    const extra = mode() !== 'simple' && r.extra ? `多了 ${r.extra} 個音，所以總分比較低；` : '';
    return `<div class="pr-ring pr-${lv}" style="--v:${sc}"><b>${sc}</b></div>
      <div class="pr-sum"><b class="pr-${lv}">${{ good: '很好', close: '幾乎正確', bad: '再試試看' }[lv]}</b>
        <small>${extra}${n ? `${n} 個音要加強，點它看怎麼改` : '點字母或音標看每個音的細節'}</small></div>`;
  }
  const setStatus = msg => { $('#status').innerHTML = statusHtml(msg); };

  // 你唸成了什麼：只取最像的 1 個，第 2 個很接近才一起列；子音的位置只比子音、母音只比母音（避免把雜訊說成「像 /a/」）
  function yours(x) {
    const kind = k => (k === 'diphthong' ? 'vowel' : k), tk = kind(position(x.ph).kind);
    const ok = c => c.ph !== x.ph && (c.ph === '∅' || tk === 'other' || kind(position(c.ph).kind) === tk);
    const cands = (x.top || [{ ph: x.heard, p: 1 }]).filter(ok);
    if (!cands.length || cands[0].p < 0.15) return [];
    return cands.slice(0, 2).filter((c, i) => i === 0 || c.p >= 0.6 * cands[0].p);
  }

  // 點一個音：在底部面板看「聽起來像什麼、怎麼改、對照圖」，版面不動
  function detail(i) {
    const x = result.per[i], ys = yours(x), pct = n => `${Math.round(n * 100)}%`;
    const name = c => (c.ph === '∅' ? '（沒有唸出來）' : `/${esc(c.ph)}/`);
    // 聽起來：目標音和最像的 1～2 個音，各自的百分比
    const heard = `<p><b>聽起來</b>　${[{ ph: x.ph, p: x.p }, ...ys].sort((a, b) => (b.p ?? 0) - (a.p ?? 0)).map(c => `${name(c)}${c.p !== undefined ? ` ${pct(c.p)}` : ''}`).join('、')}</p>`;
    let body;
    if (!ys.length) body = `${heard}<p>${x.level === 'good' ? '唸得很好。' : '方向對了，但還不夠清楚。唸得清楚一點、用力一點再試一次。'}</p>`;
    else {
      const t = PC.tip(x.ph, ys[0].ph), most = (ys[0].p ?? 1) > x.p;
      body = `${heard}<p><b>${most ? '你唸成了' : '有一點像'}</b>　${ys.map(c => (c.ph === '∅' ? '（沒有唸出來）' : esc(PC.label(c.ph)))).join('　或　')}</p>
        ${t ? `<p><b>怎麼改</b>　${esc(t)}</p>` : ''}
        ${ys[0].ph === '∅' ? '' : `<div class="pr-chart">${PC.chartHtml(x.ph, ys.map(c => ({ ph: c.ph })))}</div>`}`;
    }
    openSheet(`<h2><span class="pr-${x.level}">/${esc(x.ph)}/</span> ${LEVEL[x.level]}</h2><div class="pr-fb">${body}</div>
      <div class="pr-bar"><button class="btn ghost" id="dListen">${G.speaker()} 標準發音</button><button class="btn ghost" id="dMine">▶ 我的錄音</button></div>
      <button class="btn big" id="dClose">關閉</button>`, {}, b => {
      b.querySelector('#dListen').onclick = say;
      b.querySelector('#dMine').onclick = playMine;
      b.querySelector('#dClose').onclick = closeSheet;
    });
  }

  // 我的錄音：只放在記憶體裡，換下一個字就丟掉
  function playMine() {
    if (!myPcm) return;
    stopSpeech();
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const buf = ac.createBuffer(1, myPcm.length, 16000);
    buf.getChannelData(0).set(myPcm);
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(ac.destination);
    src.onended = () => ac.close();
    src.start();
  }

  // 唸：錄音 → 服務每個音都評分；沒聽清楚時不算，直接再唸一次
  async function mic() {
    if (busy) return;
    busy = true;
    render();
    const btn = $('#mic');
    btn.disabled = true;
    try {
      const ph = await PR.phonemize(key, run.lang.id);
      if (!ph.ok) throw new Error(ph.msg);
      const pcm = await PR.record(st => { btn.textContent = st === 'listening' ? '請說…' : st === 'heard' ? '聽到了…' : '評分中…'; });
      myPcm = pcm;
      $('#mine').disabled = false;
      const r = await PR.score(pcm, ph.phones, -1, run.lang.id);
      if (!r.ok || r.total == null) throw new Error(`${r.msg || '沒有聽清楚'}（這次不算）`);
      r.per_phone.forEach(x => x && (x.level = levelOf(x.p * 100)));
      PL.add({ lang: run.lang.id, word: key, phones: ph.ipa, per: r.per_phone }).catch(() => {});
      result = { total: r.total, extra: r.extra || 0, ipa: ph.ipa, per: r.per_phone, chunks: await LT.align(run.lang.id, key, ph.ipa).catch(() => null) };
      const sc = scoreOf(result);
      M.record(run, key, sc);
      sfx(sc >= M.PASS ? 'good' : 'bad');
      busy = false;
      render();
    } catch (e) {
      busy = false;
      render();
      setStatus(e.message?.includes('這次不算') ? e.message : `發音評分無法使用（${e.message || '連線失敗'}）`);
    }
  }

  function quit() {
    openSheet(`<h2>要結束這一局嗎？</h2><p class="muted">還沒唸滿 2 次的字不會通過。</p>
      <div class="stack"><button class="btn gold big" id="keep">繼續</button><button class="btn ghost big" id="stop">結束</button></div>`, {}, b => {
      b.querySelector('#keep').onclick = closeSheet;
      b.querySelector('#stop').onclick = () => { closeSheet(); finish(); };
    });
  }

  function finish() {
    stopSpeech();
    const res = M.finish(run), ok = res.filter(x => x.ok);
    openSheet(`<h2>這一局</h2>
      <div class="stack">${res.map(x => `<div class="res-row ${x.ok ? 'ok' : ''}">
        <span class="ic">${iconHtml(M.prime(run, x.key).icon)}</span><b dir="auto">${esc(x.key)}</b>
        <small>${x.scores.join('、') || '—'}</small><span class="sc">${x.scores.length ? x.score : '—'}</span><span class="mk">${x.ok ? '通過' : ''}</span></div>`).join('')}</div>
      <p class="muted">每個字取最高的兩次平均，${M.PASS} 分以上通過。${ok.length ? `通過的 ${ok.length} 個字已經放進箱子。` : ''}</p>
      <div class="stack"><button class="btn gold big" id="land">${ok.length ? '到領土擺放' : '看領土'}</button><button class="btn ghost big" id="again">再一局</button></div>`, { locked: true }, b => {
      b.querySelector('#land').onclick = () => { closeSheet(); end('land'); };
      b.querySelector('#again').onclick = () => { closeSheet(); start(run.lang); };
    });
    if (ok.length) sfx('level');
  }
  function end(tab) { root.hidden = true; document.body.classList.remove('playing'); onEnd?.(tab); }

  return { start };
}
