// 內層畫面（最小可行系統）：一局 3 分鐘。每一題都要自己說出或寫出來；說或寫由使用者依場合選。
import * as V from '../engine/v2.js';
import { spaceBefore } from '../engine/content.js';
import { L } from '../engine/store.js';
import * as T from '../engine/territory.js';
import { speak, speakGap, stopSpeech, sfx, listen, canListen } from '../audio.js';
import { openSheet, closeSheet, esc, toast, sheetOpen } from './sheet.js';
import { iconHtml } from './icon.js';
import { mountComposer, partsHtml } from './compose.js';
import * as P from '../engine/phono.js';
import { G } from './glyph.js';
import * as PR from '../engine/pronounce.js';
import * as PL from '../engine/pronlog.js';

const graphemes = w => [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(w)].map(x => x.segment);
const SPACE = '␣';

export function createPlay(root, { onEnd, onSound }) {
  let run, q, answered, way, picked, prOk = false, clock = 0, token = 0, pron = null;
  const noRecog = new Set();
  const $ = s => root.querySelector(s);
  const canSay = () => prOk || (canListen && !noRecog.has(run.lang.id));

  function start(lang, sourceId) {
    run = V.startRun(lang, sourceId);
    prOk = false;
    if (PR.configured()) PR.supports(lang.id).then(v => { prOk = v; if (q && !answered) render(); }).catch(() => {});
    document.body.classList.add('playing');
    root.hidden = false;
    root.innerHTML = `<div class="hud"><button class="icon-btn" id="quit" aria-label="結束">${G.close()}</button>
        <div class="prog"><i></i></div><div class="clock" id="clock">3:00</div></div>
      <div class="qcard" id="qcard"></div>`;
    $('#quit').onclick = () => finish();
    clearInterval(clock);
    clock = setInterval(tick, 500);
    next();
  }
  function tick() {
    const left = V.timeLeft(run);
    $('#clock').textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
    $('.prog i').style.width = `${(1 - left / V.RUN_MS) * 100}%`;
    $('#clock').classList.toggle('low', left < 20000);
  }

  function next() {
    stopSpeech();
    closeSheet();
    // 時間到：正在作答的那一題答完才結束，所以只在換題時檢查
    if (V.timeLeft(run) <= 0) return finish();
    q = V.next(run);
    if (!q) return finish();
    answered = false; way = null; picked = []; pron = null;
    try { if (localStorage.getItem('debug-v2')) window.__q = q; } catch {}   // 只給自動測試用
    token++;
    render();
    playCue();
  }

  // ---------- 題目 ----------
  const hard = () => P.hardSounds(run.lang.wals);
  const ipaHtml = w => { const sg = P.wordSegs(run.lang.id, w); return sg ? `<span class="ipa">/${sg.map(x => (hard().has(x) ? `<b class="hs" data-hs="${esc(x)}">${esc(x)}</b>` : esc(x))).join('')}/</span>` : ''; };
  const sentenceHtml = (s, hl, gap) => `<div class="sentence v2-sent" dir="${run.lang.dir || 'ltr'}">${s.tokens.map((t, i) =>
    `${spaceBefore(s.tokens, i, run.lang.joiner)}${i === hl ? (gap ? '<span class="slot">　</span>' : `<span class="ctx teach-hl">${esc(t.surface)}</span>`) : `<span class="ctx">${esc(t.surface)}</span>`}`).join('')}</div>`;
  const markerHtml = ms => (ms.length ? `<div class="markers">${ms.map(m => `<span class="marker" dir="auto">${esc(m)}</span>`).join('')}</div>` : '');

  function cueHtml() {
    if (q.kind === 'copy') return `${q.icon ? `<div class="core-icon">${iconHtml(q.icon)}</div>` : ''}
      <div class="teach-word" dir="auto">${esc(q.answer)}</div>${ipaHtml(q.answer)}
      ${q.sentence ? sentenceHtml(q.sentence, q.hl, false) : ''}`;
    if (q.kind === 'form') return `<div class="cue-mine">${partsHtml(q.cue)}</div>${markerHtml(q.markers)}`;
    if (q.kind === 'combine') return `<div class="cue-combine">${q.parts.map(p => `<div class="cue-mine">${partsHtml(p.cue)}</div>`).join('')}</div>${markerHtml(q.markers)}${q.question ? '<div class="markers"><span class="marker">❓</span></div>' : ''}`;
    if (q.kind === 'context') return sentenceHtml(q.sentence, q.hl, true);
    return '';
  }
  const TASK = { copy: '照著說或寫', form: '從這個理解說出或寫出這個字', combine: '照正確的順序說出或寫出這一段', context: '說出或寫出空著的字' };

  function render() {
    const card = $('#qcard');
    if (q.kind === 'understand') return renderUnderstand(card);
    const w = way || (canSay() ? null : 'spell');
    card.innerHTML = `
      <div class="badges"><span class="badge lv">Lv${q.lv} ${V.LV_NAME[q.lv]}</span>${q.extra ? '<span class="badge">複習</span>' : ''}</div>
      <div class="qmain teach">
        ${cueHtml()}
        <p class="muted task">${TASK[q.kind]}</p>
        ${q.kind === 'copy' || q.kind === 'context' ? `<div class="listen-row"><button class="btn sm" id="replay">${G.speaker()} 再聽一次</button></div>` : ''}
        <div id="fb" class="feedback"></div>
      </div>
      <div class="teach-answer">${answered ? '' : answerArea(w)}</div>`;
    bind();
  }
  function answerArea(w) {
    if (!w) return `<div class="row teach-way"><button class="btn gold big" id="waySay">${G.mic()} 說</button><button class="btn ghost big" id="waySpell">寫</button></div>`;
    if (w === 'say') return `<button class="btn gold mic" id="mic">${G.mic()} 說出來</button><button class="linkish" id="waySpell">改用寫的</button>`;
    if (w === 'spell') {
      q.letters ||= letterCards(q.answer);
      const spelled = picked.map(k => q.letters[k]).join('').replaceAll(SPACE, ' ');
      return `<div class="spell-slot" dir="auto">${esc(spelled) || '　'}</div>
        <div class="letters">${q.letters.map((g, i) => `<button class="letter${picked.includes(i) ? ' used' : ''}" data-l="${i}">${esc(g)}</button>`).join('')}</div>
        <div class="row"><button class="btn ghost sm" id="back">刪除</button><button class="linkish" id="wayType">改用鍵盤</button></div>`;
    }
    return `<div class="produce"><input id="inp" placeholder="寫出來" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="btn gold" id="send">送出</button></div>`;
  }
  // 字母卡：答案的字母（多個字時加上空格卡）打散，再加 2～3 個這個語言裡其他字的字母
  function letterCards(ans) {
    const own = graphemes(ans).map(g => (g === ' ' ? SPACE : g));
    const pool = [...new Set([...run.lang.lemmas.keys()].flatMap(x => graphemes(x.toLocaleLowerCase())))].filter(g => /\p{L}/u.test(g) && !own.includes(g));
    for (let i = pool.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const all = [...own, ...pool.slice(0, own.length > 6 ? 2 : 3)];
    for (let i = all.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [all[i], all[j]] = [all[j], all[i]]; }
    return all;
  }
  function bind() {
    $('#replay') && ($('#replay').onclick = playCue);
    root.querySelectorAll('.qmain [data-hs]').forEach(b => (b.onclick = () => onSound?.(b.dataset.hs)));
    $('#waySay') && ($('#waySay').onclick = () => { way = 'say'; render(); });
    $('#waySpell') && ($('#waySpell').onclick = () => { way = 'spell'; picked = []; render(); });
    $('#wayType') && ($('#wayType').onclick = () => { way = 'type'; render(); $('#inp')?.focus(); });
    $('#mic') && ($('#mic').onclick = mic);
    $('#back') && ($('#back').onclick = () => { picked.pop(); render(); });
    root.querySelectorAll('.letter').forEach(b => (b.onclick = () => {
      const i = +b.dataset.l;
      if (answered || picked.includes(i)) return;
      sfx('tap');
      picked.push(i);
      if (picked.length === graphemes(q.answer).length) return submit(picked.map(k => q.letters[k]).join('').replaceAll(SPACE, ' '));
      render();
    }));
    const inp = $('#inp');
    if (inp) { $('#send').onclick = () => submit(inp.value); inp.onkeydown = e => { if (e.key === 'Enter') submit(inp.value); }; }
  }
  // 提示的聲音：認識 = 這個字再加整句；新的情境 = 前半句、提示音、後半句。理解類的提示不唸（唸了就是答案）
  function playCue() {
    if (q.kind === 'copy') return speak(q.answer, { rate: 0.8 }).then(() => (q.sentence ? speak(q.full, { rate: 0.9 }) : null));
    if (q.kind === 'context') return speakGap(q.before, q.after, 0.9);
    return Promise.resolve();
  }

  // ---------- Lv2：寫下理解 ----------
  function renderUnderstand(card) {
    card.innerHTML = `<div class="badges"><span class="badge lv">Lv2 ${V.LV_NAME[2]}</span></div>
      <div class="qmain teach">
        <div class="teach-word" dir="auto">${esc(q.lemma)}</div>${ipaHtml(q.lemma)}
        <div class="listen-row"><button class="btn sm" id="say1">${G.speaker()} 聽</button></div>
        ${q.examples.map((t, i) => `<button class="ex-row" data-ex="${i}" dir="auto">${esc(t)} ${G.speaker(14)}</button>`).join('')}
        <p class="muted task">用圖示和你會的字，組合出你對這個字的理解。沒有標準答案。</p>
      </div><div id="composer"></div>`;
    $('#say1').onclick = () => speak(q.lemma, { rate: 0.8 });
    root.querySelectorAll('[data-ex]').forEach(b => (b.onclick = () => speak(q.examples[+b.dataset.ex], { rate: 0.9 })));
    speak(q.lemma, { rate: 0.8 });
    mountComposer($('#composer'), { lang: run.lang, lemma: q.lemma, initial: V.understanding(q.lemma) || [], suggest: q.suggest, onSave: parts => {
      const res = V.saveUnderstanding(run, q.lemma, parts);
      sfx('level');
      answered = true;
      card.innerHTML = `<div class="qmain teach"><div class="teach-word" dir="auto">${esc(q.lemma)}</div><div class="cue-mine">${partsHtml(parts)}</div>
        <div class="feedback ok">${res.levelUp ? `升到 Lv3：${V.LV_NAME[3]}` : '已更新你的理解'}</div></div>
        <div class="teach-answer"><button class="btn green big" id="cont">繼續 ›</button></div>`;
      $('#cont').onclick = next;
    } });
  }

  // ---------- 說 ----------
  async function mic() {
    if (PR.configured() && await PR.supports(run.lang.id)) return scoredMic();
    const btn = $('#mic');
    btn.disabled = true; btn.textContent = '聆聽中…';
    try {
      const alts = await listen();
      if (!alts.length) { toast('沒有聽到聲音，再試一次'); btn.disabled = false; btn.innerHTML = `${G.mic()} 再說一次`; return; }
      submit(alts, { spoken: true });
    } catch (e) {
      if (e?.error === 'language-not-supported') noRecog.add(run.lang.id);
      toast('語音辨識無法使用，改用寫的');
      way = 'spell'; render();
    }
  }
  // 發音評分：拿拼法最接近的 3 個字一起比較（唸了別的字不算），唸對時每個音都評分
  async function scoredMic() {
    const btn = $('#mic');
    btn.disabled = true;
    try {
      const a = q.answer.toLocaleLowerCase();
      const pool = [...new Set([...run.lang.lemmas.values()].flatMap(x => [...x.forms]).map(w => w.toLocaleLowerCase()))].filter(w => w !== a && w.length > 1);
      const near = pool.map(w => [w, (w.includes(a) || a.includes(w) ? 0 : 1000) + P.editDistance(a, w)]).sort((x, y) => x[1] - y[1]).slice(0, 3).map(([w]) => w);
      const [ph, ...aph] = await Promise.all([q.answer, ...near].map(t => PR.phonemize(t, run.lang.id)));
      if (!ph.ok) throw new Error(ph.msg);
      const choices = aph.filter(x => x.ok).map(x => x.phones);
      const pcm = await PR.record(st => { btn.textContent = st === 'listening' ? '請說…' : st === 'heard' ? '聽到了…' : '評分中…'; });
      const r = await PR.score(pcm, ph.phones, -1, run.lang.id, choices);
      if (!r.ok) { toast(r.msg || '請再說一次'); btn.disabled = false; btn.innerHTML = `${G.mic()} 再說一次`; return; }
      const ok = !r.chosen;
      if (ok && r.per_phone) {
        pron = { ipa: ph.ipa, per: r.per_phone };
        PL.add({ lang: run.lang.id, word: q.answer, phones: ph.ipa, per: r.per_phone }).catch(() => {});
      }
      submit(ok ? [q.answer] : [], { spoken: true, verdict: ok });
    } catch (e) {
      toast(`發音評分無法使用（${e.message || '連線失敗'}）`);
      btn.disabled = false; btn.innerHTML = `${G.mic()} 再說一次`;
    }
  }

  // ---------- 作答結果 ----------
  function submit(response, { spoken = false, verdict } = {}) {
    if (answered) return;
    answered = true;
    const ok = verdict !== undefined ? verdict : V.check(q, response);
    const res = V.answer(run, q, ok);
    render();
    const fb = $('#fb');
    fb.className = `feedback ${ok ? 'ok' : 'no'}`;
    const lines = [];
    if (ok) {
      sfx(res.levelUp || res.master ? 'level' : 'good');
      lines.push(`正確<span class="ans" dir="auto">${esc(q.answer)}</span>`);
      if (res.master) lines.push('<b>這個字精熟了</b>');
      else if (res.levelUp) lines.push(`<b>升到 Lv${res.levelUp}：${V.LV_NAME[res.levelUp]}</b>${res.tile ? '　領土長出新的一格' : ''}`);
      else if (res.pending) lines.push(`<small>明天以後再答對一次，就升到 Lv${q.lv === 5 ? '5 精熟' : q.lv + 1}</small>`);
    } else {
      sfx('bad');
      lines.push(`${spoken ? '這次不算' : `你寫的是<span class="ans" dir="auto">${esc([].concat(response)[0] || '')}</span>`}　正確答案<span class="ans" dir="auto">${esc(q.answer)}</span>`);
      lines.push('<small>這一局稍後會再出一次</small>');
    }
    fb.innerHTML = lines.join('<br>');
    if (pron) {
      const bad = pron.per.filter(x => x && x.level !== 'good' && x.heard !== x.ph);
      fb.insertAdjacentHTML('beforeend', `<div class="pron"><span class="ipa">/${pron.ipa.map((s, i) => { const x = pron.per[i]; return x ? `<b class="pron-${x.level}" data-hs="${esc(s)}">${esc(s)}</b>` : esc(s); }).join('')}/</span>
        <small>${bad.length ? bad.slice(0, 3).map(x => (x.heard === '∅' ? `/${esc(x.ph)}/ 好像漏掉了` : `/${esc(x.ph)}/ 像 /${esc(x.heard)}/`)).join('、') : '每個音都唸對了'}</small></div>`);
      fb.querySelectorAll('[data-hs]').forEach(b => (b.onclick = () => onSound?.(b.dataset.hs)));
    }
    const cont = document.createElement('button');
    cont.className = `btn ${ok ? 'green' : 'gold'} big`;
    cont.textContent = V.timeLeft(run) > 0 ? '繼續 ›' : '時間到，看結果 ›';
    cont.onclick = next;
    $('.teach-answer').appendChild(cont);
    const my = token;
    const say = q.kind === 'context' || q.kind === 'copy' ? q.full : q.answer;
    if (ok) speak(say, { rate: 0.9 }).then(() => setTimeout(() => my === token && !sheetOpen() && next(), 600));
    else speak(say, { rate: 0.85 });
  }

  // ---------- 結束 ----------
  function finish() {
    if (run.ended) return;
    run.ended = true;
    clearInterval(clock);
    stopSpeech();
    T.receive(run.newTiles);
    const byWord = new Map();
    for (const x of run.log) byWord.set(x.lemma, { ...byWord.get(x.lemma), ...x, ok: (byWord.get(x.lemma)?.ok ?? true) && x.ok });
    const lg = L(), d = V.today();
    const ups = run.log.filter(x => x.ok).map(x => x.lemma).filter((l, i, a) => a.indexOf(l) === i && (lg.words[l]?.lv || 1) > (run.log.find(y => y.lemma === l).lv));
    const pending = Object.values(lg.words).filter(w => w.okDay === d).length;
    openSheet(`<h2>這一局</h2>
      <div class="report-grid"><div><b>${byWord.size}</b><span>練過的字</span></div><div><b>${ups.length}</b><span>升級</span></div><div><b>${run.newTiles.length}</b><span>新的格子</span></div></div>
      ${ups.length ? `<h3>升級</h3><div class="chips">${ups.map(l => `<span dir="auto">${esc(l)}<em>Lv${lg.words[l].lv}${lg.words[l].master ? ' 精熟' : ''}</em></span>`).join('')}</div>` : ''}
      ${pending ? `<p class="muted">今天答對、還在等確認的字：${pending} 個。明天以後再答對一次，就會升級。</p>` : ''}
      <div class="stack" style="margin-top:14px"><button class="btn gold big" id="land">看領土</button><button class="btn ghost big" id="again">再一局</button></div>`, { locked: true }, body => {
      body.querySelector('#land').onclick = () => { closeSheet(); end('land'); };
      body.querySelector('#again').onclick = () => { closeSheet(); start(run.lang, run.sourceId); };
    });
  }
  function end(tab) {
    root.hidden = true;
    document.body.classList.remove('playing');
    onEnd?.(tab);
  }

  return { start };
}
