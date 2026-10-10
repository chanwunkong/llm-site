// 內層：一局的出題、作答判定、計分與結算。
// 規則只依賴詞元、UD 詞性與單字等級，對任何語言都相同。
import { isContent, isTarget, isWord, isFunction, joinTokens } from './content.js';
import { L, word, save, now, RULES, isDue, decayProgress, state, SHOW, vocabCount, stageReached } from './store.js';
import * as T from './territory.js';
import { FEATURES, VALUES } from '../data/wals.js';
import * as P from './phono.js';

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pickN = (a, n) => shuffle(a.slice()).slice(0, n);

// ---- WALS 規則：以 UD 詞性與特徵找出句子裡用到規則的片段 ----
// 只依賴 UD 的通用標記，對任何語言都一樣。可計分的規則依課綱分階段（見 data/curriculum/wals-stages.json）。
const NOMINAL = ['NOUN', 'PROPN', 'PRON'];
const isNoun = t => t && (t.upos === 'NOUN' || t.upos === 'PROPN');
const pairSpans = (tk, a, b) => {
  const out = [];
  for (let i = 0; i + 1 < tk.length; i++) if ((a(tk[i]) && b(tk[i + 1])) || (b(tk[i]) && a(tk[i + 1]))) out.push([i, i + 1]);
  return out;
};
// 修飾語 X 與名詞：X 後面隔著形容詞接名詞（three small volcanoes），或名詞後面緊接 X
function modSpans(tk, isMod) {
  const out = [];
  tk.forEach((t, i) => {
    if (!isMod(t)) return;
    for (let j = i + 1; j < tk.length && j <= i + 3; j++) {
      if (isNoun(tk[j])) return out.push([i, j]);
      if (!['ADJ', 'NUM', 'DET'].includes(tk[j].upos)) break;
    }
    if (isNoun(tk[i - 1])) out.push([i - 1, i]);
  });
  return out;
}
// 介詞的方向依該語言的 WALS 85A：1 = 後置詞（箱の），2 = 前置詞（in the box），其他兩個方向都找
function adpSpans(tk, prof = {}) {
  const out = [], dir = prof['85A'];
  tk.forEach((t, i) => {
    if (t.upos !== 'ADP') return;
    if (dir !== '1') for (let j = i + 1; j < tk.length && j <= i + 3; j++) {
      if (NOMINAL.includes(tk[j].upos)) return out.push([i, j]);
      if (!['DET', 'ADJ', 'NUM'].includes(tk[j].upos)) break;
    }
    if (dir !== '2' && i > 0 && NOMINAL.includes(tk[i - 1].upos)) out.push([i - 1, i]);
  });
  return out;
}
function argVerbSpans(tk) {
  const out = [];
  for (let i = 0; i + 1 < tk.length; i++) {
    const a = tk[i].upos, b = tk[i + 1].upos, c = tk[i + 2]?.upos;
    if ((NOMINAL.includes(a) && b === 'VERB') || (a === 'VERB' && NOMINAL.includes(b))) out.push([i, i + 1]);
    else if (NOMINAL.includes(a) && b === 'ADP' && c === 'VERB') out.push([i, i + 2]);
  }
  return out;
}
const featSpans = (tk, key, val, uposes) => tk.flatMap((t, i) => (t.feats[key] === val && (!uposes || uposes.includes(t.upos)) ? [[i, i]] : []));
const featNounSpans = (tk, key, val) => modSpans(tk, t => t.feats[key] === val);

