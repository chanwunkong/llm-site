// 主程式：語言切換、分頁、頂部列、設定
import en from './data/en.js';
import ja from './data/ja.js';
import { buildLanguage } from './engine/content.js';
import { BASE } from './data/base.js';
import { LANG_LIST, LANG_BY_ID } from './data/langs.js';
import { importsOf } from './engine/importer.js';
import { state, save, L, applyDecay, skipDay, resetAll, SIM, SHOW, enterSim, exitSim, takeSimRequest } from './engine/store.js';
import { PRESETS, generate } from './engine/sim.js';
import { syncUnlocks } from './engine/run.js';
import { LANGS } from './data/wals.js';
import { esc } from './ui/sheet.js';
import * as T from './engine/territory.js';
import { setVoiceLang, speak } from './audio.js';
import { createHome } from './ui/home.js';
import { createPlay } from './ui/play.js';
import { createLand } from './ui/land.js';
import { createSkills } from './ui/skills.js';
import { createSounds } from './ui/sounds.js';
import { openSheet, closeSheet, toast } from './ui/sheet.js';

// 內建示範來源的語言（英文、日文）；20 種語言都可以匯入自己的文章
const BUILTIN = { en, ja };
const dataOf = id => ({ ...LANG_BY_ID[id], ...(BUILTIN[id] || {}), id, sources: [...(BUILTIN[id]?.sources || []), ...importsOf(id)] });
const DATA = Object.fromEntries(LANG_LIST.map(l => [l.id, l]));
const built = {};
const getLang = () => (built[state.lang] ||= buildLanguage(dataOf(state.lang), BASE[state.lang] || {}));
const rebuildLang = () => { delete built[state.lang]; };
const $ = s => document.querySelector(s);

// 模擬模式：進入時依選的預設產生進度；頂部顯示「模擬中」與退出
const simReq = takeSimRequest();
if (simReq) generate(simReq, getLang);
if (SIM) {
  $('#simBar').hidden = false;
  $('#simExit').onclick = exitSim;
}

function refreshTop() {
  $('#gold').textContent = L().gold;
  $('#tileCount').textContent = T.count();
  $('#langBtn').textContent = DATA[state.lang].name;
}

const views = {
  home: createHome($('#view-home'), { getLang, onStart: (src, env) => play.start(getLang(), src, env), onSourcesChanged: () => { rebuildLang(); refreshTop(); } }),
  land: createLand($('#view-land'), { getLang, onChange: refreshTop }),
  skills: createSkills($('#view-skills'), { getLang, onChange: refreshTop }),
  sounds: createSounds($('#view-sounds'), { getLang }),
};
const play = createPlay($('#play'), { onEnd: tab => { refreshTop(); setTab(tab); }, onSound: seg => views.sounds.detail(seg) });

// 收斂後的主選單只有「領土」和「冒險」；文法頁、發音頁與金幣先不顯示
if (!SHOW.skillsTab) $('#nav [data-tab="skills"]').remove();
if (!SHOW.soundsTab) $('#nav [data-tab="sounds"]').remove();
if (!SHOW.economy) $('#gold').parentElement.hidden = true;

