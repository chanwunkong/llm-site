// 單字領土：low poly 3D 方格、拖曳平移、雙指縮放、背包擺放、付費移動
import * as THREE from 'three';
import { Scene3D } from './scene.js';
import * as LP from './lowpoly.js';
import { L, word, RULES, isDue, decayProgress } from '../engine/store.js';
import * as T from '../engine/territory.js';
import { speak, sfx } from '../audio.js';
import { openSheet, closeSheet, toast, esc, stars } from './sheet.js';

export function createLand(root, { getLang, onChange }) {
  root.innerHTML = `
    <div class="land3d" id="land3d"><div class="labels" id="labels"></div></div>
    <div class="land-top">
      <span class="chip" id="stat"></span>
      <button class="chip" id="missedBtn">🔗 錯過的連結</button>
      <button class="chip" id="chunkBtn">🧱 語塊</button>
    </div>
    <div class="land-tools">
      <button class="icon-btn" id="zin" aria-label="放大">＋</button>
      <button class="icon-btn" id="zout" aria-label="縮小">－</button>
      <button class="icon-btn" id="home" aria-label="回到中心">🎯</button>
    </div>
    <div class="bag">
      <div class="hint-line" id="hint"></div>
      <div class="bag-head"><span><b>🎒 背包</b> <span id="bagCount"></span></span><span>點字，再點發光的空地</span></div>
      <div class="bag-list" id="bagList"></div>
    </div>`;
  const $ = s => root.querySelector(s);
  const box = $('#land3d'), labelsEl = $('#labels');
  const s3 = new Scene3D(box);
  const sc = s3.scene;
  LP.lights(sc, { ext: 14 });
  const cam = (s3.camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 200));
  const target = new THREE.Vector3();
  const OFFSET = new THREE.Vector3(0, 12, 9);
  const HALF = 4.5;
  let zoom = 1;

  const tilesG = new THREE.Group(), linksG = new THREE.Group(), ghostsG = new THREE.Group();
  sc.add(tilesG, linksG, ghostsG);
  const ghostMat = new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.35 });
  const selRing = new THREE.Mesh(new THREE.BoxGeometry(1, 0.04, 1), new THREE.MeshBasicMaterial({ color: '#ffcf4a', transparent: true, opacity: 0.6 }));
  selRing.visible = false;
  sc.add(selRing);

  let selected = null;       // 背包中選中的詞元
  let focus = null;          // 領土上選中的格子
  let labels = [];

  // ---------- 相機 ----------
  function updateCamera() {
    const a = (s3.w || 1) / (s3.h || 1);
    Object.assign(cam, { left: -HALF * a, right: HALF * a, top: HALF, bottom: -HALF, zoom });
    cam.position.copy(target).add(OFFSET);
    cam.lookAt(target);
    cam.updateProjectionMatrix();
  }
  s3.onResize = updateCamera;

  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.05);
  function groundAt(cx, cy) {
    const r = box.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), cam);
    return ray.ray.intersectPlane(plane, new THREE.Vector3());
  }

  // ---------- 建立場景 ----------
  function rebuild() {
    const lang = getLang(), lg = L();
    for (const g of [tilesG, linksG, ghostsG]) { g.traverse(o => o !== g && o.geometry?.dispose()); g.clear(); }
    labelsEl.innerHTML = '';
    labels = [];
    for (const [k, lemma] of Object.entries(lg.territory)) {
      const [x, y] = T.parse(k), w = word(lemma);
      const t = LP.tile(w.lv, isDue(w));
      t.position.set(x, 0, y);
      t.userData.cell = k;
      tilesG.add(t);
      const el = document.createElement('div');
      el.className = 'tl' + (focus === k ? ' sel' : '');
      el.textContent = lemma;
      labelsEl.appendChild(el);
      labels.push({ el, pos: new THREE.Vector3(x, 0.25 + (w.lv >= 4 ? 0.1 : 0), y + 0.28) });
    }
    // 完成的語塊：格子之間的金色通道
    for (const c of lang.chunks.filter(T.chunkComplete)) {
      const cells = c.lemmas.map(l => T.parse(T.cellOf(l)));
      for (let i = 0; i + 1 < cells.length; i++) {
        const [ax, ay] = cells[i], [bx, by] = cells[i + 1];
        const bar = LP.mesh(new THREE.BoxGeometry(ax === bx ? 0.16 : 1, 0.06, ax === bx ? 1 : 0.16), '#ffcf4a', { emissive: '#b37a00', emissiveIntensity: 0.6 }, false);
        bar.position.set((ax + bx) / 2, 0.07, (ay + by) / 2);
        linksG.add(bar);
      }
    }
    if (selected) for (const k of T.placeable()) {
      const [x, y] = T.parse(k);
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.06, 0.86), ghostMat);
      g.position.set(x, 0, y);
      ghostsG.add(g);
    }
    selRing.visible = !!focus && !!lg.territory[focus];
    if (selRing.visible) { const [x, y] = T.parse(focus); selRing.position.set(x, 0.1, y); }
    renderUI();
  }

  function renderUI() {
    const lang = getLang(), lg = L();
    const done = lang.chunks.filter(T.chunkComplete).length;
    const biggest = Math.max(0, ...T.chunkNetworks(lang.chunks).map(n => n.length));
    const due = Object.values(lg.territory).filter(l => isDue(word(l))).length;
    $('#stat').textContent = `🧩 ${T.count()} 格　🧱 ${done}/${lang.chunks.length} 語塊${biggest > 1 ? `　🕸 最大網絡 ${biggest}` : ''}${due ? `　⚠️ ${due} 格快降級` : ''}`;
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
    $('#hint').textContent = selected ? `把「${selected}」放到發光的格子上（和常一起出現的字放在一起，得分更高）` : '';
    onChange?.();
  }

  // ---------- 標籤：放大時顯示文字，縮小時變成色點 ----------
  s3.onFrame = () => {
    const ppu = (s3.h / (HALF * 2)) * zoom;
    const show = ppu > 34;
    labelsEl.style.display = show ? '' : 'none';
    if (show) for (const { el, pos } of labels) {
      const [x, y] = s3.toScreen(pos);
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }
    ghostsG.children.forEach(g => (g.material.opacity = 0.25 + Math.sin(performance.now() / 250) * 0.12));
  };

  // ---------- 操作：拖曳平移、雙指縮放、點擊 ----------
  const pts = new Map();
  let moved = false, pinch0 = 0, zoom0 = 1, downAt = null;
  box.addEventListener('pointerdown', e => {
    box.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { moved = false; downAt = { x: e.clientX, y: e.clientY }; }
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = zoom; moved = true; }
  });
  box.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    if (pts.size === 1) {
      if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8) moved = true;
      if (moved) {
        const a = groundAt(p.x, p.y), b = groundAt(e.clientX, e.clientY);
        if (a && b) { target.add(a.sub(b)); updateCamera(); }
      }
    }
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      zoom = THREE.MathUtils.clamp(zoom0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch0, 0.15, 2.5);
      updateCamera();
    }
  });
  const up = e => {
    const wasTap = pts.size === 1 && !moved;
    pts.delete(e.pointerId);
    if (wasTap) tap(e.clientX, e.clientY);
  };
  box.addEventListener('pointerup', up);
  box.addEventListener('pointercancel', e => pts.delete(e.pointerId));
  box.addEventListener('wheel', e => { e.preventDefault(); zoom = THREE.MathUtils.clamp(zoom * (e.deltaY < 0 ? 1.12 : 0.89), 0.15, 2.5); updateCamera(); }, { passive: false });
  $('#zin').onclick = () => { zoom = Math.min(2.5, zoom * 1.3); updateCamera(); };
  $('#zout').onclick = () => { zoom = Math.max(0.15, zoom / 1.3); updateCamera(); };
  $('#home').onclick = () => fitAll();

  function fitAll() {
    const ks = Object.keys(L().territory).map(T.parse);
    if (!ks.length) { target.set(0, 0, 0); zoom = 1; return updateCamera(); }
    const xs = ks.map(k => k[0]), ys = ks.map(k => k[1]);
    target.set((Math.min(...xs) + Math.max(...xs)) / 2, 0, (Math.min(...ys) + Math.max(...ys)) / 2);
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) + 3;
    zoom = THREE.MathUtils.clamp((HALF * 2) / span, 0.15, 1.3);
    updateCamera();
  }
  function lookAtCell(k) {
    const [x, y] = T.parse(k);
    target.set(x, 0, y);
    zoom = Math.max(zoom, 1);
    updateCamera();
  }

  function tap(cx, cy) {
    const p = groundAt(cx, cy);
    if (!p) return;
    const k = T.key(Math.round(p.x), Math.round(p.z));
    const lg = L();
    if (selected) {
      if (T.place(selected, k)) {
        sfx('place');
        const done = getLang().chunks.filter(c => c.lemmas.includes(selected) && T.chunkComplete(c));
        if (done.length) { sfx('coin'); toast(`🧱 完成語塊：${done.map(c => c.lemmas.join('＋')).join('、')}`); }
        selected = null;
        focus = k;
        rebuild();
      } else if (!lg.territory[k]) toast('只能放在發光的格子上（領土要相連）');
      return;
    }
    if (lg.territory[k]) { focus = k; rebuild(); tileSheet(k); }
    else if (focus) { focus = null; rebuild(); }
  }

  // ---------- 格子資訊 ----------
  function tileSheet(k) {
    const lang = getLang(), lg = L(), lemma = lg.territory[k], w = word(lemma);
    const info = lang.lemmas.get(lemma);
    const days = RULES.decayDays[w.lv];
    const status = w.lv === 5 ? '5 級：不會因時間降級，但會被隨機抽查'
      : days ? `${isDue(w) ? '⚠️ 快要降級，' : ''}${Math.max(0, Math.ceil(days * (1 - decayProgress(w))))} 天內沒練習會降到 Lv${w.lv - 1}` : '';
    const chunks = lang.chunks.filter(c => c.lemmas.includes(lemma));
    openSheet(`
      <h2>${esc(lemma)} <span class="stars">${stars(w.lv)}</span></h2>
      <p class="muted">Lv${w.lv}　熟練度 ${w.prof} / ${RULES.threshold}　答對 ${w.correct} 次<br>${status}<br>寫法：${[...info.forms].map(esc).join('、')}</p>
      ${chunks.length ? `<h3>相關語塊</h3><div class="chips">${chunks.map(c => `<span>${T.chunkComplete(c) ? '✅' : '⬜'} ${esc(c.lemmas.join('＋'))}</span>`).join('')}</div>` : ''}
      <div class="row" style="margin-top:16px">
        <button class="btn ghost big" id="say">🔊 發音</button>
        <button class="btn gold big" id="lift">拿起移動（🪙${RULES.moveCost}）</button>
      </div>`, { onClose: () => { focus = null; rebuild(); } }, body => {
      body.querySelector('#say').onclick = () => speak(lemma, { rate: 0.85 });
      body.querySelector('#lift').onclick = () => {
        const r = T.pickUp(k);
        if (!r.ok) return toast(r.reason);
        sfx('coin');
        selected = lemma;
        focus = null;
        closeSheet();
        rebuild();
        toast(`已拿起「${lemma}」，點發光的格子放下`);
      };
    });
  }

  $('#missedBtn').onclick = () => {
    const m = L().lastReport?.missed || [];
    openSheet(`<h2>🔗 錯過的連結</h2>
      <p class="muted">上一局一起出現、但在領土上離得很遠的字。把它們放近一點，下一局的路徑加成會更高。</p>
      <div class="stack">${m.length ? m.map((x, i) => `<button class="btn ghost" data-i="${i}">${esc(x.a)} ↔ ${esc(x.b)}　（${x.steps} 步）</button>`).join('') : '<p class="muted">目前沒有。</p>'}</div>`,
      {}, body => body.querySelectorAll('[data-i]').forEach(b => (b.onclick = () => { closeSheet(); lookAtCell(T.cellOf(m[+b.dataset.i].a)); })));
  };
  $('#chunkBtn').onclick = () => {
    const lang = getLang(), lg = L();
    const known = l => T.cellOf(l) || lg.backpack.includes(l);
    const list = lang.chunks.filter(c => c.lemmas.every(known));
    openSheet(`<h2>🧱 語塊</h2>
      <p class="muted">來源裡經常一起出現的字。把它們依序相鄰擺好就完成語塊，每局結算時產出金幣（等級越高產越多）。
      共用同一格的語塊會連成網絡，網絡裡的語塊越多，產出加成越高（每多一個 +25%）。這裡只列出你已經學過的語塊。</p>
      ${T.chunkNetworks(lang.chunks).filter(n => n.length > 1).map(n => `<p class="muted">🕸 網絡 ×${1 + T.NETWORK_BONUS * (n.length - 1)}：${n.map(c => esc(c.lemmas.join('＋'))).join(' · ')}</p>`).join('')}
      <div class="stack">${list.length ? list.map(c => `<div class="btn ghost" style="text-align:left">${T.chunkComplete(c) ? '✅' : '⬜'} ${esc(c.lemmas.join(' ＋ '))}<small class="muted">　出現 ${c.count} 次</small></div>`).join('') : '<p class="muted">還沒有。繼續練習來源裡的字吧。</p>'}</div>`);
  };

  return {
    show() { rebuild(); if (!labels.length || !s3.running) fitAll(); s3.start(); },
    hide() { s3.stop(); selected = null; focus = null; },
    rebuild,
  };
}