export const WALS = [
  { id: '81A', stage: 'A1', icon: '🔀', spans: argVerbSpans, approx: true },
  { id: '87A', stage: 'A1', icon: '🎨', spans: tk => pairSpans(tk, t => t.upos === 'ADJ', isNoun) },
  // 指示詞只算限定詞、代名詞（英文模型把副詞 then、there 也標成 PronType=Dem）
  { id: '88A', stage: 'A1', icon: '👉', spans: tk => modSpans(tk, t => t.feats.PronType === 'Dem' && ['DET', 'PRON'].includes(t.upos)) },
  { id: '89A', stage: 'A1', icon: '🔢', spans: tk => modSpans(tk, t => t.upos === 'NUM') },
  { id: '33A', stage: 'A1', icon: '👥', spans: tk => featSpans(tk, 'Number', 'Plur', ['NOUN']) },
  { id: '37A', stage: 'A1', icon: '🅃', spans: tk => featNounSpans(tk, 'Definite', 'Def') },
  { id: '38A', stage: 'A1', icon: '🄰', spans: tk => featNounSpans(tk, 'Definite', 'Ind') },
  { id: '66A', stage: 'A1', icon: '⏪', spans: tk => featSpans(tk, 'Tense', 'Past') },
  { id: '67A', stage: 'A1', icon: '⏩', spans: tk => featSpans(tk, 'Tense', 'Fut'), approx: true },
  { id: '112A', stage: 'A1', icon: '🚫', spans: tk => featSpans(tk, 'Polarity', 'Neg') },
  { id: '116A', stage: 'A1', icon: '❓', spans: tk => (/[?？]/.test(tk.at(-1)?.surface || '') ? [[0, tk.length - 1]] : []), approx: true },
  { id: '85A', stage: 'A2', icon: '📍', spans: adpSpans },
];
// prof：該語言的 WALS 值（VALUES[語言代碼]），讓規則判斷能依語言的類型調整方向
export const profileOf = lang => VALUES[lang.wals] || {};
WALS.forEach(r => {
  r.test = (tk, prof) => r.spans(tk, prof).length > 0;
  r.name = FEATURES[r.id].zh;
  r.desc = '答對用到這條規則的空格時，觸發連鎖：跳到同一個來源裡、有相同模式的句子';
});
// 連鎖：技能等級 = 連鎖可以跳幾環；第 k 環分數 ×(1 + 0.5k)
export const CHAIN = { maxLevel: 3, linkBonus: 0.5, maxSpan: 5, timer: 10 };
const rulesIn = (gap, prof) => WALS.filter(r => r.test(gap, prof)).map(r => r.id);

export const normalize = s => s.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]/gu, '');

// ---- 建立一局 ----
function rankSentences(lang, ids, lemma) {
  const unknown = s => s.tokens.filter(t => isContent(t) && t.lemma !== lemma && (L().words[t.lemma]?.lv || 1) === 1).length;
  return ids.map(id => lang.sentences[id]).sort((a, b) => unknown(a) - unknown(b) || Math.random() - 0.5);
}

export function currentSituation(lang, sourceId) {
  const src = lang.sources.find(s => s.id === sourceId);
  const idx = Math.min(L().progress[sourceId] || 0, src.situations.length - 1);
  return lang.situations.find(s => s.key === `${sourceId}#${idx}`);
}

export function situationProgress(lang, sit) {
  const content = [...sit.lemmas].filter(l => lang.lemmas.get(l).content);
  const done = content.filter(l => (L().words[l]?.lv || 1) >= 3).length;
  return { done, total: content.length, ratio: content.length ? done / content.length : 0 };
}