let tab = null;
function setTab(t) {
  if (tab && tab !== t) views[tab].hide();
  tab = t;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${t}`));
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
  views[t].show();
  refreshTop();
}
document.querySelectorAll('#nav button').forEach(b => (b.onclick = () => setTab(b.dataset.tab)));

function enterLanguage() {
  setVoiceLang(DATA[state.lang].bcp47);
  getLang();
  T.receive([]);          // 背包關閉時，把舊存檔背包裡的字放到領土上
  syncUnlocks(getLang());
  const dropped = applyDecay();
  if (dropped.length) toast(`${dropped.length} 個字因為太久沒練而降級`, 2600);
  refreshTop();
}

$('#langBtn').onclick = () => openSheet(`<h2>學習語言</h2>
  <p class="muted">每個語言有各自的領土與進度。英語、日語有內建的示範文章；其他語言請在「冒險」匯入自己的文章。</p>
  <div class="lang-grid">${LANG_LIST.map(d => {
    const n = dataOf(d.id).sources.length;
    return `<button class="btn ${d.id === state.lang ? 'gold' : 'ghost'} sm" data-lang="${d.id}">${esc(d.name)}<small class="lang-n">${esc(d.zh)}${n ? `・${n} 篇` : ''}</small></button>`;
  }).join('')}</div>`, {}, body =>
  body.querySelectorAll('[data-lang]').forEach(b => (b.onclick = () => {
    state.lang = b.dataset.lang;
    save();
    closeSheet();
    enterLanguage();
    views[tab].hide();
    setTab(tab);
  })));

$('#setBtn').onclick = () => openSheet(`<h2>設定</h2><div class="stack">
    <button class="btn ghost big" id="snd">${state.sound ? '聲音：開' : '聲音：關'}</button>
    <button class="btn ghost big" id="sim">${SIM ? '重新產生模擬進度' : '模擬模式（測試用）'}</button>
    <button class="btn ghost big" id="day">時間快轉 1 天（測試降級用）</button>
    <button class="btn ghost big" id="rst">${SIM ? '重置模擬進度' : '重置所有進度'}</button>
  </div><p class="muted">學習資料是依《小王子》劇情自行改寫的範例，詞性與詞元為人工標註。</p>`, {}, body => {
  body.querySelector('#snd').onclick = () => { state.sound = !state.sound; save(); closeSheet(); if (state.sound) speak(' '); };
  body.querySelector('#sim').onclick = simSheet;
  body.querySelector('#day').onclick = () => { skipDay(); closeSheet(); enterLanguage(); views[tab].hide(); setTab(tab); toast('已快轉 1 天'); };
  body.querySelector('#rst').onclick = () => openSheet(`<h2>確定重置？</h2><p class="muted">所有語言的單字、領土、金幣都會清除。</p>
    <div class="row"><button class="btn ghost big" id="no">取消</button><button class="btn gold big" id="yes">重置</button></div>`, {}, b2 => {
    b2.querySelector('#no').onclick = closeSheet;
    b2.querySelector('#yes').onclick = () => { resetAll(); closeSheet(); views[tab].hide(); setTab('home'); };
  });
});

enterLanguage();
const h = location.hash.slice(1);
setTab(views[h] ? h : 'home');
if (h === 'play' && getLang().sources.length) play.start(getLang(), L().source || getLang().sources[0].id, state.env);
$('#loading').remove();

// 模擬模式設定：預設進度、目標語言、我會的語言、開局自帶規則
function simSheet() {
  const req = { preset: state.sim?.preset || 'mid', lang: state.lang, known: [...(state.known || ['mnd'])], autoSkills: state.sim?.autoSkills ?? true };
  const draw = body => {
    body.innerHTML = `<h2>模擬模式</h2>
      <p class="muted">用遊戲引擎自動玩若干局（答對率 85%），產生測試用的進度。使用另一份存檔，真正的進度不會被覆蓋；頂部的「退出」回到真正的進度。</p>
      <h3>預設進度</h3><div class="stack">${Object.entries(PRESETS).map(([k, p]) =>
        `<button class="choice${req.preset === k ? ' sel' : ''}" data-p="${k}"><span class="ic">${p.runs}局</span><b>${p.name}</b><small>${p.desc}</small></button>`).join('')}</div>
      <h3>目標語言</h3><div class="row">${Object.values(BUILTIN).map(d => `<button class="btn ${req.lang === d.id ? 'gold' : 'ghost'} sm" data-l="${d.id}">${d.name}</button>`).join('')}</div>
      <h3>我會的語言</h3><div class="lang-grid">${LANGS.map(l => `<button class="btn ${req.known.includes(l.id) ? 'gold' : 'ghost'} sm" data-k="${l.id}">${esc(l.zh)}</button>`).join('')}</div>
      <h3>測試連鎖</h3><button class="btn ${req.autoSkills ? 'gold' : 'ghost'} sm" id="auto">${req.autoSkills ? '開' : '關'}：開局自帶所有已解鎖的規則（Lv1）</button>
      <button class="btn gold big" id="simGo" style="margin-top:16px">開始模擬</button>`;
    body.querySelectorAll('[data-p]').forEach(b => (b.onclick = () => { req.preset = b.dataset.p; draw(body); }));
    body.querySelectorAll('[data-l]').forEach(b => (b.onclick = () => { req.lang = b.dataset.l; draw(body); }));
    body.querySelectorAll('[data-k]').forEach(b => (b.onclick = () => {
      const id = b.dataset.k;
      req.known = req.known.includes(id) ? req.known.filter(x => x !== id) : [...req.known, id];
      draw(body);
    }));
    body.querySelector('#auto').onclick = () => { req.autoSkills = !req.autoSkills; draw(body); };
    body.querySelector('#simGo').onclick = () => { body.querySelector('#simGo').textContent = '產生中…'; enterSim(req); };
  };
  openSheet('', {}, draw);
}
