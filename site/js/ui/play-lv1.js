// 一局（最小可行模型）：看圖示和字、點一下聽發音、唸出來；每個音都評分，得到總分
import * as M from '../engine/lv1.js';
import { speak, stopSpeech, sfx } from '../audio.js';
import { openSheet, closeSheet, esc } from './sheet.js';
import { iconHtml } from './icon.js';
import * as P from '../engine/phono.js';
import { G } from './glyph.js';
import * as PR from '../engine/pronounce.js';
import * as PL from '../engine/pronlog.js';

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

  function render(result = null) {
    const p = M.prime(run, key), before = run.scores[key];
    const shown = result ? before.slice(0, -1) : before;
    const ipa = result ? result.ipa : P.wordSegs(run.lang.id, key);
    const ipaHtml = !ipa ? '' : `<span class="ipa big">/${ipa.map((s, i) => {
      const x = result?.per[i];
      return x ? `<b class="pron-${x.level}">${esc(s)}</b>` : esc(s);
    }).join('')}/</span>`;
    $('#qcard').innerHTML = `
      <div class="badges"><span class="badge lv">第 ${shown.length + 1} 次</span>${shown.length ? `<span class="badge">之前：${shown.join('、')}</span>` : ''}</div>
      <div class="qmain teach">
        <button class="core-icon icon-tap" id="icon">${iconHtml(p.icon)}</button>
        <div class="teach-word" dir="auto">${esc(key)}</div>
        ${ipaHtml}
        <button class="btn sm" id="listen">${G.speaker()} 聽</button>
        ${result ? resultHtml(result) : ''}
      </div>
      <div class="teach-answer">${result ? '<button class="btn green big" id="cont">繼續 ›</button>' : `<button class="btn gold mic" id="mic">${G.mic()} 唸出來</button>`}</div>`;
    $('#icon').onclick = say;
    $('#listen').onclick = say;
    $('#mic')?.addEventListener('click', mic);
    $('#cont')?.addEventListener('click', next);
  }
  function resultHtml(r) {
    const bad = r.per.filter(x => x && x.level !== 'good');
    const tips = bad.slice(0, 3).map(x => (x.heard === '∅' ? `/${esc(x.ph)}/ 好像沒有唸出來` : `/${esc(x.ph)}/ 聽起來像 /${esc(x.heard)}/`));
    if (r.extra) tips.push(`多了 ${r.extra} 個音`);
    return `<div class="score-big ${r.total >= M.PASS ? 'ok' : 'no'}">${r.total}<small>分</small></div>
      <p class="muted">${tips.length ? tips.join('、') : '每個音都唸對了'}</p>`;
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
      M.record(run, key, r.total);
      sfx(r.total >= M.PASS ? 'good' : 'bad');
      render({ total: r.total, extra: r.extra || 0, ipa: ph.ipa, per: r.per_phone });
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