export function buildRun(lang, sourceId, env) {
  const lg = L();
  const sit = currentSituation(lang, sourceId);
  const lv = l => lg.words[l]?.lv || 1;
  const prof = l => lg.words[l]?.prof || 0;

  // 當前情境：依等級分組，同級從最不熟的開始；5 級只靠抽查
  const cands = [...sit.lemmas].filter(l => lang.lemmas.get(l).target && lv(l) < 5);
  const byLevel = [1, 2, 3, 4].map(n => cands.filter(l => lv(l) === n).sort((a, b) =>
    prof(a) - prof(b) || (lang.base[b] ? 1 : 0) - (lang.base[a] ? 1 : 0) || lang.lemmas.get(b).freq - lang.lemmas.get(a).freq));
  const mainCount = lg.runs === 0 ? 7 : 9;
  const main = [];
  for (let round = 0; round < 5 && main.length < mainCount; round++)
    for (const group of byLevel) if (group[round] && main.length < mainCount) main.push(group[round]);
  // 某些等級不夠時，由其他字補足
  for (const l of byLevel.flat()) if (main.length < mainCount && !main.includes(l)) main.push(l);

  // 複習：不在當前情境、快要降級或最近降過級的字
  const inSit = new Set(sit.lemmas);
  const review = Object.entries(lg.words)
    .filter(([l, w]) => !inSit.has(l) && lang.lemmas.get(l)?.target && w.lv < 5 && (isDue(w) || (w.decayedAt && now() - w.decayedAt < 7 * 86400000)))
    .sort((a, b) => decayProgress(b[1]) - decayProgress(a[1]))
    .slice(0, 3).map(([l]) => l);
  // 5 級隨機抽查
  const spot = pickN(Object.entries(lg.words).filter(([l, w]) => w.lv === 5 && lang.lemmas.get(l)).map(([l]) => l), 2);

  const items = [];
  const add = (lemma, kind, times) => {
    const home = kind === 'main' ? sit.key : (lg.words[lemma]?.home || lang.lemmas.get(lemma).home);
    const homeSit = lang.situations.find(s => s.key === home);
    const ids = lang.lemmas.get(lemma).sentences.filter(id => homeSit.sentences.includes(id));
    const ranked = rankSentences(lang, ids.length ? ids : lang.lemmas.get(lemma).sentences, lemma);
    for (let i = 0; i < times; i++) items.push({ lemma, kind, sentence: ranked[i % ranked.length].id, attempts: 0, home });
  };
  main.forEach(l => add(l, 'main', 2));
  review.forEach(l => add(l, 'review', 2));
  spot.forEach(l => add(l, 'spot', 1));

  // 同一個字的兩次出現分開：先排第一輪，再排第二輪
  const first = [], second = [];
  const seen = new Set();
  for (const it of items) (seen.has(it.lemma) ? second : first).push(it), seen.add(it.lemma);
  const queue = [...shuffle(first), ...shuffle(second)];

  return {
    lang, sourceId, sit, env, queue, pos: 0,
    score: 0, combo: 0, maxCombo: 0, correct: 0, wrong: 0,
    skills: state.sim?.autoSkills ? Object.fromEntries(lg.unlocked.filter(id => WALS.some(r => r.id === id && !r.approx)).map(id => [id, 1])) : {},
    pendingChoice: false, chainUsed: new Set(), maxChain: 0, chainLinks: 0,
    firstEncounter: {}, leveled: new Set(), levelUps: [], levelDowns: [], newTiles: [],
    ruleHits: {}, pathTotal: 0, missed: new Map(), log: [],
    boss: pickBoss(lang, sit, main), bossDone: false, bossOk: false,
  };
}

// ---- 題目 ----
// 句子裡包含目標字的語塊（mineFormulas 找出的固定說法），取最長的
function formulaGap(lang, s, ti) {
  const spans = (lang.formulaSpans?.get(s.id) || []).filter(idx => idx.includes(ti));
  return spans.sort((a, b) => b.length - a.length)[0] || null;
}
function gapIndices(tokens, ti, lv, prof) {
  const ok = idx => idx.every(i => tokens[i] && isWord(tokens[i]));
  // 優先：能對上規則 > 實詞多 > 不以附著性功能詞開頭、不以限定詞結尾
  const score = idx => {
    const g = idx.map(i => tokens[i]);
    return rulesIn(g, prof).length * 10 + g.filter(isContent).length * 2
      - (['ADP', 'AUX', 'PART', 'SCONJ'].includes(g[0].upos) ? 1 : 0) - (g.at(-1).upos === 'DET' ? 1 : 0);
  };
  let cands;
  if (lv <= 2) return [ti];
  if (lv === 3) cands = [[ti, ti + 1], [ti - 1, ti]];
  else cands = [[ti - 1, ti, ti + 1], [ti, ti + 1, ti + 2], [ti - 2, ti - 1, ti], [ti, ti + 1], [ti - 1, ti]];
  cands = cands.filter(ok);
  if (!cands.length) return [ti];
  return cands.sort((a, b) => score(b) - score(a))[0];
}

function distractors(lang, lemma, upos, exclude, n, allowForms) {
  const out = [];
  const formsOf = x => x.midForms.size ? [...x.midForms] : [...x.forms].map(f => f.toLocaleLowerCase() === x.lemma ? x.lemma : f);
  if (allowForms) for (const f of shuffle(formsOf(lang.lemmas.get(lemma)))) if (!exclude.has(f) && out.length < n) out.push(f), exclude.add(f);
  const pool = [...lang.lemmas.values()].filter(x => x.target && x.lemma !== lemma);
  const same = shuffle(pool.filter(x => x.upos === upos)), other = shuffle(pool.filter(x => x.upos !== upos));
  for (const x of [...same, ...other]) {
    if (out.length >= n) break;
    const f = shuffle(formsOf(x))[0];
    if (!exclude.has(f)) { out.push(f); exclude.add(f); }
  }
  return out;
}

