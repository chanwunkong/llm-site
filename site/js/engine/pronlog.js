// 發音紀錄（docs/design.md 8.6）：只記錄發音評分服務的結果，不存聲音。
// 一次錄音存一筆，照順序存下這個字每個音的結果；原始紀錄只留最近 2,000 筆，統計每次練習就更新、永久保留。
// 三層統計：單一的音、音的排列（位置與前後的音）、單字本身（每個位置各自的紀錄）。存在 IndexedDB。
import { norm } from './phono.js';

const NAME = 'word-territory-pron', MAX = 2000, RECENT = 10;
export const MIN_CTX = 5;   // 同一種排列至少練幾次才判斷

let dbp = null;
function db() {
  dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open(NAME, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('attempts', { keyPath: 'id', autoIncrement: true });
      r.result.createObjectStore('stats', { keyPath: 'lang' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
const done = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

// ---- 音的類別與排列 ----
const VOWELS = 'aeiouyɑɐɒæɛɜəɘɵɤɯɪʊʏøœɶɔʌɨʉɚɝ';
const isVowel = ph => !!ph && VOWELS.includes(norm(ph)[0]);
const cls = ph => (ph ? (isVowel(ph) ? 'V' : 'C') : '#');
// 排列：在字的哪裡、前後是母音或子音（# = 沒有）。子音前後接子音 = 和其他子音連在一起
export function ctxKey(phones, i) {
  const where = phones.length === 1 ? '單' : i === 0 ? '首' : i === phones.length - 1 ? '尾' : '中';
  return `${where}${cls(phones[i - 1])}${cls(phones[i + 1])}`;
}
export function ctxText(key) {
  const W = { 單: '單獨', 首: '字首', 中: '字中', 尾: '字尾' }, C = { V: '母音', C: '子音' };
  const [w, a, b] = [...key];
  return [W[w], a !== '#' && `前面是${C[a]}`, b !== '#' && `後面是${C[b]}`].filter(Boolean).join('、');
}

// ---- 統計 ----
// E：n 次數、good 對、close 接近、sum 機率總和、heard 錯的時候聽起來像哪個音、recent 最近 10 次的機率
const entry = () => ({ n: 0, good: 0, close: 0, sum: 0, heard: {}, recent: [] });
function bump(e, r) {
  e.n++;
  e.sum += r.p;
  if (r.level === 'good') e.good++;
  else {
    if (r.level === 'close') e.close++;
    const h = r.heard === '∅' ? '∅' : norm(r.heard);
    if (h !== norm(r.ph)) e.heard[h] = (e.heard[h] || 0) + 1;
  }
  e.recent = [...e.recent, r.p].slice(-RECENT);
}
export const levelOf = p => (p >= 0.6 ? 'good' : p >= 0.25 ? 'close' : 'bad');
// 顯示用：最近 5 次、最近 10 次的平均、全部的平均；最近比全部好 = 進步中
export function view(e) {
  if (!e?.n) return null;
  const avg10 = e.recent.reduce((s, x) => s + x, 0) / e.recent.length, all = e.sum / e.n;
  const like = Object.entries(e.heard).sort((a, b) => b[1] - a[1])[0];
  return { n: e.n, last5: e.recent.slice(-5).map(levelOf), avg10, all, rising: e.n > RECENT && avg10 > all + 0.05, like: like?.[0] || null, likeN: like?.[1] || 0 };
}

const blank = lang => ({ lang, phones: {}, ctx: {}, words: {} });

// 新增一筆：lang、word、phones（預期的音標，照順序）、per（服務回傳的 per_phone）
export async function add({ lang, word, phones, per }) {
  if (!per?.some(Boolean)) return;
  const d = await db(), t = d.transaction(['attempts', 'stats'], 'readwrite');
  const A = t.objectStore('attempts'), S = t.objectStore('stats');
  A.add({ t: Date.now(), lang, word, phones, heard: per.map(r => r?.heard ?? null), p: per.map(r => r?.p ?? null) });
  const st = (await done(S.get(lang))) || blank(lang);
  const w = (st.words[word] ||= { ...entry(), pos: [] });
  if (w.pos.length !== phones.length) w.pos = phones.map(ph => ({ ph, ...entry() }));
  let worst = 1;
  per.forEach((r, i) => {
    if (!r) return;
    const k = norm(r.ph);
    bump((st.phones[k] ||= entry()), r);
    bump((st.ctx[`${k}|${ctxKey(phones, i)}`] ||= entry()), r);
    bump(w.pos[i], r);
    worst = Math.min(worst, r.p);
  });
  // 單字整體：用這次最弱的那個音
  bump(w, { ph: '', heard: '', p: worst, level: levelOf(worst) });
  S.put(st);
  // 原始紀錄超過上限：刪掉最舊的（統計已經算過）
  const n = await done(A.count());
  if (n > MAX) {
    const cur = A.openCursor();
    let left = n - MAX;
    cur.onsuccess = () => { const c = cur.result; if (c && left-- > 0) { c.delete(); c.continue(); } };
  }
  await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
}

export async function stats(lang) {
  try { return (await done((await db()).transaction('stats').objectStore('stats').get(lang))) || blank(lang); } catch { return blank(lang); }
}

// 最需要注意的項目：還不夠準（平均 < 0.6）、至少練過 min 次，平均最低的排前面
export const weakest = (map, n = 3, min = 3) => Object.entries(map).filter(([, e]) => e.n >= min)
  .map(([k, e]) => [k, view(e)]).filter(([, v]) => v.all < 0.6).sort((a, b) => a[1].all - b[1].all).slice(0, n);
