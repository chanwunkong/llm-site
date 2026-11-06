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
import { base } from '../engine/ipa-chart.js';
import { state, save } from '../engine/store.js';

export function createPlay(root, { onEnd }) {
  let run, key, busy = false;
  const $ = s => root.querySelector(s);

  function start(lang) {
    run = M.startRun(lang);
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

  function render(result = null) {
    const p = M.prime(run, key), before = run.scores[key];
    const shown = result ? before.slice(0, -1) : before;
    const m = mode();
    $('#qcard').innerHTML = `
      <div class="badges"><span class="badge lv">第 ${shown.length + 1} 次</span>${shown.length ? `<span class="badge">之前：${shown.join('、')}</span>` : ''}
        <span class="seg-toggle pr-mode">${[['simple', '簡單'], ['full', '進階']].map(([k, z]) => `<button data-m="${k}" class="${m === k ? 'on' : ''}">${z}</button>`).join('')}</span></div>
      <div class="qmain teach">
        <button class="core-icon icon-tap" id="icon">${iconHtml(p.icon)}</button>
        ${result ? resultHtml(result) : `<div class="teach-word" dir="auto">${esc(key)}</div>${plainIpa()}`}
        <button class="btn sm" id="listen">${G.speaker()} 聽</button>
      </div>
      <div class="teach-answer">${result ? `<div class="pr-actions"><button class="btn ghost big" id="again">重試</button><button class="btn green big" id="cont">繼續 ›</button></div>` : `<button class="btn gold mic" id="mic">${G.mic()} 唸出來</button>`}</div>`;
    $('#icon').onclick = say;
    $('#listen').onclick = say;
    $('#mic')?.addEventListener('click', mic);
    $('#cont')?.addEventListener('click', next);
    // 重試：剛才那一次不算，同一個字再唸一次
    $('#again')?.addEventListener('click', () => { M.undo(run, key); next(); });
    root.querySelectorAll('.pr-mode button').forEach(b => (b.onclick = () => {
      state.pronMode = b.dataset.m;
      save();
      if (result) M.rescore(run, key, scoreOf(result));
      render(result);
    }));
    root.querySelectorAll('[data-tok]').forEach(b => (b.onclick = () => { result.sel = +b.dataset.tok; render(result); }));
  }
  // 還沒唸：音標上把要評的難音畫底線（簡單模式）
  function plainIpa() {
    const ipa = P.wordSegs(run.lang.id, key);
    if (!ipa) return '';
    const hs = mode() === 'simple' ? hardSet() : new Set();
    return `<span class="ipa big">/${ipa.map(s => (hs.has(base(s)) ? `<u>${esc(s)}</u>` : esc(s))).join('')}/</span>`;
  }

  function resultHtml(r) {
    const js = new Set(judged(r)), sc = scoreOf(r);
    const cls = i => (js.has(i) ? `pr-${r.per[i].level}` : 'pr-off');
    // 字母：一組字母對到的音裡，最差的那個決定顏色
    const rank = { good: 0, close: 1, bad: 2 };
    const worst = toks => toks.filter(i => js.has(i)).sort((a, b) => rank[r.per[b].level] - rank[r.per[a].level] || r.per[a].p - r.per[b].p)[0];
    const word = r.chunks
      ? r.chunks.map(c => { const w = worst(c.toks); return w === undefined ? `<span class="pr-off">${esc(c.text)}</span>` : `<span class="${cls(w)}${r.sel === w ? ' sel' : ''}" data-tok="${w}">${esc(c.text)}</span>`; }).join('')
      : esc(key);
    const ipa = r.ipa.map((s, i) => (r.per[i] && js.has(i) ? `<span class="${cls(i)}${r.sel === i ? ' sel' : ''}" data-tok="${i}">${esc(s)}</span>` : `<span class="pr-off">${esc(s)}</span>`)).join('');
    const lv = sc >= 80 ? 'good' : sc >= 50 ? 'close' : 'bad';
    const head = { good: '很好', close: '幾乎正確', bad: '再試試看' }[lv];
    return `<div class="pr-card">
        <div class="pr-head"><div><b class="pr-${lv}">${head}</b><small>${mode() === 'simple' ? `重點音 ${js.size} 個` : `每個音都評分${r.extra ? `，多了 ${r.extra} 個音` : ''}`}</small></div>
          <div class="pr-ring pr-${lv}" style="--v:${sc}"><b>${sc}</b></div></div>
        <div class="pr-word" dir="auto">${word}</div>
        <div class="ipa big pr-ipa">/${ipa}/</div>
        <div class="pr-key"><span class="pr-good">● 正確</span><span class="pr-close">● 有點問題</span><span class="pr-bad">● 需要加強</span></div>
        ${feedbackHtml(r)}
      </div>`;
  }
  // 點一個音（字母或音標）看回饋
  function feedbackHtml(r) {
    if (r.sel === undefined || !r.per[r.sel]) return '<p class="muted pr-hint">點字母或音標看每個音的回饋</p>';
    const x = r.per[r.sel];
    const msg = x.level === 'good' ? `${PC.label(x.ph)}唸得很好` : x.heard === '∅' ? `${PC.label(x.ph)}好像沒有唸出來`
      : x.heard === x.ph ? `${PC.label(x.ph)}有點不清楚` : `你的 /${esc(x.ph)}/ 聽起來像 ${PC.label(x.heard)}`;
    // 聽到的就是目標音（只是不夠清楚）時，圖上只有一個點，不畫
    const chart = x.heard === '∅' || x.heard === x.ph ? '' : PC.chartHtml(x.ph, [{ ph: x.heard }, { ph: x.ph, p: x.p }]);
    return `<div class="pr-fb"><p><b class="pr-${x.level}">${LEVEL[x.level]}</b>・${esc(msg)}</p>${chart}</div>`;
  }

  // 唸：錄音 → 服務每個音都評分；沒聽清楚時不算，直接再唸一次
  async function mic() {
    if (busy) return;
    busy = true;
    const btn = $('#mic');
    btn.disabled = true;
    const retry = msg => {
      btn.disabled = false;
      btn.innerHTML = `${G.mic()} 再唸一次`;
      $('#qcard .retry')?.remove();
      $('#qcard .qmain').insertAdjacentHTML('beforeend', `<p class="muted retry">${esc(msg)}</p>`);
    };
    try {
      const ph = await PR.phonemize(key, run.lang.id);
      if (!ph.ok) throw new Error(ph.msg);
      const pcm = await PR.record(st => { btn.textContent = st === 'listening' ? '請說…' : st === 'heard' ? '聽到了…' : '評分中…'; });
      const r = await PR.score(pcm, ph.phones, -1, run.lang.id);
      if (!r.ok || r.total == null) return retry(`${r.msg || '沒有聽清楚'}（這次不算）`);
      PL.add({ lang: run.lang.id, word: key, phones: ph.ipa, per: r.per_phone }).catch(() => {});
      const res = { total: r.total, extra: r.extra || 0, ipa: ph.ipa, per: r.per_phone, chunks: await LT.align(run.lang.id, key, ph.ipa).catch(() => null) };
      // 一開始先打開最需要加強的那個音
      const bad = judged(res).filter(i => res.per[i].level !== 'good').sort((a, b) => res.per[a].p - res.per[b].p);
      if (bad.length) res.sel = bad[0];
      const sc = scoreOf(res);
      M.record(run, key, sc);
      sfx(sc >= M.PASS ? 'good' : 'bad');
      render(res);
    } catch (e) {
      retry(`發音評分無法使用（${e.message || '連線失敗'}）`);
    } finally {
      busy = false;
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
