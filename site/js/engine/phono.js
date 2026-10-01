// 發音：我會的音、難音、最小對立詞（只差一個音的字）、拼字相近的字
// 音位清單來自 PHOIBLE，字的發音由 eSpeak NG／pyopenjtalk 產生（見 data/phonology/）。邏輯不含任何語言專屬規則。
import { INVENTORIES, WORD_IPA, SEGMENT_CLASS } from '../data/phonology.js';
import { state, save, known } from './store.js';

// 比較用：去掉長音與附加符號，保留送氣 ʰ、顎化 ʲ 等會區分意思的記號（與 build_phonology.py 的 norm 一致）
export const norm = s => s.normalize('NFD').replace(/\p{Mn}/gu, '').replace(/[ː|]/g, '');
export const segClass = s => SEGMENT_CLASS[s] || '';

export const inventory = wals => INVENTORIES[wals] || [];

// 學習者逐音標記：true = 我會、false = 不會（蓋過「我會的語言」的預設）
const marks = () => (state.soundMarks ||= {});
export function setMark(seg, val) {
  const m = marks(), k = norm(seg);
  if (val === null) delete m[k]; else m[k] = val;
  save();
}
export const markOf = seg => marks()[norm(seg)];

export function knownSet(target) {
  const out = new Set();
  for (const id of known()) if (id !== target) for (const s of inventory(id)) out.add(norm(s));
  return out;
}

// 'known' 已經會、'hard' 難音（目標語言有，但我會的語言都沒有）
export function soundStatus(seg, target, ks = knownSet(target)) {
  const m = markOf(seg);
  if (m === true) return 'known';
  if (m === false) return 'hard';
  return ks.has(norm(seg)) ? 'known' : 'hard';
}
export function hardSounds(target) {
  const ks = knownSet(target);
  return new Set(inventory(target).filter(s => soundStatus(s, target, ks) === 'hard'));
}

export function wordSegs(langId, surface) {
  const w = WORD_IPA[langId] || {};
  return w[surface] || w[surface.toLowerCase()] || null;
}
export const ipaOf = (langId, surface) => (wordSegs(langId, surface) || []).join('');

// 只差一個音（替換一個音位）的字；involves 標出差異的那兩個音
export function minimalPairs(langId, surface, candidates) {
  const a = wordSegs(langId, surface);
  if (!a) return [];
  const out = [];
  for (const c of candidates) {
    const b = wordSegs(langId, c);
    if (!b || b.length !== a.length || c.toLowerCase() === surface.toLowerCase()) continue;
    const diff = a.map((x, i) => (x === b[i] ? -1 : i)).filter(i => i >= 0);
    if (diff.length === 1) out.push({ word: c, involves: [a[diff[0]], b[diff[0]]] });
  }
  return out;
}

export function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
// 拼字相近：至少兩個字元、有共同的字元，且編輯距離不超過字長的三分之一（至少 1）
export function spellingNeighbors(surface, candidates) {
  const s = surface.toLowerCase(), max = Math.max(1, Math.floor(s.length / 3));
  if ([...s].length < 2) return [];
  return candidates.filter(c => {
    const t = c.toLowerCase();
    return t !== s && [...t].length >= 2 && [...t].some(ch => s.includes(ch)) && editDistance(s, t) <= max;
  });
}
