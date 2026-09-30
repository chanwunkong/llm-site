// 內層：一局的出題、作答判定、計分與結算。
// 規則只依賴詞元、UD 詞性與單字等級，對任何語言都相同。
import { isContent, isTarget, isWord, joinTokens } from './content.js';
import { L, word, save, now, RULES, isDue, decayProgress } from './store.js';
import * as T from './territory.js';

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pickN = (a, n) => shuffle(a.slice()).slice(0, n);

// ---- WALS 規則：以詞性樣式判斷空格裡用到哪些規則 ----
const NOMINAL = ['NOUN', 'PROPN', 'PRON'];
function adjacentPair(gap, a, bs) {
  for (let i = 0; i + 1 < gap.length; i++) {
    const x = gap[i].upos, y = gap[i + 1].upos;
    if ((x === a && bs.includes(y)) || (bs.includes(x) && y === a)) return true;
  }
  return false;
}
export const WALS = [
  { id: '87A', icon: '🎨', name: '形容詞與名詞的語序', desc: '形容詞放在名詞的前面還是後面', test: g => adjacentPair(g, 'ADJ', ['NOUN']) },
  { id: '85A', icon: '📍', name: '介詞與名詞的語序', desc: '介詞（前置或後置）和名詞的相對位置', test: g => adjacentPair(g, 'ADP', NOMINAL) },
  { id: '33A', icon: '🔢', name: '名詞複數的標示', desc: '名詞複數怎麼標示', test: g => g.some(t => t.upos === 'NOUN' && t.feats.Number === 'Plur') },
  { id: '81A', icon: '🔀', name: '主詞、受詞與動詞的語序', desc: '名詞和動詞誰先誰後', test: g => g.some(t => NOMINAL.includes(t.upos)) && g.some(t => t.upos === 'VERB') },
];
export const AIDS = [
  { id: 'trim', icon: '✂️', name: '刪除錯誤選項', desc: '有字卡的題目少一張錯誤字卡' },
  { id: 'hint', icon: '🔤', name: '顯示首字', desc: '顯示答案的第一個字母' },
  { id: 'slowtime', icon: '🐢', name: '放慢時間', desc: '計時題的時間延長 50%' },
  { id: 'slowvoice', icon: '🔉', name: '慢速朗讀', desc: '句子用較慢的速度朗讀', audio: true },
];
const rulesIn = gap => WALS.filter(r => r.test(gap)).map(r => r.id);

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
    skills: [], aids: [], pendingChoice: false,
    firstEncounter: {}, leveled: new Set(), levelUps: [], levelDowns: [], newTiles: [],
    ruleHits: {}, pathTotal: 0, missed: new Map(), log: [],
  };
}

