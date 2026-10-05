// 單字領土：平面的六角形等高線地圖（簡約設計）
// 依等級由淺到深上色；等級不同的相鄰格之間畫等高線，高等級的字聚在一起就像山丘。
import { L, word, RULES, isDue, decayProgress, save, now, SHOW } from '../engine/store.js';
import { joinTokens } from '../engine/content.js';
import * as T from '../engine/territory.js';
import { speak, sfx } from '../audio.js';
import { openSheet, closeSheet, toast, esc, stars } from './sheet.js';
import { iconHtml } from './icon.js';
import { G, levelBlocks } from './glyph.js';

// 地形圖的高度色階（1 級最淺，5 級最深）
// 包浩斯配色：單一藍色由淺到深表示等級；語塊邊為紅、選取為黃
const FILL = [null, '#E8E4DA', '#C9D3E6', '#93A9D0', '#5A7BB8', '#1F4FA3'];
const DIM = [null, '#E2DFD8', '#D3D6DC', '#B8C0CF', '#98A5BE', '#7D8DAD'];
const INK = '#111111', RED = '#D7262E', YELLOW = '#F2C12E';
const SQ3 = Math.sqrt(3);
// 尖頂六角形：第 i 條邊（角 i 到角 i+1）面對 T.DIRS[i] 的鄰居
const corner = (cx, cy, s, i) => {
  const a = (Math.PI / 180) * (60 * i - 30);
  return [cx + s * Math.cos(a), cy + s * Math.sin(a)];
};

