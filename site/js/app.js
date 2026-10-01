// 主程式：語言切換、分頁、頂部列、設定
import en from './data/en.js';
import ja from './data/ja.js';
import { buildLanguage } from './engine/content.js';
import { BASE } from './data/base.js';
import { state, save, L, applyDecay, skipDay, resetAll } from './engine/store.js';
import * as T from './engine/territory.js';
import { setVoiceLang, speak } from './audio.js';
import { createHome } from './ui/home.js';
import { createPlay } from './ui/play.js';
import { createLand } from './ui/land.js';
import { createSkills } from './ui/skills.js';
import { openSheet, closeSheet, toast } from './ui/sheet.js';

const DATA = { en, ja };
const built = {};
const getLang = () => (built[state.lang] ||= buildLanguage(DATA[state.lang], BASE[state.lang]));
const $ = s => document.querySelector(s);

function refreshTop() {
  $('#gold').textContent = L().gold;
  $('#tileCount').textContent = T.count();
  $('#langBtn').textContent = DATA[state.lang].name;
}

const views = {
  home: createHome($('#view-home'), { getLang, onStart: (src, env) => play.start(getLang(), src, env) }),
  land: createLand($('#view-land'), { getLang, onChange: refreshTop }),
  skills: createSkills($('#view-skills'), { getLang, onChange: refreshTop }),
};
const play = createPlay($('#play'), { onEnd: tab => { refreshTop(); setTab(tab); } });

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
  const dropped = applyDecay();
  if (dropped.length) toast(`⬇ ${dropped.length} 個字因為太久沒練而降級`, 2600);
  refreshTop();
}

$('#langBtn').onclick = () => openSheet(`<h2>學習語言</h2><div class="stack">${Object.values(DATA).map(d =>
  `<button class="btn ${d.id === state.lang ? 'gold' : 'ghost'} big" data-lang="${d.id}">${d.name}</button>`).join('')}</div>
  <p class="muted">每個語言有各自的領土、背包、金幣與進度。</p>`, {}, body =>
  body.querySelectorAll('[data-lang]').forEach(b => (b.onclick = () => {
    state.lang = b.dataset.lang;
    save();
    closeSheet();
    enterLanguage();
    views[tab].hide();
    setTab(tab);
  })));

$('#setBtn').onclick = () => openSheet(`<h2>設定</h2><div class="stack">
    <button class="btn ghost big" id="snd">${state.sound ? '🔊 聲音：開' : '🔇 聲音：關'}</button>
    <button class="btn ghost big" id="day">⏩ 時間快轉 1 天（測試降級用）</button>
    <button class="btn ghost big" id="rst">🗑 重置所有進度</button>
  </div><p class="muted">學習資料是依《小王子》劇情自行改寫的範例，詞性與詞元為人工標註。</p>`, {}, body => {
  body.querySelector('#snd').onclick = () => { state.sound = !state.sound; save(); closeSheet(); if (state.sound) speak(' '); };
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
if (h === 'play') play.start(getLang(), L().source || getLang().sources[0].id, state.env);
$('#loading').remove();
