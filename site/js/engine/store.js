// 存檔與單字狀態。每個學習語言各自有單字、領土、背包、金幣與進度。
import { STAGES } from '../data/wals.js';

// 模擬模式用另一份存檔，真正的進度不會被覆蓋
const MODE_KEY = 'word-territory-mode', SIM_REQ = 'word-territory-sim-req';
export const SIM = (() => { try { return localStorage.getItem(MODE_KEY) === 'sim'; } catch { return false; } })();
const KEY = SIM ? 'word-territory-sim' : 'word-territory-v1';
export function enterSim(req) {
  try { localStorage.setItem(MODE_KEY, 'sim'); localStorage.setItem(SIM_REQ, JSON.stringify(req)); } catch {}
  location.reload();
}
export function exitSim() {
  try { localStorage.setItem(MODE_KEY, 'real'); localStorage.removeItem(SIM_REQ); } catch {}
  location.reload();
}
export function takeSimRequest() {
  try { const r = JSON.parse(localStorage.getItem(SIM_REQ)); localStorage.removeItem(SIM_REQ); return SIM ? r : null; } catch { return null; }
}
const DAY = 86400000;

// 收斂後的核心循環：答題 → 升級 → 連鎖 → 領土長大。以下功能的程式保留，先不顯示（true = 打開）
export const SHOW = {
  rulePurchase: false, // 花金幣解鎖規則（不再開放：規則依詞彙量自動開放）
  backpack: false,     // 背包介面（不再開放：新字自動放在領土邊緣）
  skillsTab: false,    // 階段 1：文法頁
  soundsTab: true,     // 發音頁（IPA 表）：從一開始就開放
  move: false,         // 階段 3：手動移動格子
  path: false,         // 階段 3：路徑加成、錯過的連結
  gold: false,         // 階段 4：金幣（移動格子要付金幣）
  chunks: false,       // 階段 4：領土語塊與產出
  mine: true,          // 我的理解（合成詞註解）：從一開始就開放
};

// 逐步開放：每個語言各自記錄已開放的功能（開放後不會再關閉）
export const UNLOCKS = [
  { id: 'grammar', flags: ['skillsTab'], test: lg => lg.unlocked.length >= 1, title: '文法頁',
    lines: ['你的第一條規則已經開放。', '在「文法」分頁可以看到已開放的規則。', '每條規則都和「你會的語言」比較。'] },
  { id: 'place', flags: ['move', 'path'], test: lg => Object.keys(lg.territory).length >= 20, title: '手動擺放',
    lines: ['你的領土到達 20 格。', '現在你可以移動格子：點一個格子，再點「移動」。', '常一起出現的字放在相鄰的位置，答題時得到路徑加成。', '結算時，系統顯示「錯過的連結」：常一起出現、但距離太遠的字。'] },
  { id: 'economy', flags: ['gold', 'chunks'], test: lg => Object.keys(lg.territory).length >= 40, title: '領土語塊與金幣',
    lines: ['你的領土到達 40 格。', '一個語塊的字在領土上相連時，每局結算產出金幣。', '移動格子要付金幣。'] },
];
// 檢查有沒有新開放的功能，更新 SHOW；回傳這次新開放的項目（給畫面顯示說明卡）
export function refreshFeatures() {
  const lg = L(), fresh = [];
  lg.features ||= [];
  for (const u of UNLOCKS) if (!lg.features.includes(u.id) && u.test(lg)) { lg.features.push(u.id); fresh.push(u); }
  for (const u of UNLOCKS) for (const f of u.flags) SHOW[f] = lg.features.includes(u.id);
  SHOW.mine = true;
  SHOW.soundsTab = true;
  if (fresh.length) save();
  return fresh;
}


export const RULES = {
  threshold: 4,                        // 2 級以上每級的熟練度門檻
  firstEncounterCorrect: 2,            // 1 → 2：同一局答對 2 次
  decayDays: { 2: 2, 3: 4, 4: 8 },     // 2～4 級：幾天沒練降一級；5 級改為隨機抽查
  dueRatio: 0.7,                       // 超過降級時間的 70% 視為「快要降級」
  envPoints: { speak: 3, ear: 2, mute: 1 },
  backpackSize: 10,
  moveCost: 20,
  walsCost: 100,
  completeRatio: 0.6,                  // 情境完成：60% 實詞達 3 級
  wordsPerRule: 8,                     // 規則自動開放：詞彙量每 8 個開放一條
};

function freshLang() {
  return { words: {}, territory: {}, backpack: [], gold: 0, unlocked: [], progress: {}, runs: 0, lastReport: null };
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.langs) return s;
  } catch {}
  return { lang: 'en', env: 'ear', sound: true, timeOffset: 0, langs: {}, known: ['mnd'] };
}

export const state = load();
export function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }
export function resetAll() {
  const lang = state.lang;
  Object.assign(state, { lang, env: 'ear', sound: true, timeOffset: 0, langs: {}, known: ['mnd'] });
  save();
}

export const now = () => Date.now() + (state.timeOffset || 0);
export function skipDay() { state.timeOffset = (state.timeOffset || 0) + DAY; save(); }

export function L() {
  return state.langs[state.lang] || (state.langs[state.lang] = freshLang());
}

export function word(lemma) {
  const ws = L().words;
  return ws[lemma] || (ws[lemma] = { lv: 1, prof: 0, last: 0, correct: 0, wrong: 0 });
}
export const peekWord = lemma => L().words[lemma];
export const level = lemma => L().words[lemma]?.lv || 1;

// 距離降級還剩多少比例：0 = 剛練過，1 = 已到降級時間
export function decayProgress(w) {
  const d = RULES.decayDays[w.lv];
  if (!d || !w.last) return 0;
  return Math.min(1, (now() - w.last) / (d * DAY));
}
export const isDue = w => w.lv >= 2 && w.lv <= 4 && decayProgress(w) >= RULES.dueRatio;

// 依經過時間套用降級；5 級只靠抽查降級
export function applyDecay() {
  const dropped = [];
  for (const [lemma, w] of Object.entries(L().words)) {
    while (w.lv >= 2 && w.lv <= 4 && w.last) {
      const d = RULES.decayDays[w.lv] * DAY;
      if (now() - w.last < d) break;
      w.last += d;
      w.lv--;
      w.prof = 0;
      w.decayedAt = now();
      dropped.push(lemma);
    }
  }
  if (dropped.length) save();
  return dropped;
}

// ---- 我會的語言（WALS 語言代碼，可多選）：技能頁與發音頁共用 ----
export const known = () => (state.known ||= ['mnd']);

// ---- CEFR 階段：依詞彙量（學過、Lv2 以上的字）決定 ----
export const STAGE_ORDER = Object.keys(STAGES);
export function vocabCount() { return Object.values(L().words).filter(w => w.lv >= 2).length; }
export function currentStage() {
  const v = vocabCount();
  for (let i = 0; i < STAGE_ORDER.length; i++) if (v < STAGES[STAGE_ORDER[i]].vocab) return { stage: STAGE_ORDER[i], vocab: v, next: STAGES[STAGE_ORDER[i]].vocab, index: i };
  const last = STAGE_ORDER.length - 1;
  return { stage: STAGE_ORDER[last], vocab: v, next: null, index: last };
}
export const stageReached = st => STAGE_ORDER.indexOf(st) <= currentStage().index;