export function createLand(root, { getLang, onChange }) {
  root.innerHTML = `
    <div class="land2d" id="land2d"><canvas></canvas></div>
    <div class="land-top">
      <span class="chip" id="stat"></span>
      <button class="chip" id="missedBtn" hidden>錯過的連結</button>
      <button class="chip" id="chunkBtn" hidden>語塊</button>
    </div>
    <div class="land-tools">
      <button class="icon-btn" id="zin" aria-label="放大">＋</button>
      <button class="icon-btn" id="zout" aria-label="縮小">－</button>
      <button class="icon-btn" id="home" aria-label="看全部">◎</button>
    </div>
    <div class="bag" hidden>
      <div class="hint-line" id="hint"></div>
      <div class="bag-head"><span><b>背包</b> <span id="bagCount"></span></span><span>點字，再點虛線格</span></div>
      <div class="bag-list" id="bagList"></div>
    </div>`;
  const $ = s => root.querySelector(s);
  const box = $('#land2d'), cv = box.querySelector('canvas'), ctx = cv.getContext('2d');

  let W = 0, H = 0, dpr = 1;
  let cam = { x: 0, y: 0, s: 34 };   // 地圖中心的像素座標與六角形半徑
  let selected = null, focus = null, running = false, raf = 0, highlight = new Set();

  // ---------- 座標 ----------
  const hexToPx = (q, r) => [cam.s * SQ3 * (q + r / 2), cam.s * 1.5 * r];
  const toScreen = (q, r) => { const [x, y] = hexToPx(q, r); return [W / 2 + x - cam.x, H / 2 + y - cam.y]; };
  function screenToHex(sx, sy) {
    const x = sx - W / 2 + cam.x, y = sy - H / 2 + cam.y;
    let q = ((SQ3 / 3) * x - y / 3) / cam.s, r = ((2 / 3) * y) / cam.s, z = -q - r;
    let rq = Math.round(q), rr = Math.round(r), rz = Math.round(z);
    const dq = Math.abs(rq - q), dr = Math.abs(rr - r), dz = Math.abs(rz - z);
    if (dq > dr && dq > dz) rq = -rr - rz; else if (dr > dz) rr = -rq - rz;
    return T.key(rq, rr);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = box.clientWidth; H = box.clientHeight;
    if (!W || !H) return;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    draw();
  }
  new ResizeObserver(resize).observe(box);

  // ---------- 繪圖 ----------
  function hexPath(cx, cy, s) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const [x, y] = corner(cx, cy, s, i); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath();
  }

  function draw() {
    if (!W) return;
    const lang = getLang(), lg = L(), t = lg.territory, s = cam.s;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#F3EFE6';
    ctx.fillRect(0, 0, W, H);
    const cells = Object.entries(t).map(([k, lemma]) => {
      const [q, r] = T.parse(k), w = word(lemma);
      return { k, q, r, lemma, lv: w.lv, due: isDue(w) };
    });
    const lvAt = k => (t[k] ? word(t[k]).lv : 0);

    // 1. 底色
    for (const c of cells) {
      const [x, y] = toScreen(c.q, c.r);
      if (x < -s * 2 || y < -s * 2 || x > W + s * 2 || y > H + s * 2) continue;
      hexPath(x, y, s);
      ctx.fillStyle = (c.due ? DIM : FILL)[c.lv];
      ctx.fill();
      if (c.due) {             // 快要降級：淡淡的斜線
        ctx.save(); ctx.clip();
        ctx.strokeStyle = '#00000014'; ctx.lineWidth = 1;
        for (let d = -s * 2; d < s * 2; d += 5) { ctx.beginPath(); ctx.moveTo(x + d, y - s); ctx.lineTo(x + d + s * 1.2, y + s); ctx.stroke(); }
        ctx.restore();
      }
    }
    // 2. 等高線：每條邊依兩側的等級差畫線；領土邊界最粗
    ctx.lineCap = 'round';
    for (const c of cells) {
      const [x, y] = toScreen(c.q, c.r);
      if (x < -s * 2 || y < -s * 2 || x > W + s * 2 || y > H + s * 2) continue;
      T.DIRS.forEach(([dq, dr], i) => {
        const n = lvAt(T.key(c.q + dq, c.r + dr));
        const diff = c.lv - n;
        if (diff <= 0) return;           // 只由較高的一側畫，避免重複
        const [x1, y1] = corner(x, y, s, i), [x2, y2] = corner(x, y, s, (i + 1) % 6);
        ctx.strokeStyle = n === 0 ? INK : `rgba(17,17,17,${0.3 + 0.15 * diff})`;
        ctx.lineWidth = n === 0 ? Math.max(1.5, s / 14) : Math.max(0.8, (s / 30) * diff);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      });
    }
    // 3. 完成的語塊：相鄰兩格共用的那條邊畫成紅色
    if (SHOW.chunks) {
    ctx.strokeStyle = RED;
    ctx.lineWidth = Math.max(3, s / 6);
    for (const ch of lang.chunks.filter(T.chunkComplete)) {
      const cs = ch.lemmas.map(l => T.parse(T.cellOf(l)));
      for (let j = 0; j + 1 < cs.length; j++) {
        const [q, r] = cs[j], [q2, r2] = cs[j + 1];
        const i = T.DIRS.findIndex(([dq, dr]) => q + dq === q2 && r + dr === r2);
        const [x, y] = toScreen(q, r);
        const [x1, y1] = corner(x, y, s, i), [x2, y2] = corner(x, y, s, (i + 1) % 6);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
    }
    }
    // 4. 可以放下的位置（虛線）
    if (selected) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = `rgba(215,38,46,${0.4 + 0.5 * pulse})`;
      ctx.lineWidth = 2;
      for (const k of T.placeable()) { const [x, y] = toScreen(...T.parse(k)); hexPath(x, y, s * 0.9); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    // 5. 選取與標示
    for (const k of [focus, ...highlight].filter(Boolean)) {
      if (!t[k]) continue;
      const [x, y] = toScreen(...T.parse(k));
      hexPath(x, y, s * 0.88);
      ctx.strokeStyle = k === focus ? INK : YELLOW;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    // 6. 文字：放大時顯示，縮小時只剩色塊
    if (s >= 22) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const c of cells) {
        const [x, y] = toScreen(c.q, c.r);
        if (x < -s || y < -s || x > W + s || y > H + s) continue;
        let fs = Math.min(15, s * 0.42);
        ctx.font = `700 ${fs}px Futura, "Avenir Next", system-ui, "PingFang TC", "Hiragino Sans", sans-serif`;
        while (fs > 8 && ctx.measureText(c.lemma).width > s * 1.55) { fs -= 1; ctx.font = ctx.font.replace(/\d+(\.\d+)?px/, fs + 'px'); }
        ctx.fillStyle = c.lv >= 4 && !c.due ? '#FFFFFF' : INK;
        ctx.fillText(c.lemma, x, y);
      }
    }
  }

  function loop() {
    draw();
    if (running && selected) raf = requestAnimationFrame(loop);
  }
  const redraw = () => { cancelAnimationFrame(raf); loop(); };

  // ---------- 介面 ----------
  function rebuild() {
    const lang = getLang(), lg = L();
    const done = lang.chunks.filter(T.chunkComplete).length;
    const biggest = Math.max(0, ...T.chunkNetworks(lang.chunks).map(n => n.length));
    const due = Object.values(lg.territory).filter(l => isDue(word(l))).length;
    // 依已開放的功能顯示按鈕；背包介面只在移動格子時出現（拿起的字暫放在這裡）
    $('#missedBtn').hidden = !SHOW.path;
    $('#chunkBtn').hidden = !SHOW.chunks;
    $('.bag').hidden = !SHOW.backpack && !lg.backpack.length;
    $('#stat').textContent = `${T.count()} 格${SHOW.chunks ? `・語塊 ${done}/${lang.chunks.length}${biggest > 1 ? `・網絡 ${biggest}` : ''}` : ''}${due ? `・${due} 格快降級` : ''}`;
    $('#bagCount').textContent = `${lg.backpack.length} / ${RULES.backpackSize}`;
    $('#bagList').innerHTML = lg.backpack.length
      ? lg.backpack.map(l => `<button class="bag-item${selected === l ? ' sel' : ''}" data-l="${esc(l)}">${esc(l)}<small>Lv${word(l).lv}</small></button>`).join('')
      : '<span class="muted" style="padding:8px 4px">背包是空的。去冒險練習，升到 Lv2 的實詞會放進背包。</span>';
    root.querySelectorAll('[data-l]').forEach(b => (b.onclick = () => {
      const l = b.dataset.l;
      selected = selected === l ? null : l;
      if (selected) speak(l, { rate: 0.85 });
      focus = null;
      rebuild();
    }));
    $('#hint').textContent = selected ? `把「${selected}」放到虛線格（和常一起出現的字放近，得分更高）` : '';
    onChange?.();
    redraw();
  }

  function fitAll() {
    const ks = Object.keys(L().territory).map(T.parse);
    if (!ks.length) { cam = { x: 0, y: 0, s: 34 }; return; }
    cam.s = 34;
    const pts = ks.map(([q, r]) => hexToPx(q, r));
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const spanX = Math.max(...xs) - Math.min(...xs) + cam.s * 3, spanY = Math.max(...ys) - Math.min(...ys) + cam.s * 3;
    const k = Math.min(1.3, Math.max(0.15, Math.min((W || 360) / spanX, ((H || 500) - 160) / spanY)));
    cam.s *= k;
    const p2 = ks.map(([q, r]) => hexToPx(q, r));
    cam.x = (Math.min(...p2.map(p => p[0])) + Math.max(...p2.map(p => p[0]))) / 2;
    cam.y = (Math.min(...p2.map(p => p[1])) + Math.max(...p2.map(p => p[1]))) / 2 + 50;
  }
  function lookAtCell(k) {
    const [q, r] = T.parse(k);
    cam.s = Math.max(cam.s, 34);
    [cam.x, cam.y] = hexToPx(q, r);
  }
  function zoomBy(f, sx = W / 2, sy = H / 2) {
    const ns = Math.min(80, Math.max(5, cam.s * f)), k = ns / cam.s;
    // 以手指或滑鼠位置為中心縮放
    cam.x = (cam.x + sx - W / 2) * k - (sx - W / 2);
    cam.y = (cam.y + sy - H / 2) * k - (sy - H / 2);
    cam.s = ns;
    redraw();
  }

  // ---------- 操作：拖曳平移、雙指縮放、點擊 ----------
  const pts = new Map();
  let moved = false, pinch0 = 0, s0 = 34, downAt = null;
  box.addEventListener('pointerdown', e => {
    box.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { moved = false; downAt = { x: e.clientX, y: e.clientY }; }
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); s0 = cam.s; moved = true; }
  });
  box.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    if (pts.size === 1) {
      if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8) moved = true;
      if (moved) { cam.x -= e.clientX - p.x; cam.y -= e.clientY - p.y; redraw(); }
    }
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], rect = box.getBoundingClientRect();
      zoomBy((s0 * Math.hypot(a.x - b.x, a.y - b.y)) / pinch0 / cam.s, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
    }
  });
  box.addEventListener('pointerup', e => {
    const wasTap = pts.size === 1 && !moved;
    pts.delete(e.pointerId);
    if (wasTap) { const r = box.getBoundingClientRect(); tap(e.clientX - r.left, e.clientY - r.top); }
  });
  box.addEventListener('pointercancel', e => pts.delete(e.pointerId));
  box.addEventListener('wheel', e => { e.preventDefault(); const r = box.getBoundingClientRect(); zoomBy(e.deltaY < 0 ? 1.12 : 0.89, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  $('#zin').onclick = () => zoomBy(1.3);
  $('#zout').onclick = () => zoomBy(1 / 1.3);
  $('#home').onclick = () => { fitAll(); redraw(); };

  function tap(sx, sy) {
    const k = screenToHex(sx, sy), lg = L();
    highlight = new Set();
    if (selected) {
      if (T.place(selected, k)) {
        sfx('place');
        const done = getLang().chunks.filter(c => c.lemmas.includes(selected) && T.chunkComplete(c));
        if (SHOW.chunks && done.length) { sfx('coin'); toast(`完成語塊：${done.map(c => c.lemmas.join('＋')).join('、')}`); }
        selected = null;
        focus = k;
        rebuild();
      } else if (!lg.territory[k]) toast('只能放在虛線格上（領土要相連）');
      return;
    }
    if (lg.territory[k]) { focus = k; redraw(); tileSheet(k); }
    else if (focus) { focus = null; redraw(); }
  }

  // ---------- 格子資訊 ----------
  // ---------- 我的理解：用學過的其他字組合出對這個字的解釋（不判斷對錯、不計分） ----------
  const chip = (lang, l, attr = '') => `<button class="mchip" ${attr}>${lang.base[l] ? iconHtml(lang.base[l]) + ' ' : ''}${esc(l)}</button>`;
  const mineHtml = (lang, parts) => `<div class="mine">${parts.map(p => chip(lang, p, 'disabled')).join('<i>＋</i>')}</div>`;

  function tileSheet(k) {
    const lang = getLang(), lg = L(), lemma = lg.territory[k], w = word(lemma);
    const info = lang.lemmas.get(lemma);
    const days = RULES.decayDays[w.lv];
    const status = w.lv === 5 ? '5 級：不會因時間降級，但會被隨機抽查'
      : days ? `${isDue(w) ? '快要降級，' : ''}${Math.max(0, Math.ceil(days * (1 - decayProgress(w))))} 天內沒練習會降到 Lv${w.lv - 1}` : '';
    const chunks = lang.chunks.filter(c => c.lemmas.includes(lemma));
    const mine = SHOW.mine ? w.mine?.at(-1) : null;
    const mineBlock = mine ? `<h3>${isDue(w) ? '你當時的理解' : '我的理解'}</h3>${mineHtml(lang, mine.parts)}
      <p class="muted">${new Date(mine.t).toLocaleDateString('zh-TW')}${w.mine.length > 1 ? `・修改過 ${w.mine.length - 1} 次` : ''}</p>` : '';
    // 看解釋時，領土上用到的那幾格一起亮起來
    highlight = new Set((mine?.parts || []).map(T.cellOf).filter(Boolean));
    redraw();
    openSheet(`
      <h2>${lang.base[lemma] ? iconHtml(lang.base[lemma]) + ' ' : ''}${esc(lemma)} ${levelBlocks(w.lv)}</h2>
      ${isDue(w) ? mineBlock : ''}
      <p class="muted">Lv${w.lv}　熟練度 ${w.prof} / ${RULES.threshold}　答對 ${w.correct} 次<br>${status}<br>寫法：${[...info.forms].map(esc).join('、')}</p>
      ${isDue(w) ? '' : mineBlock}
      ${SHOW.chunks && chunks.length ? `<h3>相關語塊</h3><div class="chips">${chunks.map(c => `<span>${T.chunkComplete(c) ? '完成・' : ''}${esc(c.lemmas.join('＋'))}</span>`).join('')}</div>` : ''}
      ${SHOW.mine ? `<button class="btn ghost big" id="mineBtn" style="margin-top:14px">${mine ? '修改我的理解' : '寫下我的理解'}</button>` : ''}
      <div class="row" style="margin-top:12px">
        <button class="btn ghost big" id="say">${G.speaker()} 發音</button>
        ${SHOW.move ? `<button class="btn gold big" id="lift">移動${SHOW.gold ? `（${RULES.moveCost} 金幣）` : ''}</button>` : ''}
      </div>`, { onClose: () => { focus = null; highlight = new Set(); redraw(); } }, body => {
      body.querySelector('#say').onclick = () => speak(lemma, { rate: 0.85 });
      body.querySelector('#mineBtn')?.addEventListener('click', () => composeSheet(k));
      body.querySelector('#lift')?.addEventListener('click', () => {
        const r = T.pickUp(k);
        if (!r.ok) return toast(r.reason);
        sfx('coin');
        selected = lemma;
        focus = null;
        closeSheet();
        rebuild();
        toast(`點虛線格，把「${lemma}」放到新的位置`);
      });
    });
  }

  function composeSheet(k) {
    const lang = getLang(), lg = L(), lemma = lg.territory[k], w = word(lemma);
    let parts = [...(w.mine?.at(-1)?.parts || [])], filter = '';
    // 材料：學過（Lv2 以上）的其他字；NSM 基元排前面
    const materials = Object.entries(lg.words).filter(([l, x]) => x.lv >= 2 && l !== lemma && lang.lemmas.get(l)).map(([l]) => l)
      .sort((a, b) => (lang.base[b]?.tier === 1) - (lang.base[a]?.tier === 1) || a.localeCompare(b));
    const exs = lang.lemmas.get(lemma).sentences.slice(0, 3).map(id => joinTokens(lang.sentences[id].tokens, lang.joiner));
    openSheet(`<h2>我對「${esc(lemma)}」的理解</h2>
      <p class="muted">用你學過的字，組合出你對這個字的理解。沒有標準答案，只給你自己看。</p>
      <div class="stack">${exs.map((t, i) => `<button class="ex-row" data-ex="${i}">${esc(t)} ${G.speaker(14)}</button>`).join('')}</div>
      <h3>我的組合</h3><div class="mine compose" id="parts"></div>
      <input id="filter" class="filter" placeholder="搜尋學過的字" autocomplete="off" autocapitalize="off">
      <div class="materials" id="mats"></div>
      <div class="row" style="margin-top:12px"><button class="btn ghost big" id="cancel">取消</button><button class="btn gold big" id="saveMine">儲存</button></div>`,
      {}, body => {
        const draw = () => {
          body.querySelector('#parts').innerHTML = parts.length
            ? parts.map((p, i) => chip(lang, p, `data-rm="${i}"`)).join('<i>＋</i>')
            : '<span class="muted">從下面點字加入</span>';
          const list = materials.filter(l => !filter || l.toLowerCase().includes(filter.toLowerCase()));
          body.querySelector('#mats').innerHTML = list.map(l => chip(lang, l, `data-add="${esc(l)}"`)).join('') ||
            `<span class="muted">${materials.length ? '找不到這個字' : '還沒有其他學過的字，先去冒險練習吧'}</span>`;
          body.querySelectorAll('[data-rm]').forEach(b => (b.onclick = () => { parts.splice(+b.dataset.rm, 1); draw(); }));
          body.querySelectorAll('[data-add]').forEach(b => (b.onclick = () => { parts.push(b.dataset.add); sfx('tap'); speak(b.dataset.add, { rate: 0.85 }); draw(); }));
        };
        draw();
        body.querySelectorAll('[data-ex]').forEach(b => (b.onclick = () => speak(exs[+b.dataset.ex], { rate: 0.85 })));
        body.querySelector('#filter').oninput = e => { filter = e.target.value.trim(); draw(); };
        body.querySelector('#cancel').onclick = () => tileSheet(k);
        body.querySelector('#saveMine').onclick = () => {
          if (!parts.length) return toast('至少選一個字');
          w.mine = [...(w.mine || []), { t: now(), parts }];
          save();
          sfx('place');
          tileSheet(k);
        };
      });
  }

  if ($('#missedBtn')) $('#missedBtn').onclick = () => {
    const m = L().lastReport?.missed || [];
    openSheet(`<h2>錯過的連結</h2>
      <p class="muted">上一局一起出現、但在領土上離得很遠的字。把它們放近一點，下一局的路徑加成會更高。</p>
      <div class="stack">${m.length ? m.map((x, i) => `<button class="btn ghost" data-i="${i}">${esc(x.a)} ↔ ${esc(x.b)}　（${x.steps} 步）</button>`).join('') : '<p class="muted">目前沒有。</p>'}</div>`,
      {}, body => body.querySelectorAll('[data-i]').forEach(b => (b.onclick = () => {
        const x = m[+b.dataset.i];
        closeSheet();
        highlight = new Set([T.cellOf(x.a), T.cellOf(x.b)].filter(Boolean));
        lookAtCell(T.cellOf(x.a));
        redraw();
      })));
  };
  if ($('#chunkBtn')) $('#chunkBtn').onclick = () => {
    const lang = getLang(), lg = L();
    const known = l => T.cellOf(l) || lg.backpack.includes(l);
    const list = lang.chunks.filter(c => c.lemmas.every(known));
    openSheet(`<h2>語塊</h2>
      <p class="muted">來源裡經常一起出現的字。把它們依序相鄰擺好就完成語塊，每局結算時產出金幣（等級越高產越多）。
      共用同一格的語塊會連成網絡，網絡裡的語塊越多，產出加成越高（每多一個 +25%）。這裡只列出你已經學過的語塊。</p>
      ${T.chunkNetworks(lang.chunks).filter(n => n.length > 1).map(n => `<p class="muted">網絡 ×${1 + T.NETWORK_BONUS * (n.length - 1)}：${n.map(c => esc(c.lemmas.join('＋'))).join(' · ')}</p>`).join('')}
      <div class="stack">${list.length ? list.map(c => `<div class="btn ghost" style="text-align:left">${T.chunkComplete(c) ? '完成・' : ''}${esc(c.lemmas.join(' ＋ '))}<small class="muted">　出現 ${c.count} 次</small></div>`).join('') : '<p class="muted">還沒有。繼續練習來源裡的字吧。</p>'}</div>`);
  };

  return {
    show() { running = true; resize(); fitAll(); rebuild(); },
    hide() { running = false; cancelAnimationFrame(raf); selected = null; focus = null; highlight = new Set(); },
    rebuild,
  };
}
