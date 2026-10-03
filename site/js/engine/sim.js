// 模擬模式：用真實的遊戲引擎自動玩若干局（答對率 85%），產生測試用的進度
import { state, save, L } from './store.js';
import * as R from './run.js';
import * as T from './territory.js';

export const PRESETS = {
  start: { name: '剛開始', runs: 2, unlock: 0, desc: '玩過 2 局，還沒有解鎖規則' },
  mid: { name: 'A1 中段', runs: 8, unlock: 4, desc: '玩過 8 局，解鎖 4 條規則' },
  late: { name: 'A1 後段', runs: 20, unlock: 'A1', desc: '玩過 20 局，解鎖全部 A1 規則' },
};

// 來源裡出現最多次的規則優先解鎖，連鎖才有句子可以跳
function rulesToUnlock(lang, n) {
  const prof = R.profileOf(lang);
  const a1 = R.WALS.filter(r => r.stage === 'A1');
  if (n === 'A1') return a1.map(r => r.id);
  const count = r => Object.values(lang.sentences).filter(s => r.test(s.tokens, prof)).length;
  return a1.map(r => [r.id, count(r)]).sort((a, b) => b[1] - a[1]).slice(0, n).map(([id]) => id);
}

export function generate(req, getLang) {
  const p = PRESETS[req.preset] || PRESETS.mid;
  Object.assign(state, { lang: req.lang, env: 'ear', sound: true, timeOffset: 0, langs: {}, known: req.known?.length ? req.known : ['mnd'],
    sim: { preset: req.preset, autoSkills: !!req.autoSkills } });
  const lang = getLang();
  L().unlocked = rulesToUnlock(lang, p.unlock);
  for (let r = 0; r < p.runs; r++) {
    const run = R.buildRun(lang, lang.sources[0].id, 'ear');
    while (R.current(run)) {
      const q = R.makeQuestion(run, R.current(run));
      const ok = Math.random() < 0.85;
      R.answer(run, q, q.mode === 'pick' ? (ok ? q.answer[0] : '') : q.mode === 'order' ? (ok ? q.answer : []) : (ok ? q.answerText : ''), { timeLeft: 0.5 });
      if (run.pendingChoice) { const c = R.choices(run); c.length ? R.choose(run, c[0]) : (run.pendingChoice = false); }
    }
    R.settle(run);
    // 背包留 3 個給使用者自己擺，其餘放到領土邊緣
    const keep = r === p.runs - 1 ? 3 : 0;
    for (const l of L().backpack.slice(keep)) T.place(l, T.placeable()[(Math.random() * 3) | 0] || T.placeable()[0]);
  }
  save();
}
