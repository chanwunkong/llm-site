// 答題畫面：唯一的題型「用字卡填滿空格」
import { buildRun, makeQuestion, answer, current, choices, choose, settle, WALS, ruleMarks, profileOf } from '../engine/run.js';
import { spaceBefore } from '../engine/content.js';
import { L, SHOW, RULES } from '../engine/store.js';
import { speak, speakGap, stopSpeech, sfx, listen, canListen } from '../audio.js';
import { openSheet, closeSheet, esc, toast, sheetOpen } from './sheet.js';
import { iconHtml } from './icon.js';
import * as P from '../engine/phono.js';
import { G } from './glyph.js';

const LV_NAME = ['', '初遇', '辨識', '排序', '產出', '抽查'];
const ENV_NAME = { speak: '開口', ear: '耳機', mute: '靜音' };

// 星數：實心圓 = 拿到，空心 = 還沒拿到
export const starRow = (n, small) => `<span class="stars3${small ? ' sm' : ''}">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;

export function createPlay(root, { onEnd, onSound, onCompose }) {
  let run, q, answered, picked, showText, tapMode, typeMode, raf, tStart, timeLeft, qToken = 0;
  const $ = s => root.querySelector(s);
  const audio = () => run.env !== 'mute';
  const speakMode = () => run.env === 'speak' && canListen;

  function start(lang, sourceId, env) {
    run = buildRun(lang, sourceId, env);
    document.body.classList.add('playing');
    root.hidden = false;
    root.innerHTML = `
      <div class="hud"><button class="icon-btn" id="quit" aria-label="結束">${G.close()}</button>
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
    if (item.kind === 'boss') setTimeout(() => floatText('王關！', true), 50);
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

  // 基元題沒有句子：Lv2 唸出題目的字，其他等級不唸（答完才唸）
  const playGap = () => (q.core ? (q.prompt ? speak(q.prompt, { rate: 0.85 }) : Promise.resolve()) : speakGap(q.before, q.after, 0.9));

  // ---------- 畫面 ----------
  function renderQ() {
    const lg = L(), item = q.item;
    const chain = item.kind === 'chain', boss = item.kind === 'boss';
    const ruleOf = id => WALS.find(w => w.id === id);
    $('#qcard').classList.toggle('chain', chain);
    $('#qcard').classList.toggle('boss', boss);
    const cardMode = q.mode !== 'produce';
    const useMic = speakMode() && (cardMode ? !tapMode : !typeMode);
    $('#qcard').innerHTML = `
      <div class="badges">
        ${boss ? '<span class="badge boss">王關</span><span class="badge">整段依序排好</span>' : chain ? `<span class="badge chain">連鎖 ${item.link}/${item.of}</span><span class="badge rule-b">${item.rule} ${esc(ruleOf(item.rule).name)}</span>`
          : `<span class="badge lv">Lv${q.lv} ${LV_NAME[q.lv]}</span>${q.formula ? '<span class="badge chunk">語塊</span>' : ''}`}
        ${item.kind === 'review' ? '<span class="badge review">複習</span>' : ''}
        ${item.kind === 'spot' ? '<span class="badge spot">5 級抽查</span>' : ''}
        ${q.challenge ? '<span class="badge challenge">升級挑戰</span>' : ''}
        <span class="badge" style="margin-left:auto">${ENV_NAME[run.env]}</span>
      </div>
      <div class="qmain">
      ${q.image ? `<div class="pic">${iconHtml(q.image)}</div>` : ''}
      ${q.mineCue ? `<div class="mine-cue"><span class="muted">你的理解</span><div class="mine">${q.mineCue.map(p => `<span class="mchip">${run.lang.base[p] ? iconHtml(run.lang.base[p]) + ' ' : ''}${esc(p)}</span>`).join('<i>＋</i>')}</div></div>` : ''}
      <div class="sentence${q.core ? ' core' : ''}${showText ? '' : ' hidden-text'}" id="sent" dir="${run.lang.dir || 'ltr'}">${sentenceHtml()}</div>
      ${audio() ? `<div class="listen-row">
        <button class="btn sm" id="replay">${G.speaker()} 再聽一次</button>
        <button class="btn sm" id="eye">${G.eye()} ${showText ? '隱藏文字' : '顯示文字'}</button></div>` : ''}
      ${q.timer ? '<div class="timer"><i id="tbar" style="width:100%"></i></div>' : ''}
      <div id="fb" class="feedback"></div>
      </div>
      ${cardMode ? `<div class="cards">${q.cards.map((c, i) => `
        <button class="wcard${q.cardIcons ? ' icon-card' : ''}" data-i="${i}" dir="auto">${q.cardIcons ? iconHtml(q.cardIcons[c]) : esc(c)}${audio() && !q.cardIcons ? `<span class="say" data-say="${i}">${G.speaker(14)}</span>` : ''}</button>`).join('')}</div>` : ''}
      ${useMic ? `<button class="btn gold mic" id="mic">${G.mic()} 說出${q.mode === 'pick' ? '答案' : '整段'}</button>
        <button class="linkish" id="alt">${cardMode ? '改用點選作答（積分以耳機計）' : '改用打字作答（積分以耳機計）'}</button>` : ''}
      ${!cardMode && !useMic ? `<div class="produce"><input id="inp" placeholder="${q.core ? '輸入這個圖示的字' : '輸入空格裡的內容'}" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="btn gold" id="send">送出</button></div>` : ''}`;

    $('#replay') && ($('#replay').onclick = () => playGap());
    $('#eye') && ($('#eye').onclick = () => { showText = !showText; $('#sent').classList.toggle('hidden-text', !showText); $('#eye').innerHTML = `${G.eye()} ${showText ? '隱藏文字' : '顯示文字'}`; });
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

  // 句子逐字畫出：空格換成字卡槽；規則透視的片段加底線與規則編號
  function sentenceHtml(result) {
    if (q.core) return coreHtml(result);
    const marks = (q.marks ||= ruleMarks(run, q.tokens));
    const trigger = marks.some(m => m.idx.every(i => q.gap.includes(i)));
    const slots = q.answer.map((a, i) => {
      if (result) {
        const mine = result.mine?.[i];
        return `<span class="slot ${result.ok ? 'ok' : 'no'}">${esc(result.ok ? a : (mine ?? a))}</span>`;
      }
      const k = picked[i];
      return `<span class="slot${k !== undefined ? ' filled' : ''}" data-slot="${i}">${k !== undefined ? esc(q.cards[k]) : '　'}</span>`;
    }).join(run.lang.joiner === '' ? '' : ' ');
    return markedHtml(q.tokens, marks, q.gap, slots, trigger);
  }

  // 基元題：圖示（或題目的字）＋字卡槽。Lv2 的字卡是圖示，槽裡也放圖示
  function coreHtml(result) {
    const show = k => (q.cardIcons ? iconHtml(q.cardIcons[k]) : esc(k));
    const slot = i => {
      if (result) {
        const v = result.ok ? q.answer[i] : (result.mine?.[i] ?? q.answer[i]);
        return `<span class="slot core-slot ${result.ok ? 'ok' : 'no'}">${v ? show(v) : '　'}</span>`;
      }
      const k = picked[i];
      return `<span class="slot core-slot${k !== undefined ? ' filled' : ''}" data-slot="${i}">${k !== undefined ? show(q.cards[k]) : '　'}</span>`;
    };
    if (q.prompt) return `<div class="core-row"><span class="ctx core-word">${esc(q.prompt)}</span><span class="core-eq">＝</span>${slot(0)}</div>`;
    if (q.mode === 'order') return `<div class="core-pair">${q.icons.map((ic, i) => `<div class="core-cell"><div class="core-icon">${iconHtml(ic)}</div>${slot(i)}</div>`).join('')}</div>`;
    return `<div class="core-row"><div class="core-icon">${iconHtml(q.icons[0])}</div>${q.mode === 'produce' && !result ? '' : slot(0)}</div>`;
  }

  // tokens：整句；gap：空格的位置（沒有空格時傳空陣列）；slotsHtml：空格處要放的內容；trigger：空格會觸發連鎖
  function markedHtml(tokens, marks, gap, slotsHtml = '', trigger = false) {
    const j = run.lang.joiner, inGap = new Set(gap);
    const marked = i => marks.filter(m => m.idx.includes(i) && !m.idx.every(x => inGap.has(x)));
    const lastOf = i => marked(i).filter(m => m.idx.filter(x => !inGap.has(x)).at(-1) === i).map(m => m.rule);
    let out = '';
    tokens.forEach((t, i) => {
      if (inGap.has(i) && i !== gap[0]) return;
      const sep = spaceBefore(tokens, i, j);
      // 同一個片段內的空白也加底線，底線才連成一條
      const joinMark = i > 0 && marked(i).some(m => m.idx.includes(i - 1) && !inGap.has(i - 1));
      out += sep ? (joinMark ? `<span class="ctx rmk">${sep}</span>` : sep) : '';
      if (inGap.has(i)) {
        const rules = [...new Set(marks.filter(m => m.idx.every(x => inGap.has(x))).map(m => m.rule))];
        out += trigger ? `<span class="rslot">${slotsHtml}<sup class="rtag">${rules.join(' ')}</sup></span>` : slotsHtml;
        return;
      }
      const tags = lastOf(i);
      // 角色標記：81A 的 S、V、O，116A 的問句標記
      const roles = [...new Set(marked(i).map(m => m.labels?.[i]).filter(Boolean))];
      out += `<span class="ctx${marked(i).length ? ' rmk' : ''}">${esc(t.surface)}</span>${roles.length ? `<sub class="role">${roles.join('')}</sub>` : ''}${tags.length ? `<sup class="rtag">${tags.join(' ')}</sup>` : ''}`;
    });
    return out;
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
    $('.combo').innerHTML = run.combo >= 2 ? `<b>${run.combo}</b> 連擊<small>×${mult.toFixed(1)}</small>` : '';
    const lg = L();
    $('.skills-on').innerHTML = [
      ...Object.entries(run.skills).map(([id, lv]) => `<span class="chip" title="${esc(WALS.find(w => w.id === id).name)}">${id}${lv > 1 ? ` Lv${lv}` : ''}</span>`),
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
    btn.textContent = '聆聽中…';
    try {
      const alts = await listen();
      if (!alts.length) { toast('沒有聽到聲音，再試一次'); btn.disabled = false; btn.textContent = '再說一次'; return; }
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
    if (res.boss) {
      fb.className = `feedback ${res.ok ? 'ok' : 'no'}`;
      if (res.ok) { sfx('level'); fb.innerHTML = `王關通過！+${res.points}`; floatText(`+${res.points}`, true); }
      else { sfx('bad'); fb.innerHTML = `王關沒過　正確答案<span class="ans">${esc(q.answerText)}</span>`; }
    } else if (res.chain) {
      const c = res.chain;
      fb.className = `feedback ${res.ok ? 'ok' : 'no'}`;
      if (res.ok) {
        sfx('good');
        fb.innerHTML = `連鎖 ${c.link}/${c.of} 正確 +${res.points}<br><small>${c.link < c.of ? (res.next ? `倍率 ×${(1 + 0.5 * (c.link + 1)).toFixed(1)}，繼續跳到下一個句子` : '來源裡沒有更多這個模式的句子，連鎖結束') : '連鎖完成！'}</small>`;
        floatText(`+${res.points}`);
        if (res.next) setTimeout(() => floatText(`連鎖 → ${c.link + 1}/${c.of}`, true), 250);
      } else {
        sfx('bad');
        fb.innerHTML = `連鎖中斷　正確答案<span class="ans">${esc(q.answerText)}</span>`;
      }
    } else if (res.ok) {
      sfx('good');
      const extra = [
        res.chains?.length && `觸發連鎖：${res.chains.map(c => c.rule).join('、')}`,
        res.path > 0 && `領土路徑 +${Math.round(res.path * 100)}%`,
      ].filter(Boolean).join('　');
      fb.className = 'feedback ok';
      fb.innerHTML = `正確 +${res.points}${extra ? `<br><small>${extra}</small>` : ''}`;
      floatText(`+${res.points}`);
      if (res.chains?.length) { sent.classList.add('fire'); setTimeout(() => floatText(`連鎖！${res.chains.map(c => c.rule).join(' ＋ ')}`, true), 250); }
      const c = $('.combo');
      c.classList.remove('bump'); c.offsetWidth; c.classList.add('bump');
    } else {
      sfx('bad');
      fb.className = 'feedback no';
      fb.innerHTML = `${timeout ? '時間到' : '錯誤'}　正確答案<span class="ans">${esc(q.answerText)}</span>
        <small>${q.item.attempts < 3 ? '這題稍後會再出現' : '這題本局先跳過，下一局再練'}</small>`;
    }
    // 發音回饋：只差一個音的字並列比較；4 → 5 級顯示答案的發音並標出難音
    const L_ID = run.lang.id, hard = P.hardSounds(run.lang.wals);
    const ipaHtml = w => { const sg = P.wordSegs(L_ID, w); return sg ? `<span class="ipa">/${sg.map(x => hard.has(x) ? `<b class="hs" data-hs="${esc(x)}">${esc(x)}</b>` : esc(x)).join('')}/</span>` : ''; };
    const sounds = q.neighbors.filter(n => n.kind === 'sound');
    // 第一次在回饋裡出現難音：記下來，結算時開放發音頁
    const seesHard = sounds.some(n => n.hard?.length) || (q.mode === 'produce' && q.answer.some(w => (P.wordSegs(L_ID, w) || []).some(x => hard.has(x))));
    if (seesHard && !L().hardSeen) { L().hardSeen = true; }
    if (sounds.length) fb.insertAdjacentHTML('beforeend', `<div class="ipa-cmp">${[q.answer[0], ...sounds.map(n => n.word)].map(w => `<span>${esc(w)} ${ipaHtml(w)}</span>`).join('<i>vs</i>')}</div>`);
    if (q.mode === 'produce') {
      const parts = q.answer.map(w => ipaHtml(w)).filter(Boolean);
      const hs = [...new Set(q.answer.flatMap(w => (P.wordSegs(L_ID, w) || []).filter(x => hard.has(x))))];
      if (parts.length) fb.insertAdjacentHTML('beforeend', `<div class="ipa-cmp">${parts.join(' ')}${hs.length ? `<small>難音：${hs.map(esc).join('、')}（點紅色的音可以聽、可以和相近的音比較）</small>` : ''}</div>`);
    }
    // 點難音：打開發音面板（單音錄音、和相近的音比較）
    fb.querySelectorAll('[data-hs]').forEach(b => (b.onclick = () => { stopTimer(); onSound?.(b.dataset.hs); }));
    if (res.levelUp) { sfx('level'); setTimeout(() => floatText(`${q.item.lemma} 升到 Lv${res.levelUp}`, true), 250); }
    if (res.levelDown) floatText(`${q.item.lemma} 降到 Lv${res.levelDown}`, true);
    hud();

    const cont = document.createElement('button');
    cont.className = `btn ${res.ok ? 'green' : 'gold'} big`;
    cont.textContent = '繼續 ›';
    cont.onclick = next;
    $('#qcard').appendChild(cont);
    const token = qToken;
    if (res.ok) (audio() ? speak(q.full) : new Promise(r => setTimeout(r, 900))).then(() => setTimeout(() => token === qToken && !sheetOpen() && next(), 350));
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
  // 三選一的例句：目前情境裡（找不到就整個來源）最短、有這條規則的句子，片段加底線
  function ruleExample(ruleId) {
    const r = WALS.find(w => w.id === ruleId), prof = profileOf(run.lang);
    const pool = [...run.sit.sentences, ...run.lang.situations.filter(x => x.source === run.sourceId).flatMap(x => x.sentences)];
    let best = null;
    for (const id of pool) {
      const tk = run.lang.sentences[id].tokens, span = r.spans(tk, prof)[0];
      if (span && (!best || tk.length < best.tk.length)) best = { tk, span };
      if (best && run.sit.sentences.includes(id) && best.tk.length <= 10) break;
    }
    if (!best) return '';
    const idx = Array.from({ length: best.span[1] - best.span[0] + 1 }, (_, k) => best.span[0] + k);
    return `<span class="choice-ex" dir="${run.lang.dir || 'ltr'}">${markedHtml(best.tk, [{ rule: ruleId, idx }], [])}</span>`;
  }

  function levelChoice() {
    const cs = choices(run);
    if (!cs.length) { run.pendingChoice = false; return next(); }
    sfx('level');
    openSheet(`<h2>升級！選一條規則</h2>
      <p class="muted">只在這一局有效。選了之後，句子裡符合這條規則的片段會加上底線。空格是藍框時，答對會觸發連鎖；第 k 環分數 ×(1 + 0.5k)，答錯就斷掉。</p>
      <div class="stack">${cs.map((c, i) => `<button class="choice" data-i="${i}">
        <span class="ic">${c.id}${c.next > 1 ? `<br>Lv${c.next}` : ''}</span><b>${esc(c.name)}</b><small>${esc(c.desc)}</small>${c.next === 1 ? ruleExample(c.id) : ''}</button>`).join('')}</div>`,
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
    const rulesTxt = Object.entries(rep.ruleHits).map(([r, n]) => `${r} ${esc(WALS.find(w => w.id === r).name)} ${n} 環`).join('　');
    openSheet(`
      ${rep.sitDone ? `<div class="celebrate">
        <div class="celebrate-mark">${starRow(rep.best.stars)}</div>
        <b>完成：${esc(rep.sitDone.title)}</b>
        <p>這段學會 ${rep.sitDone.words.length} 個字${rep.sitDone.chunks.length ? `、遇到 ${rep.sitDone.chunks.length} 個語塊` : ''}　解鎖下一段：${esc(rep.advanced)}</p>
        ${rep.sitDone.chunks.length ? `<div class="chips">${rep.sitDone.chunks.map(c => `<span>${esc(c)}</span>`).join('')}</div>` : ''}
      </div>` : ''}
      <h2>本局結束</h2>
      <div class="stars-line">${starRow(rep.stars)}<span>${rep.stars === 3 ? '滿分！' : rep.stars === 2 ? (rep.hadBoss ? '王關答對可拿第 3 顆' : '') : rep.stars === 1 ? '答對率 80% 以上可拿第 2 顆' : '中途結束沒有星數'}</span></div>
      <p class="muted">這一段的最佳紀錄：${starRow(rep.best.stars, true)} ${rep.best.score} 分${rep.newBest ? '（新紀錄！）' : ''}</p>
      <div class="stats">
        <div><b>${rep.score}</b><span>得分</span></div>
        <div><b>${rep.correct}/${rep.correct + rep.wrong}</b><span>答對</span></div>
        <div><b>${rep.maxChain}</b><span>最長連鎖</span></div>
      </div>
      ${SHOW.gold ? `<h3>金幣 +${rep.score + rep.produced}</h3>
      <p class="muted">得分 ${rep.score}${rep.produced ? `　＋　語塊產出 ${rep.produced}（${rep.production.map(p => `${p.chunks.map(c => esc(c.join('＋'))).join(' · ')}${p.chunks.length > 1 ? ` 網絡×${p.mult}` : ''}`).join('、')}）` : ''}</p>` : ''}
      ${rep.levelUps.length ? `<h3>升級</h3><div class="chips">${rep.levelUps.map(u => `<span>${esc(u.lemma)}<em>Lv${u.lv}</em></span>`).join('')}</div>` : ''}
      ${rep.levelDowns.length ? `<h3>抽查未過</h3><div class="chips">${rep.levelDowns.map(l => `<span>${esc(l)}<em>Lv4</em></span>`).join('')}</div>` : ''}
      ${rep.newTiles.length ? `<h3>${SHOW.backpack ? '新詞元進背包' : '新字加入領土'}</h3>
        <p class="muted">點一個字，用學過的字寫下你對它的理解（可以略過）。</p>
        <div class="chips">${rep.newTiles.map(l => {
          const ic = run.lang.base[l] || run.lang.coreByKey?.get(l)?.icon, prime = ic?.tier === 1;
          // 基元不可分割：只顯示，不能寫註解
          return prime ? `<span>${iconHtml(ic)} ${esc(l)}</span>`
            : `<button class="chip-btn" data-mine="${esc(l)}">${ic ? iconHtml(ic) + ' ' : ''}${esc(l)}${L().words[l]?.mine?.length ? ' ✓' : ''}</button>`;
        }).join('')}</div>
        ${SHOW.backpack && rep.auto.length ? `<p class="muted">背包滿了，${rep.auto.map(esc).join('、')} 已自動放在領土邊緣。</p>` : ''}` : ''}
      ${rep.newRules?.length ? `<h3>開放新規則</h3><p class="muted">${rep.newRules.map(r => `${r} ${esc(WALS.find(w => w.id === r).name)}`).join('、')}：之後升級時可以選到，答對用到它的空格會觸發連鎖。</p>` : ''}
      ${rulesTxt ? `<h3>連鎖（共 ${rep.chainLinks} 環）</h3><p class="muted">${rulesTxt}</p>` : ''}
      ${SHOW.path && rep.missed.length ? `<h3>錯過的連結</h3><p class="muted">這些字一起出現，但在領土上離得很遠：${rep.missed.map(m => `${esc(m.a)} ↔ ${esc(m.b)}（${m.steps} 步）`).join('、')}</p>` : ''}
      <h3>${esc(rep.sitTitle)}</h3>
      <p class="muted">${rep.advanced ? `完成了！解鎖下一段：${esc(rep.advanced)}` : `本段進度：${rep.progress.done} 個實詞達到 Lv3（${Math.round(RULES.completeRatio * 100)}% 的實詞達到 Lv3 就完成這段）`}</p>
      <div class="row" style="margin-top:14px">
        <button class="btn ghost big" id="home">回冒險</button>
        ${SHOW.backpack && lg.backpack.length ? `<button class="btn gold big" id="land">去擺放（${lg.backpack.length}）</button>` : ''}
        ${!SHOW.backpack && rep.newTiles.length ? `<button class="btn gold big" id="land">看領土</button>` : ''}
      </div>`, { locked: true }, body => {
      const exit = tab => { closeSheet(); root.hidden = true; document.body.classList.remove('playing'); onEnd(tab); };
      body.querySelector('#home').onclick = () => exit('home');
      body.querySelector('#land')?.addEventListener('click', () => exit('land'));
      body.querySelectorAll('[data-mine]').forEach(b => (b.onclick = () => { exit('land'); onCompose?.(b.dataset.mine); }));
    });
  }

  return { start };
}
