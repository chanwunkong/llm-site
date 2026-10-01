// 答題畫面：唯一的題型「用字卡填滿空格」
import { buildRun, makeQuestion, answer, current, choices, choose, settle, WALS } from '../engine/run.js';
import { L } from '../engine/store.js';
import { speak, speakGap, stopSpeech, sfx, listen, canListen } from '../audio.js';
import { openSheet, closeSheet, esc, toast } from './sheet.js';
import { iconHtml } from './icon.js';

const LV_NAME = ['', '初遇', '辨識', '排序', '產出', '抽查'];
const ENV_NAME = { speak: '🔊 開口', ear: '🎧 耳機', mute: '🔇 靜音' };

export function createPlay(root, { onEnd }) {
  let run, q, answered, picked, showText, tapMode, typeMode, raf, tStart, timeLeft, qToken = 0;
  const $ = s => root.querySelector(s);
  const audio = () => run.env !== 'mute';
  const speakMode = () => run.env === 'speak' && canListen;

  function start(lang, sourceId, env) {
    run = buildRun(lang, sourceId, env);
    document.body.classList.add('playing');
    root.hidden = false;
    root.innerHTML = `
      <div class="hud"><button class="icon-btn" id="quit" aria-label="結束">✕</button>
        <div class="prog"><i></i></div><div class="score">0</div></div>
      <div class="strip"><div class="skills-on"></div><div class="combo"></div></div>
      <div class="qcard" id="qcard"></div>`;
    $('#quit').onclick = quit;
    next();
  }

  function next() {
    stopTimer();
    stopSpeech();
    closeSheet();
    if (run.pendingChoice) return levelChoice();
    const item = current(run);
    if (!item) return finish();
    q = makeQuestion(run, item);
    answered = false;
    picked = [];
    showText = !audio();
    tapMode = false;
    typeMode = false;
    timeLeft = 1;
    const token = ++qToken;
    renderQ();
    hud();
    if (audio()) playGap().then(() => token === qToken && startTimer());
    else startTimer();
  }

  const playGap = () => speakGap(q.before, q.after, run.aids.includes('slowvoice') ? 0.65 : 0.9);

  // ---------- 畫面 ----------
  function renderQ() {
    const lg = L(), item = q.item;
    const active = q.rules.filter(r => run.skills.includes(r) && lg.unlocked.includes(r)).map(r => WALS.find(w => w.id === r));
    const cardMode = q.mode !== 'produce';
    const useMic = speakMode() && (cardMode ? !tapMode : !typeMode);
    $('#qcard').innerHTML = `
      <div class="badges">
        <span class="badge lv">Lv${q.lv} ${LV_NAME[q.lv]}</span>
        ${item.kind === 'review' ? '<span class="badge review">複習</span>' : ''}
        ${item.kind === 'spot' ? '<span class="badge spot">5 級抽查</span>' : ''}
        ${q.challenge ? '<span class="badge challenge">⬆ 升級挑戰</span>' : ''}
        ${active.map(r => `<span class="badge">${r.icon} +50%</span>`).join('')}
        <span class="badge" style="margin-left:auto">${ENV_NAME[run.env]}</span>
      </div>
      <div class="qmain">
      ${q.image ? `<div class="pic">${iconHtml(q.image)}</div>` : ''}
      <div class="sentence${showText ? '' : ' hidden-text'}" id="sent">${sentenceHtml()}</div>
      ${audio() ? `<div class="listen-row">
        <button class="btn sm" id="replay">🔊 再聽一次</button>
        <button class="btn sm" id="eye">${showText ? '🙈 隱藏文字' : '👁 顯示文字'}</button></div>` : ''}
      ${q.hint ? `<div class="muted" style="text-align:center">提示：第一個字母是「${esc(q.hint)}」</div>` : ''}
      ${q.timer ? '<div class="timer"><i id="tbar" style="width:100%"></i></div>' : ''}
      <div id="fb" class="feedback"></div>
      </div>
      ${cardMode ? `<div class="cards">${q.cards.map((c, i) => `
        <button class="wcard" data-i="${i}">${esc(c)}${audio() ? `<span class="say" data-say="${i}">🔊</span>` : ''}</button>`).join('')}</div>` : ''}
      ${useMic ? `<button class="btn gold mic" id="mic">🎤 說出${q.mode === 'pick' ? '答案' : '整段'}</button>
        <button class="linkish" id="alt">${cardMode ? '改用點選作答（積分以耳機計）' : '改用打字作答（積分以耳機計）'}</button>` : ''}
      ${!cardMode && !useMic ? `<div class="produce"><input id="inp" placeholder="輸入空格裡的內容" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="btn gold" id="send">送出</button></div>` : ''}`;

    $('#replay') && ($('#replay').onclick = () => playGap());
    $('#eye') && ($('#eye').onclick = () => { showText = !showText; $('#sent').classList.toggle('hidden-text', !showText); $('#eye').textContent = showText ? '🙈 隱藏文字' : '👁 顯示文字'; });
    root.querySelectorAll('.wcard').forEach(b => (b.onclick = e => {
      const i = +b.dataset.i;
      if (e.target.dataset.say !== undefined || useMic) return speak(q.cards[i]);
      if (answered) return;
      if (q.mode === 'pick') return submit(q.cards[i]);
      if (picked.includes(i)) return;
      sfx('tap');
      picked.push(i);
      b.classList.add('used');
      $('#sent').innerHTML = sentenceHtml();
      bindSlots();
      if (picked.length === q.answer.length) submit(picked.map(k => q.cards[k]));
    }));
    bindSlots();
    $('#mic') && ($('#mic').onclick = mic);
    $('#alt') && ($('#alt').onclick = () => { cardMode ? (tapMode = true) : (typeMode = true); renderQ(); });
    const inp = $('#inp');
    if (inp) {
      $('#send').onclick = () => submit(inp.value);
      inp.onkeydown = e => { if (e.key === 'Enter') submit(inp.value); };
      if (!audio()) inp.focus();
    }
  }

  function sentenceHtml(result) {
    const slots = q.answer.map((a, i) => {
      if (result) {
        const mine = result.mine?.[i];
        return `<span class="slot ${result.ok ? 'ok' : 'no'}">${esc(result.ok ? a : (mine ?? a))}</span>`;
      }
      const k = picked[i];
      return `<span class="slot${k !== undefined ? ' filled' : ''}" data-slot="${i}">${k !== undefined ? esc(q.cards[k]) : '　'}</span>`;
    }).join(run.lang.joiner === '' ? '' : ' ');
    const j = run.lang.joiner;
    const before = q.before ? `<span class="ctx">${esc(q.before)}</span>${j}` : '';
    const after = q.after ? `${/^[\p{P}]/u.test(q.after) ? '' : j}<span class="ctx">${esc(q.after)}</span>` : '';
    return before + slots + after;
  }

  function bindSlots() {
    root.querySelectorAll('[data-slot]').forEach(s => (s.onclick = () => {
      if (answered) return;
      const i = +s.dataset.slot;
      if (picked[i] === undefined) return;
      const [k] = picked.splice(i, 1);
      root.querySelector(`.wcard[data-i="${k}"]`)?.classList.remove('used');
      $('#sent').innerHTML = sentenceHtml();
      bindSlots();
    }));
  }

  function hud() {
    $('.prog i').style.width = `${(run.pos / run.queue.length) * 100}%`;
    $('.score').textContent = run.score;
    const mult = Math.min(3, 1 + 0.1 * (run.combo - 1));
    $('.combo').innerHTML = run.combo >= 2 ? `<b>${run.combo}</b> 連鎖<small>×${mult.toFixed(1)}</small>` : '';
    const lg = L();
    $('.skills-on').innerHTML = [
      ...run.skills.map(id => WALS.find(w => w.id === id)).map(w => `<span class="chip" title="${esc(w.name)}">${w.icon} ${w.id}</span>`),
      ...run.aids.map(id => `<span class="chip">${{ trim: '✂️', hint: '🔤', slowtime: '🐢', slowvoice: '🔉' }[id]}</span>`),
    ].join('') || `<span class="muted">${esc(run.sit.title)}</span>`;
    void lg;
  }

  // ---------- 計時 ----------
  function startTimer() {
    if (!q.timer || answered) return;
    tStart = performance.now();
    const tick = () => {
      const left = 1 - (performance.now() - tStart) / 1000 / q.timer;
      timeLeft = Math.max(0, left);
      const bar = $('#tbar');
      if (bar) bar.style.width = `${timeLeft * 100}%`;
      if (left <= 0) return submit(q.mode === 'order' ? [] : q.mode === 'pick' ? null : '', { timeout: true });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  function stopTimer() { cancelAnimationFrame(raf); }

  // ---------- 作答 ----------
  async function mic() {
    const btn = $('#mic');
    btn.disabled = true;
    btn.textContent = '🎤 聆聽中…';
    try {
      const alts = await listen();
      if (!alts.length) { toast('沒有聽到聲音，再試一次'); btn.disabled = false; btn.textContent = '🎤 再說一次'; return; }
      submit(alts, { spoken: true });
    } catch {
      toast('語音辨識無法使用，已改用點選');
      q.mode === 'produce' ? (typeMode = true) : (tapMode = true);
      renderQ();
    }
  }

  function submit(response, { spoken = false, timeout = false } = {}) {
    if (answered) return;
    answered = true;
    stopTimer();
    const res = answer(run, q, response, { timeLeft, spoken });
    showText = true;
    const mine = q.mode === 'order' ? response : q.mode === 'pick' ? [response] : [spoken ? response[0] : response];
    const sent = $('#sent');
    sent.classList.remove('hidden-text');
    sent.innerHTML = sentenceHtml({ ok: res.ok, mine: res.ok ? null : mine });
    root.querySelectorAll('.wcard').forEach(b => {
      const c = q.cards[+b.dataset.i];
      b.disabled = true;
      if (q.answer.includes(c)) b.classList.add('ok');
      else if (mine.includes(c)) b.classList.add('no');
    });
    ['#mic', '#alt', '.produce', '.listen-row'].forEach(s => $(s)?.remove());

    const fb = $('#fb');
    if (res.ok) {
      sfx('good');
      const extra = [
        res.rules.length && res.rules.map(r => WALS.find(w => w.id === r).icon).join('') + ' 規則加成',
        res.path > 0 && `🧩 領土路徑 +${Math.round(res.path * 100)}%`,
      ].filter(Boolean).join('　');
      fb.className = 'feedback ok';
      fb.innerHTML = `✓ 答對了 +${res.points}${extra ? `<br><small>${extra}</small>` : ''}`;
      floatText(`+${res.points}`);
      const c = $('.combo');
      c.classList.remove('bump'); c.offsetWidth; c.classList.add('bump');
    } else {
      sfx('bad');
      fb.className = 'feedback no';
      fb.innerHTML = `${timeout ? '⏰ 時間到' : '✗ 答錯了'}　正確答案<span class="ans">${esc(q.answerText)}</span>
        <small>${q.item.attempts < 3 ? '這題稍後會再出現' : '這題本局先跳過，下一局再練'}</small>`;
    }
    if (res.levelUp) { sfx('level'); setTimeout(() => floatText(`⬆ ${q.item.lemma} Lv${res.levelUp}`, true), 250); }
    if (res.levelDown) floatText(`⬇ ${q.item.lemma} Lv${res.levelDown}`, true);
    hud();

    const cont = document.createElement('button');
    cont.className = `btn ${res.ok ? 'green' : 'gold'} big`;
    cont.textContent = '繼續 ›';
    cont.onclick = next;
    $('#qcard').appendChild(cont);
    const token = qToken;
    if (res.ok) (audio() ? speak(q.full) : new Promise(r => setTimeout(r, 900))).then(() => setTimeout(() => token === qToken && next(), 350));
    else if (audio()) speak(q.full);
  }

  function floatText(text, big) {
    const d = document.createElement('div');
    d.className = 'float';
    d.style.top = big ? '26%' : '8%';
    if (big) d.style.fontSize = '26px';
    d.textContent = text;
    d.addEventListener('animationend', () => d.remove());
    root.appendChild(d);
  }

  // ---------- 局中升級：三選一 ----------
  function levelChoice() {
    const cs = choices(run);
    if (!cs.length) { run.pendingChoice = false; return next(); }
    sfx('level');
    openSheet(`<h2>升級！選一項能力</h2>
      <p class="muted">只在這一局有效。WALS 技能：空格用到這條規則、而且答對時，分數 +50%。</p>
      <div class="stack">${cs.map((c, i) => `<button class="choice${c.type === 'wals' ? ' wals' : ''}" data-i="${i}">
        <span class="ic">${c.icon}</span><b>${c.type === 'wals' ? `WALS ${c.id}・` : ''}${esc(c.name)}</b><small>${esc(c.desc)}</small></button>`).join('')}</div>`,
      { locked: true }, body => body.querySelectorAll('[data-i]').forEach(b => (b.onclick = () => { choose(run, cs[+b.dataset.i]); closeSheet(); hud(); next(); })));
  }

  // ---------- 結束 ----------
  function quit() {
    openSheet(`<h2>要結束這一局嗎？</h2><p class="muted">已經答過的題目會照常結算。</p>
      <div class="stack"><button class="btn gold big" id="keep">繼續作答</button><button class="btn ghost big" id="stop">結束並結算</button></div>`,
      {}, body => { body.querySelector('#keep').onclick = closeSheet; body.querySelector('#stop').onclick = () => { closeSheet(); finish(); }; });
  }

  function finish() {
    stopTimer();
    stopSpeech();
    const rep = settle(run);
    const lg = L();
    const rulesTxt = Object.entries(rep.ruleHits).map(([r, n]) => `${WALS.find(w => w.id === r).icon} ${r} ×${n}`).join('　');
    openSheet(`
      <h2>🎉 本局結束</h2>
      <div class="stats">
        <div><b>${rep.score}</b><span>得分</span></div>
        <div><b>${rep.correct}/${rep.correct + rep.wrong}</b><span>答對</span></div>
        <div><b>${rep.maxCombo}</b><span>最高連鎖</span></div>
      </div>
      <h3>🪙 金幣 +${rep.score + rep.produced}</h3>
      <p class="muted">得分 ${rep.score}${rep.produced ? `　＋　語塊產出 ${rep.produced}（${rep.production.map(p => `${p.chunks.map(c => esc(c.join('＋'))).join(' · ')}${p.chunks.length > 1 ? ` 網絡×${p.mult}` : ''}`).join('、')}）` : (rep.correct < 5 ? '　（本局答對不到 5 題，語塊沒有產出）' : '　（在領土上完成語塊，每局結算都會產出金幣）')}</p>
      ${rep.levelUps.length ? `<h3>⬆ 升級</h3><div class="chips">${rep.levelUps.map(u => `<span>${esc(u.lemma)}<em>Lv${u.lv}</em></span>`).join('')}</div>` : ''}
      ${rep.levelDowns.length ? `<h3>⬇ 抽查未過</h3><div class="chips">${rep.levelDowns.map(l => `<span>${esc(l)}<em>Lv4</em></span>`).join('')}</div>` : ''}
      ${rep.newTiles.length ? `<h3>🎒 新詞元進背包</h3><div class="chips">${rep.newTiles.map(l => `<span>${esc(l)}</span>`).join('')}</div>
        ${rep.auto.length ? `<p class="muted">背包滿了，${rep.auto.map(esc).join('、')} 已自動放在領土邊緣。</p>` : ''}` : ''}
      ${rulesTxt ? `<h3>✨ 規則加成</h3><p class="muted">${rulesTxt}</p>` : ''}
      ${rep.missed.length ? `<h3>🔗 錯過的連結</h3><p class="muted">這些字一起出現，但在領土上離得很遠：${rep.missed.map(m => `${esc(m.a)} ↔ ${esc(m.b)}（${m.steps} 步）`).join('、')}</p>` : ''}
      <h3>📖 ${esc(rep.sitTitle)}</h3>
      <p class="muted">${rep.advanced ? `完成了！解鎖下一段：${esc(rep.advanced)}` : `本段進度：${rep.progress.done} 個實詞達到 Lv3`}</p>
      <div class="row" style="margin-top:14px">
        <button class="btn ghost big" id="home">回冒險</button>
        ${lg.backpack.length ? `<button class="btn gold big" id="land">去擺放（${lg.backpack.length}）</button>` : ''}
      </div>`, { locked: true }, body => {
      const exit = tab => { closeSheet(); root.hidden = true; document.body.classList.remove('playing'); onEnd(tab); };
      body.querySelector('#home').onclick = () => exit('home');
      body.querySelector('#land')?.addEventListener('click', () => exit('land'));
    });
  }

  return { start };
}