// 2 → 3 級：有聲音的環境挑「只差一個音」的字（含難音的優先），靜音環境挑拼字相近的字
function neighborCards(run, lemma, surface, n) {
  const { lang } = run;
  const cands = [...new Set([...lang.lemmas.values()].filter(x => x.target && x.lemma !== lemma)
    .flatMap(x => [...(x.midForms.size ? x.midForms : x.forms)]))];
  if (run.env === 'mute') return P.spellingNeighbors(surface, cands).slice(0, n).map(w => ({ word: w, kind: 'spell' }));
  const hard = P.hardSounds(lang.wals);
  return P.minimalPairs(lang.id, surface, cands)
    .sort((a, b) => b.involves.filter(x => hard.has(x)).length - a.involves.filter(x => hard.has(x)).length)
    .slice(0, n).map(m => ({ ...m, kind: 'sound', hard: m.involves.filter(x => hard.has(x)) }));
}

export function makeQuestion(run, item) {
  if (item.kind === 'chain') return makeChainQuestion(run, item);
  if (item.kind === 'boss') return makeBossQuestion(run, item);
  const { lang } = run;
  const s = lang.sentences[item.sentence];
  const w = word(item.lemma);
  const lv = item.kind === 'spot' ? 5 : w.lv;
  let ti = s.tokens.findIndex(t => t.lemma === item.lemma && isTarget(t));
  if (ti < 0) ti = s.tokens.findIndex(t => t.lemma === item.lemma);
  // Lv3 排序、Lv4 產出：目標字在語塊裡時，整個語塊挖空
  const formula = lv >= 3 ? formulaGap(lang, s, ti) : null;
  const gap = formula || gapIndices(s.tokens, ti, Math.min(lv, 4), profileOf(lang));
  const gapTokens = gap.map(i => s.tokens[i]);
  // 句首的字在字卡上用句中的寫法（例如 The → the），避免大小寫洩漏答案
  const display = (t, i) => i === 0 && t.surface.toLocaleLowerCase() !== t.surface && lang.lemmas.get(t.lemma)?.forms.has(t.surface.toLocaleLowerCase()) || (i === 0 && t.surface.toLocaleLowerCase() === t.lemma)
    ? t.surface.toLocaleLowerCase() : t.surface;
  const answer = gap.map(i => display(s.tokens[i], i));
  const mode = lv <= 2 ? 'pick' : lv === 3 ? 'order' : 'produce';
  const target = s.tokens[ti];
  let cards = [];
  let neighbors = [];
  if (mode === 'pick' && lv === 2) neighbors = neighborCards(run, item.lemma, answer[0], 2);
  if (mode === 'pick') cards = shuffle([answer[0], ...neighbors.map(x => x.word),
    ...distractors(lang, item.lemma, target.upos, new Set([...answer, ...neighbors.map(x => x.word)]), 3 - neighbors.length, false)]);
  if (mode === 'order') cards = shuffle([...answer, ...distractors(lang, item.lemma, target.upos, new Set(answer), 2, true)]);
  // 這題答對就會達到門檻時，這題就是升級挑戰
  const challenge = item.kind !== 'spot' && lv >= 2 && lv < 5 && !run.leveled.has(item.lemma) &&
    w.prof + (item.attempts ? Math.ceil(RULES.envPoints[run.env] / 2) : RULES.envPoints[run.env]) >= RULES.threshold;
  // 計時依空格長度加長：每多一個字多 3 秒
  const timer = lv <= 2 ? 0 : (lv === 3 ? 15 : 12) + 3 * Math.max(0, gap.length - (lv === 3 ? 2 : 3));
  return {
    item, lv, mode, tokens: s.tokens, gap, answer, cards, challenge, timer, neighbors, formula: !!formula,
    image: lv === 1 ? lang.base[item.lemma] : null,
    rules: rulesIn(gapTokens, profileOf(lang)),
    before: joinTokens(s.tokens.slice(0, gap[0]), lang.joiner),
    after: joinTokens(s.tokens.slice(gap.at(-1) + 1), lang.joiner),
    full: joinTokens(s.tokens, lang.joiner),
    answerText: joinTokens(gapTokens, lang.joiner),
  };
}

// 題目排完後，最後一題是王關（每局一次）
export const current = run => run.queue[run.pos] || (run.boss && !run.bossDone ? run.boss : null);

