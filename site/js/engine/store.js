// 存檔與單字狀態。每個學習語言各自有單字、領土、背包、金幣與進度。
import { STAGES } from '../data/wals.js';

const KEY = 'word-territory-v1';
const DAY = 86400000;

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
