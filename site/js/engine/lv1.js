// 最小可行模型（docs/design.md）：65 個基元的第一級。
// 看圖示和字、點一下聽發音 → 自己唸出來 → 發音評分服務每個音都評分，得到總分 →
// 一局 5 個字，每個字輪流練 3 次；取最高的兩次平均，70 分以上就通過 → 放進箱子，在外層擺上領土。
import { L, save, now } from './store.js';

export const WORDS_PER_RUN = 5, ROUNDS = 3, PASS = 70;
// 第一格一定是「我」（第一人稱）
export const FIRST = 'I';

const rec = key => (L().words[key] ||= { tries: [] });
export const passed = key => !!L().words[key]?.passed;
export const firstKey = lang => lang.core.find(p => p.id === FIRST)?.key;
// 一個字的成績：最高的兩次平均
export const best2 = scores => { const s = [...scores].sort((a, b) => b - a).slice(0, 2); return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : 0; };

// 一局：照基元的順序，取 5 個還沒通過的字；每個字輪流出 3 次（不連續出同一個字）
export function startRun(lang) {
  const words = lang.core.filter(p => !passed(p.key)).slice(0, WORDS_PER_RUN);
  const queue = [];
  for (let r = 0; r < ROUNDS; r++) for (const p of words) queue.push(p.key);
  return { lang, words: words.map(p => p.key), queue, pos: 0, scores: Object.fromEntries(words.map(p => [p.key, []])) };
}
export const current = run => run.queue[run.pos] || null;
export const prime = (run, key) => run.lang.coreByKey.get(key);

// 記一次的總分，換下一題
export function record(run, key, total) {
  run.scores[key].push(total);
  const r = rec(key);
  r.tries = [...r.tries, { t: now(), total }].slice(-30);
  run.pos++;
  save();
}

// 結算：每個字取最高的兩次平均，70 分以上通過；通過的字放進箱子（「我」直接放在中心，成為第一格）
export function finish(run) {
  const lg = L(), result = [];
  for (const key of run.words) {
    const sc = run.scores[key], score = best2(sc), ok = sc.length >= 2 && score >= PASS;
    result.push({ key, scores: sc, score, ok });
    if (!ok || passed(key)) continue;
    rec(key).passed = now();
    if (key === firstKey(run.lang) && !Object.keys(lg.territory).length) lg.territory['0,0'] = key;
    else if (!lg.backpack.includes(key)) lg.backpack.push(key);
  }
  save();
  return result;
}