// ---- 作答 ----
// response：pick 為選中的字，order 為依序選的字陣列，produce 為輸入或辨識出的文字
export function answer(run, q, response, { timeLeft = 0, spoken = false } = {}) {
  const item = q.item;
  let ok;
  if (spoken) ok = [].concat(response).some(r => normalize(r).includes(normalize(q.answerText)));
  else if (q.mode === 'pick') ok = response === q.answer[0];
  else if (q.mode === 'order') ok = response.join('\u0000') === q.answer.join('\u0000');
  else ok = normalize(response) === normalize(q.answerText);

  if (item.kind === 'chain') return answerChain(run, q, ok, timeLeft);
  if (item.kind === 'boss') return answerBoss(run, q, ok, timeLeft);
  const w = word(item.lemma);
  w.last = now();
  if (!w.home) w.home = item.home;
  const result = { ok, points: 0, gained: 0, levelUp: null, levelDown: null, rules: [], path: 0, newTile: null };

  if (ok) {
    run.correct++;
    run.combo++;
    run.maxCombo = Math.max(run.maxCombo, run.combo);
    w.correct++;
    const comboMult = Math.min(3, 1 + 0.1 * (run.combo - 1));
    const speed = q.timer ? 0.5 * timeLeft : 0;
    const active = activeRules(run, q);
    const contentLemmas = q.tokens.filter(isContent).map(t => t.lemma);
    const path = SHOW.path ? T.pathBonus(contentLemmas) : { bonus: 0, pairs: [] };
    for (const [a, b, st] of path.pairs) if (st >= 3) run.missed.set(`${a}|${b}`, { a, b, steps: st });
    const attemptFactor = [1, 0.5, 0.25][item.attempts] ?? 0.25;
    const points = Math.round(10 * comboMult * (1 + speed) * (1 + path.bonus) * attemptFactor);
    run.score += points;
    run.pathTotal += path.bonus;
    Object.assign(result, { points, rules: active, path: path.bonus, comboMult, chains: startChains(run, q, active) });

    const envPts = RULES.envPoints[spoken || run.env !== 'speak' ? run.env : 'ear'];
    const gained = item.attempts ? Math.ceil(envPts / 2) : envPts;
    result.gained = gained;
    if (item.kind === 'spot') {
      // 5 級抽查通過，維持 5 級
    } else if (w.lv === 1) {
      run.firstEncounter[item.lemma] = (run.firstEncounter[item.lemma] || 0) + 1;
      if (run.firstEncounter[item.lemma] >= RULES.firstEncounterCorrect && !run.leveled.has(item.lemma)) levelUp(run, item.lemma, w, result);
    } else if (q.challenge) {
      levelUp(run, item.lemma, w, result);
    } else if (w.lv < 5) {
      w.prof = Math.min(RULES.threshold, w.prof + gained);
    }
    if (run.correct % 5 === 0) run.pendingChoice = true;
  } else {
    run.wrong++;
    run.combo = 0;
    w.wrong++;
    item.attempts++;
    if (q.challenge) w.prof = Math.min(w.prof, Math.floor(RULES.threshold / 2));
    if (item.kind === 'spot' && w.lv === 5) {
      w.lv = 4; w.prof = 0;
      run.levelDowns.push(item.lemma);
      result.levelDown = 4;
    }
    // 同一題最多練習 3 次：排到幾題之後再出
    if (item.attempts < 3) run.queue.splice(Math.min(run.pos + 4, run.queue.length), 0, item);
  }
  run.log.push({ lemma: item.lemma, ok });
  run.pos++;
  save();
  return result;
}

function levelUp(run, lemma, w, result) {
  w.lv++;
  w.prof = 0;
  delete w.decayedAt;
  run.leveled.add(lemma);
  run.levelUps.push({ lemma, lv: w.lv });
  result.levelUp = w.lv;
  if (w.lv === 2 && run.lang.lemmas.get(lemma).content) run.newTiles.push(lemma);
}

// ---- 局中升級：三選一（只有已解鎖的規則；再選一次同一條規則 = 連鎖多跳一環） ----
export function choices(run) {
  const lg = L();
  // 判斷方式只是近似的規則（81A、67A、116A）不出現：規則透視會把片段標在畫面上，判斷錯誤會讓學習者學錯
  const pool = WALS.filter(r => !r.approx && lg.unlocked.includes(r.id) && (run.skills[r.id] || 0) < CHAIN.maxLevel).map(r => {
    const next = (run.skills[r.id] || 0) + 1;
    return { ...r, type: 'wals', next, desc: next === 1 ? `開啟連鎖：答對用到這條規則的空格，跳到另一個有相同模式的句子（1 環）` : `升到 Lv${next}：連鎖跳 ${next} 環` };
  });
  return pickN(pool, 3);
}
export function choose(run, c) {
  run.skills[c.id] = (run.skills[c.id] || 0) + 1;
  run.pendingChoice = false;
}