// ---- 題目 ----
function gapIndices(tokens, ti, lv) {
  const ok = idx => idx.every(i => tokens[i] && isWord(tokens[i]));
  // 優先：能對上規則 > 實詞多 > 不以附著性功能詞開頭、不以限定詞結尾
  const score = idx => {
    const g = idx.map(i => tokens[i]);
    return rulesIn(g).length * 10 + g.filter(isContent).length * 2
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

export function makeQuestion(run, item) {
  const { lang } = run;
  const s = lang.sentences[item.sentence];
  const w = word(item.lemma);
  const lv = item.kind === 'spot' ? 5 : w.lv;
  let ti = s.tokens.findIndex(t => t.lemma === item.lemma && isTarget(t));
  if (ti < 0) ti = s.tokens.findIndex(t => t.lemma === item.lemma);
  const gap = gapIndices(s.tokens, ti, Math.min(lv, 4));
  const gapTokens = gap.map(i => s.tokens[i]);
  // 句首的字在字卡上用句中的寫法（例如 The → the），避免大小寫洩漏答案
  const display = (t, i) => i === 0 && t.surface.toLocaleLowerCase() !== t.surface && lang.lemmas.get(t.lemma)?.forms.has(t.surface.toLocaleLowerCase()) || (i === 0 && t.surface.toLocaleLowerCase() === t.lemma)
    ? t.surface.toLocaleLowerCase() : t.surface;
  const answer = gap.map(i => display(s.tokens[i], i));
  const mode = lv <= 2 ? 'pick' : lv === 3 ? 'order' : 'produce';
  const target = s.tokens[ti];
  let cards = [];
  if (mode === 'pick') cards = shuffle([answer[0], ...distractors(lang, item.lemma, target.upos, new Set(answer), 3, false)]);
  if (mode === 'order') cards = shuffle([...answer, ...distractors(lang, item.lemma, target.upos, new Set(answer), 2, true)]);
  if (run.aids.includes('trim') && cards.length) {
    const wrong = cards.findIndex(c => !answer.includes(c));
    if (wrong >= 0) cards.splice(wrong, 1);
  }
  // 這題答對就會達到門檻時，這題就是升級挑戰
  const challenge = item.kind !== 'spot' && lv >= 2 && lv < 5 && !run.leveled.has(item.lemma) &&
    w.prof + (item.attempts ? Math.ceil(RULES.envPoints[run.env] / 2) : RULES.envPoints[run.env]) >= RULES.threshold;
  let timer = lv <= 2 ? 0 : lv === 3 ? 15 : 12;
  if (timer && run.aids.includes('slowtime')) timer *= 1.5;
  return {
    item, lv, mode, tokens: s.tokens, gap, answer, cards, challenge, timer,
    image: lv === 1 ? lang.base[item.lemma] : null,
    hint: run.aids.includes('hint') ? answer[0][0] : null,
    rules: rulesIn(gapTokens),
    before: joinTokens(s.tokens.slice(0, gap[0]), lang.joiner),
    after: joinTokens(s.tokens.slice(gap.at(-1) + 1), lang.joiner),
    full: joinTokens(s.tokens, lang.joiner),
    answerText: joinTokens(gapTokens, lang.joiner),
  };
}

export const current = run => run.queue[run.pos] || null;

// ---- 作答 ----
// response：pick 為選中的字，order 為依序選的字陣列，produce 為輸入或辨識出的文字
export function answer(run, q, response, { timeLeft = 0, spoken = false } = {}) {
  const item = q.item, w = word(item.lemma), lg = L();
  let ok;
  if (spoken) ok = [].concat(response).some(r => normalize(r).includes(normalize(q.answerText)));
  else if (q.mode === 'pick') ok = response === q.answer[0];
  else if (q.mode === 'order') ok = response.join('\u0000') === q.answer.join('\u0000');
  else ok = normalize(response) === normalize(q.answerText);

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
    const active = q.rules.filter(r => run.skills.includes(r) && lg.unlocked.includes(r));
    const contentLemmas = q.tokens.filter(isContent).map(t => t.lemma);
    const path = T.pathBonus(contentLemmas);
    for (const [a, b, st] of path.pairs) if (st >= 3) run.missed.set(`${a}|${b}`, { a, b, steps: st });
    const attemptFactor = [1, 0.5, 0.25][item.attempts] ?? 0.25;
    const points = Math.round(10 * comboMult * (1 + speed) * (1 + 0.5 * active.length) * (1 + path.bonus) * attemptFactor);
    run.score += points;
    run.pathTotal += path.bonus;
    active.forEach(r => (run.ruleHits[r] = (run.ruleHits[r] || 0) + 1));
    Object.assign(result, { points, rules: active, path: path.bonus, comboMult });

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

// ---- 局中升級：三選一 ----
export function choices(run) {
  const lg = L();
  const pool = [
    ...WALS.filter(r => lg.unlocked.includes(r.id) && !run.skills.includes(r.id)).map(r => ({ ...r, type: 'wals' })),
    ...AIDS.filter(a => !run.aids.includes(a.id) && !(a.audio && run.env === 'mute')).map(a => ({ ...a, type: 'aid' })),
  ];
  return pickN(pool, 3);
}
export function choose(run, c) {
  if (c.type === 'wals') run.skills.push(c.id);
  else run.aids.push(c.id);
  run.pendingChoice = false;
}

// ---- 結算 ----
export function settle(run) {
  const lg = L(), { lang } = run;
  // 語塊產出要本局至少答對 5 題，避免開局就結束來刷金幣
  const production = run.correct >= 5 ? T.chunkProduction(lang.chunks) : [];
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
  const missed = [...run.missed.values()].sort((a, b) => b.steps - a.steps).slice(0, 3);
  const report = {
    score: run.score, produced, production: production.map(p => ({ chunks: p.chunks.map(c => c.lemmas), mult: p.mult, gold: p.gold })),
    correct: run.correct, wrong: run.wrong, maxCombo: run.maxCombo,
    levelUps: run.levelUps, levelDowns: run.levelDowns, newTiles: run.newTiles, auto,
    ruleHits: run.ruleHits, missed, progress: before, advanced, sitTitle: run.sit.title,
  };
  lg.lastReport = report;
  save();
  return report;
}
