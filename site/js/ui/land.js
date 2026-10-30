// 單字領土：平面的六角形等高線地圖（簡約設計）
// 依等級由淺到深上色；等級不同的相鄰格之間畫等高線，高等級的字聚在一起就像山丘。
import { L, word, RULES, isDue, decayProgress, save, now, SHOW } from '../engine/store.js';
import { joinTokens } from '../engine/content.js';
import * as T from '../engine/territory.js';
import { speak, sfx } from '../audio.js';
import { openSheet, closeSheet, toast, esc, stars } from './sheet.js';
import { iconHtml } from './icon.js';
import { G, levelBlocks } from './glyph.js';
import * as P from '../engine/phono.js';

// 地形圖的高度色階（1 級最淺，5 級最深）
// 包浩斯配色：單一藍色由淺到深表示等級；語塊邊為紅、選取為黃
const FILL = [null, '#E8E4DA', '#C9D3E6', '#93A9D0', '#5A7BB8', '#1F4FA3'];
const DIM = [null, '#E2DFD8', '#D3D6DC', '#B8C0CF', '#98A5BE', '#7D8DAD'];
const INK = '#2F2B26', RED = '#D7262E', YELLOW = '#F2C12E';
// 粉彩微縮島：湖水藍的海、沙色的側面、由淺到深的綠色頂面（越熟越深）、珊瑚色選取
const SEA = ['#9ED4D2', '#6FB6BA'], SIDE = '#E3CFA6', CORAL = '#E2734F';
const TOP = ['#CFE3B0', '#B5D69A', '#97C482', '#79AE6E', '#5E955E'];
const TILT = 0.62;
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
      <div class="bag-head"><span><b>箱子</b> <span id="bagCount"></span></span><span>點一格，再點虛線的位置</span></div>
      <div class="bag-list" id="bagList"></div>
    </div>`;
  const $ = s => root.querySelector(s);
  const box = $('#land2d'), cv = box.querySelector('canvas'), ctx = cv.getContext('2d');

  let W = 0, H = 0, dpr = 1;
  let cam = { x: 0, y: 0, s: 34 };   // 地圖中心的像素座標與六角形半徑
  let selected = null, focus = null, running = false, raf = 0, highlight = new Set();

  // ---------- 座標 ----------
  // 斜看的鏡頭：縱向壓扁成 TILT，看起來像從斜上方看微縮島
  const hexToPx = (q, r) => [cam.s * SQ3 * (q + r / 2), cam.s * 1.5 * r * TILT];
  const toScreen = (q, r) => { const [x, y] = hexToPx(q, r); return [W / 2 + x - cam.x, H / 2 + y - cam.y]; };
  function screenToHex(sx, sy) {
    const x = sx - W / 2 + cam.x, y = (sy - H / 2 + cam.y) / TILT;
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
  // 斜看的六角形：角的縱向座標乘上 TILT
  const tcorner = (cx, cy, s, i) => { const [x, y] = corner(0, 0, s, i); return [cx + x, cy + y * TILT]; };
  function hexPath(cx, cy, s) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const [x, y] = tcorner(cx, cy, s, i); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath();
  }
  // 地磚的高度：熟練度越高越高（最小模型：通過的字都是 1）
  const tileLevel = lemma => L().words[lemma]?.level || 1;
  const heightOf = (lv, s) => s * (0.28 + 0.16 * (lv - 1));
  // 螢幕上的一點落在哪一格的頂面或側面：從最前面的格子開始找
  let drawn = [];
  function pickTile(sx, sy) {
    for (let j = drawn.length - 1; j >= 0; j--) {
      const c = drawn[j];
      hexPath(c.x, c.y - c.h, c.s);
      if (ctx.isPointInPath(sx * dpr, sy * dpr)) return c.k;
      // 側面：頂面和底面之間
      if (Math.abs(sx - c.x) < c.s * SQ3 / 2 && sy > c.y - c.h && sy < c.y + c.s * TILT * 0.5) return c.k;
    }
    return null;
  }

  function draw() {
    if (!W) return;
    const lang = getLang(), lg = L(), t = lg.territory, s = cam.s;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 1. 海：上淺下深的湖水藍，加幾道淡淡的波紋
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, SEA[0]); g.addColorStop(1, SEA[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5;
    for (let y = ((-cam.y) % 46 + 46) % 46; y < H; y += 46) for (let x = ((-cam.x) % 120 + 120) % 120 - 120; x < W; x += 120) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 15, y - 5, x + 30, y); ctx.stroke();
    }
    // 2. 地磚：由後往前畫，前面的格子蓋住後面格子的側面；緊密相接沒有縫隙
    const cells = Object.entries(t).map(([k, lemma]) => { const [q, r] = T.parse(k); return { k, q, r, lemma, lv: tileLevel(lemma) }; })
      .sort((a, b) => a.r - b.r || a.q - b.q);
    drawn = [];
    for (const c of cells) {
      const [x, y] = toScreen(c.q, c.r), h = heightOf(c.lv, s);
      if (x < -s * 2 || y < -s * 3 || x > W + s * 2 || y > H + s * 2) continue;
      drawn.push({ k: c.k, x, y, h, s });
      // 側面：看得到的四條邊（右、右下、左下、左），往下延伸 h
      ctx.beginPath();
      const top = [0, 1, 2, 3, 4].map(i => tcorner(x, y - h, s, i)), bot = [4, 3, 2, 1, 0].map(i => tcorner(x, y, s, i));
      [...top, ...bot].forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
      ctx.fillStyle = SIDE; ctx.fill();
      // 側面下緣的陰影線，讓地磚看起來浮在水上
      ctx.strokeStyle = 'rgba(40,70,80,0.18)'; ctx.lineWidth = 1; ctx.stroke();
      // 頂面
      hexPath(x, y - h, s);
      ctx.fillStyle = TOP[Math.min(TOP.length - 1, c.lv - 1)];
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1, s / 22); ctx.stroke();
    }
    // 3. 可以放下的位置：海面上發光的虛線六角形
    if (selected) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = `rgba(255,255,255,${0.55 + 0.45 * pulse})`;
      ctx.lineWidth = 2.5;
      for (const k of T.placeable()) { const [x, y] = toScreen(...T.parse(k)); hexPath(x, y, s * 0.9); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    // 4. 選取：頂面描一圈珊瑚色
    for (const d of drawn) if (d.k === focus) { hexPath(d.x, d.y - d.h, s * 0.9); ctx.strokeStyle = CORAL; ctx.lineWidth = 3.5; ctx.stroke(); }
    // 5. 圖示立在頂面上；放大時，下方加上圓角的字名標籤
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // 先畫全部的圖示，再畫全部的標籤，標籤才不會被後面格子的圖示蓋住
    ctx.font = `${Math.min(30, s * 0.78)}px system-ui, "Apple Color Emoji", sans-serif`;
    for (const d of drawn) { const ic = emojiOf(lang, t[d.k]); if (ic) ctx.fillText(ic, d.x, d.y - d.h - s * 0.18); }
    if (s >= 26) for (const d of drawn) {
      const lemma = t[d.k], cy = d.y - d.h;
      const fs = Math.min(13, s * 0.3);
      ctx.font = `700 ${fs}px "Avenir Next", system-ui, "PingFang TC", sans-serif`;
      const w = ctx.measureText(lemma).width + fs * 1.2, ph = fs * 1.6, ly = cy + s * 0.42;
      ctx.fillStyle = 'rgba(255,253,248,0.94)';
      ctx.beginPath(); ctx.roundRect(d.x - w / 2, ly - ph / 2, w, ph, ph / 2); ctx.fill();
      ctx.fillStyle = INK;
      ctx.fillText(lemma, d.x, ly);
    }
  }

  // 格子上用的圖示：基元圖示的第一個部分（組合圖示太小看不清）
  function emojiOf(lang, lemma) {
    const spec = lang.coreByKey?.get(lemma)?.icon || lang.base[lemma];
    return spec?.icon ? spec.icon.replace(/[*]/g, '').split(/[+>|]/)[0] : '';
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
    $('#bagCount').textContent = `${lg.backpack.length} 格`;
    $('#bagList').innerHTML = lg.backpack.length
      ? lg.backpack.map(l => `<button class="bag-item${selected === l ? ' sel' : ''}" data-l="${esc(l)}">${emojiOf(lang, l)} ${esc(l)}</button>`).join('')
      : '<span class="muted" style="padding:8px 4px">箱子是空的。去冒險唸出來，通過的字會放進箱子。</span>';
    root.querySelectorAll('[data-l]').forEach(b => (b.onclick = () => {
      const l = b.dataset.l;
      selected = selected === l ? null : l;
      if (selected) speak(l, { rate: 0.85 });
      focus = null;
      rebuild();
    }));
    $('#hint').textContent = selected ? (T.count() ? `把「${selected}」放到虛線的位置（要和已經有的格子相鄰）` : '第一格一定是「我」：先讓「我」通過') : '';
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
    const k = Math.min(1.7, Math.max(0.15, Math.min((W || 360) / spanX, ((H || 500) - 160) / spanY)));
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
    const lg = L(), k = (!selected && pickTile(sx, sy)) || screenToHex(sx, sy);
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
  const chip = (lang, l, attr = '') => { const ic = lang.base[l] || lang.coreByKey?.get(l)?.icon; return `<button class="mchip" ${attr}>${ic ? iconHtml(ic) + ' ' : ''}${esc(l)}</button>`; };
  const mineHtml = (lang, parts) => `<div class="mine">${parts.map(p => chip(lang, p, 'disabled')).join('<i>＋</i>')}</div>`;

  function tileSheet(k) {
    const lang = getLang(), lg = L(), lemma = lg.territory[k], rec = lg.words[lemma] || {};
    const icon = lang.coreByKey?.get(lemma)?.icon || lang.base[lemma];
    const sg = P.wordSegs(lang.id, lemma);
    const scores = (rec.tries || []).map(x => x.total);
    openSheet(`
      <h2>${icon ? iconHtml(icon) + ' ' : ''}${esc(lemma)}</h2>
      ${sg ? `<p class="ipa big">/${sg.map(esc).join('')}/</p>` : ''}
      <p class="muted">${scores.length ? `唸過 ${scores.length} 次，最高 ${Math.max(...scores)} 分` : ''}</p>
      <button class="btn ghost big" id="say">${G.speaker()} 聽</button>`, { onClose: () => { focus = null; redraw(); } }, body => {
      body.querySelector('#say').onclick = () => speak(lemma, { rate: 0.8 });
    });
  }

  function composeSheet(k) {
    const lang = getLang(), lg = L(), lemma = lg.territory[k], w = word(lemma);
    let parts = [...(w.mine?.at(-1)?.parts || [])], filter = '';
    // 材料：學過（Lv2 以上）的其他字；NSM 基元排前面
    const materials = Object.entries(lg.words).filter(([l, x]) => x.lv >= 2 && l !== lemma && (lang.lemmas.get(l) || lang.coreByKey?.has(l))).map(([l]) => l)
      .sort((a, b) => (lang.base[b]?.tier === 1) - (lang.base[a]?.tier === 1) || a.localeCompare(b));
    const exs = (lang.lemmas.get(lemma)?.sentences || []).slice(0, 3).map(id => joinTokens(lang.sentences[id].tokens, lang.joiner));
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
    // 從結算畫面直接寫「我的理解」
    compose(lemma) { const k = T.cellOf(lemma); if (k) composeSheet(k); },
  };
}