// ---- 連鎖 ----
// 規則透視：句子裡屬於「本局選到的規則」的片段（整句判斷）。[{ rule, idx: [字的位置…] }]
export function ruleMarks(run, tokens) {
  const prof = profileOf(run.lang), out = [];
  for (const r of WALS) {
    if (!run.skills[r.id] || !L().unlocked.includes(r.id)) continue;
    for (const [a, b] of r.spans(tokens, prof)) {
      let x = a, y = b;
      while (x <= y && !isWord(tokens[x])) x++;
      while (y >= x && !isWord(tokens[y])) y--;
      if (x <= y) out.push({ rule: r.id, idx: Array.from({ length: y - x + 1 }, (_, k) => x + k) });
    }
  }
  return out;
}
// 觸發連鎖的規則：整段規則片段都在空格裡（和畫面上藍框的空格一致）
const activeRules = (run, q) => [...new Set(ruleMarks(run, q.tokens).filter(m => m.idx.every(i => q.gap.includes(i))).map(m => m.rule))];

// 找同一個來源裡、有這條規則模式的另一個句子；空格就是規則對應的那一段
function findChainTarget(run, ruleId, exclude) {
  const { lang } = run, rule = WALS.find(r => r.id === ruleId), prof = profileOf(lang);
  const ids = [...new Set(lang.situations.filter(s => s.key.startsWith(`${run.sourceId}#`)).flatMap(s => s.sentences))]
    .filter(id => id !== exclude && !run.chainUsed.has(id));
  const cands = [];
  for (const id of ids) {
    const tk = lang.sentences[id].tokens;
    for (let [a, b] of rule.spans(tk, prof)) {
      while (a <= b && !isWord(tk[a])) a++;
      while (b >= a && !isWord(tk[b])) b--;
      if (a > b || b - a + 1 > CHAIN.maxSpan) continue;
      const idx = Array.from({ length: b - a + 1 }, (_, k) => a + k);
      // 只有一個字的空格，要有其他形式可以當干擾字卡（knew／know）；只有一種形式的字（日文的「た」）答案永遠一樣，不出
      if (idx.length === 1 && lang.lemmas.get(tk[a].lemma)?.forms.size < 2) continue;
      if (idx.every(i => isWord(tk[i]))) cands.push({ sentence: id, gap: idx });
    }
  }
  return cands.length ? cands[(Math.random() * cands.length) | 0] : null;
}
// 插在目前這題之後；已經排著的連鎖題先跳過，兩條連鎖就會交錯
function insertChain(run, item) {
  let i = run.pos + 1;
  while (run.queue[i]?.kind === 'chain') i++;
  run.queue.splice(i, 0, item);
}
function queueLink(run, rule, link, of, exclude) {
  const t = findChainTarget(run, rule, exclude);
  if (!t) return false;
  run.chainUsed.add(t.sentence);
  const tk = run.lang.sentences[t.sentence].tokens;
  const head = t.gap.map(i => tk[i]).find(isContent) || tk[t.gap[0]];
  insertChain(run, { kind: 'chain', rule, link, of, sentence: t.sentence, gap: t.gap, lemma: head.lemma, attempts: 0 });
  return true;
}
function startChains(run, q, active) {
  run.chainUsed.add(q.item.sentence);
  return active.filter(r => queueLink(run, r, 1, run.skills[r], q.item.sentence)).map(r => ({ rule: r, of: run.skills[r] }));
}

function makeChainQuestion(run, item) {
  const { lang } = run, s = lang.sentences[item.sentence], gap = item.gap;
  // 句首的大寫會洩漏順序：功能詞一律改小寫，其他字只在文章裡出現過小寫寫法時才改（德文名詞本來就大寫）
  const lower = (t, i) => {
    if (i !== 0 || t.upos === 'PROPN') return t.surface;
    const lc = t.surface.toLocaleLowerCase();
    return isFunction(t) || lang.lemmas.get(t.lemma)?.forms.has(lc) ? lc : t.surface;
  };
  const answer = gap.map(i => lower(s.tokens[i], i));
  const gapTokens = gap.map(i => s.tokens[i]);
  const head = gapTokens.find(isContent) || gapTokens[0];
  const mode = answer.length === 1 ? 'pick' : 'order';
  // 單字的空格：干擾字卡優先用同一個詞元的其他變化形（walk／walked），練的就是這個模式
  const cards = shuffle([...answer, ...distractors(lang, head.lemma, head.upos, new Set(answer), mode === 'pick' ? 3 : 1, true)]);
  return {
    item, lv: 0, mode, tokens: s.tokens, gap, answer, cards, challenge: false, timer: CHAIN.timer, neighbors: [],
    image: null, rules: [item.rule],
    before: joinTokens(s.tokens.slice(0, gap[0]), lang.joiner),
    after: joinTokens(s.tokens.slice(gap.at(-1) + 1), lang.joiner),
    full: joinTokens(s.tokens, lang.joiner),
    answerText: joinTokens(gapTokens, lang.joiner),
  };
}

// 連鎖題只計分、不改變單字等級；答錯就斷掉，沒有其他懲罰
function answerChain(run, q, ok, timeLeft) {
  const item = q.item;
  const result = { ok, points: 0, chain: { rule: item.rule, link: item.link, of: item.of }, rules: [], path: 0 };
  if (ok) {
    run.combo++;
    run.maxCombo = Math.max(run.maxCombo, run.combo);
    run.chainLinks++;
    run.maxChain = Math.max(run.maxChain, item.link);
    run.ruleHits[item.rule] = (run.ruleHits[item.rule] || 0) + 1;
    const comboMult = Math.min(3, 1 + 0.1 * (run.combo - 1));
    result.points = Math.round(10 * (1 + CHAIN.linkBonus * item.link) * comboMult * (1 + 0.5 * timeLeft));
    run.score += result.points;
    if (item.link < item.of) result.next = queueLink(run, item.rule, item.link + 1, item.of, item.sentence);
  } else {
    // 同一條連鎖後面還排著的環一起取消
    run.queue = run.queue.filter((x, i) => i <= run.pos || !(x.kind === 'chain' && x.rule === item.rule));
  }
  run.pos++;
  save();
  return result;
}

// ---- 王關：一局的收尾 ----
// 從目前情境挑一個包含最多「本局練過的字」的句子，空格是其中最長的語塊或規則片段（3～5 個字），整段依序排好
const BOSS = { min: 3, max: 5, timer: 20, points: 50 };
function pickBoss(lang, sit, main) {
  const practiced = new Set(main), prof = profileOf(lang);
  const ranked = sit.sentences.map(id => lang.sentences[id])
    .map(s => ({ s, n: new Set(s.tokens.filter(t => practiced.has(t.lemma)).map(t => t.lemma)).size }))
    .filter(x => x.n > 0).sort((a, b) => b.n - a.n);
  for (const { s } of ranked) {
    const tk = s.tokens, ok = idx => idx.length >= BOSS.min && idx.length <= BOSS.max && idx.every(i => isWord(tk[i])) && idx.some(i => practiced.has(tk[i].lemma));
    const range = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
    const spans = [
      ...(lang.formulaSpans?.get(s.id) || []),
      ...WALS.flatMap(r => r.spans(tk, prof)).map(([a, b]) => range(a, b)),
    ].filter(ok).sort((a, b) => b.length - a.length);
    // 沒有語塊或規則片段時：以練過的字為中心取 4 個連續的字
    if (!spans.length) {
      const i = tk.findIndex(t => practiced.has(t.lemma));
      for (const a of [i - 1, i - 2, i, i - 3]) { const idx = range(a, a + 3); if (a >= 0 && ok(idx)) { spans.push(idx); break; } }
    }
    if (spans.length) return { kind: 'boss', sentence: s.id, gap: spans[0], lemma: tk[spans[0].find(i => practiced.has(tk[i].lemma))].lemma, attempts: 0 };
  }
  return null;
}
function makeBossQuestion(run, item) {
  const q = makeChainQuestion(run, { ...item, rule: null });
  const head = item.gap.map(i => q.tokens[i]).find(isContent) || q.tokens[item.gap[0]];
  // 一律排序：字卡 = 整段 + 2 張干擾
  const cards = shuffle([...q.answer, ...distractors(run.lang, head.lemma, head.upos, new Set(q.answer), 2, true)]);
  return { ...q, mode: 'order', cards, timer: BOSS.timer, rules: [] };
}
function answerBoss(run, q, ok, timeLeft) {
  run.bossDone = true;
  run.bossOk = ok;
  const result = { ok, points: 0, boss: true, rules: [], path: 0 };
  if (ok) {
    run.combo++;
    run.maxCombo = Math.max(run.maxCombo, run.combo);
    const comboMult = Math.min(3, 1 + 0.1 * (run.combo - 1));
    result.points = Math.round(BOSS.points * comboMult * (1 + 0.5 * timeLeft));
    run.score += result.points;
  }
  save();
  return result;
}

// 情境完成時的回顧：這段學會的字（Lv3 以上）、出現的語塊
function sitSummary(lang, sit) {
  const lg = L();
  const words = [...sit.lemmas].filter(l => lang.lemmas.get(l).content && (lg.words[l]?.lv || 1) >= 3);
  const seen = new Set(), chunks = [];
  for (const id of sit.sentences)
    for (const idx of lang.formulaSpans?.get(id) || []) {
      const text = joinTokens(idx.map(i => lang.sentences[id].tokens[i]), lang.joiner);
      if (!seen.has(text.toLowerCase())) { seen.add(text.toLowerCase()); chunks.push(text); }
    }
  return { title: sit.title, words, chunks: chunks.slice(0, 12) };
}

// ---- 規則自動開放（金幣經濟關閉時）：詞彙量每 RULES.wordsPerRule 個開放一條 ----
// 在學習者的來源裡出現越多次的規則越先開放，連鎖才有句子可以跳
export function syncUnlocks(lang) {
  if (SHOW.rulePurchase) return [];
  const lg = L(), prof = profileOf(lang), sents = Object.values(lang.sentences);
  const order = WALS.filter(r => !r.approx && stageReached(r.stage))
    .map(r => [r.id, sents.filter(s => r.test(s.tokens, prof)).length])
    .filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const n = Math.floor(vocabCount() / RULES.wordsPerRule);
  const fresh = order.slice(0, n).filter(id => !lg.unlocked.includes(id));
  lg.unlocked.push(...fresh);
  save();
  return fresh;
}

// ---- 結算 ----
export function settle(run) {
  const lg = L(), { lang } = run;
  // 語塊產出要本局至少答對 5 題，避免開局就結束來刷金幣
  const production = SHOW.chunks && run.correct >= 5 ? T.chunkProduction(lang.chunks) : [];
  const produced = production.reduce((s, p) => s + p.gold, 0);
  lg.gold += run.score + produced;
  const auto = T.receive(run.newTiles);
  const before = situationProgress(lang, run.sit);
  let advanced = null;
  const src = lang.sources.find(s => s.id === run.sourceId);
  const idx = lg.progress[run.sourceId] || 0;
  if (before.ratio >= RULES.completeRatio && idx + 1 < src.situations.length) {
    lg.progress[run.sourceId] = idx + 1;
    advanced = src.situations[idx + 1].title;
  }
  lg.runs++;
  const newRules = syncUnlocks(lang);
  // 星數：完成一局 1 星；答對率 80% 以上 2 星；再加上王關答對 3 星。每個情境記最高星數與最高分
  const total = run.correct + run.wrong, accuracy = total ? run.correct / total : 0;
  // 中途結束的局沒有星數
  const finished = !current(run);
  const stars = finished ? 1 + (accuracy >= 0.8 ? 1 : 0) + (accuracy >= 0.8 && run.bossOk ? 1 : 0) : 0;
  const rec = ((lg.best ||= {})[run.sit.key] ||= { stars: 0, score: 0 });
  const newBest = run.score > rec.score;
  rec.stars = Math.max(rec.stars, stars);
  rec.score = Math.max(rec.score, run.score);
  const missed = [...run.missed.values()].sort((a, b) => b.steps - a.steps).slice(0, 3);
  const report = {
    score: run.score, produced, production: production.map(p => ({ chunks: p.chunks.map(c => c.lemmas), mult: p.mult, gold: p.gold })),
    correct: run.correct, wrong: run.wrong, maxCombo: run.maxCombo, maxChain: run.maxChain, chainLinks: run.chainLinks,
    levelUps: run.levelUps, levelDowns: run.levelDowns, newTiles: run.newTiles, auto,
    ruleHits: run.ruleHits, missed, progress: before, advanced, sitTitle: run.sit.title, newRules,
    stars, accuracy, bossOk: run.bossOk, hadBoss: !!run.boss, best: { ...rec }, newBest, sitKey: run.sit.key,
    sitDone: advanced ? sitSummary(lang, run.sit) : null,
  };
  lg.lastReport = report;
  save();
  return report;
}
