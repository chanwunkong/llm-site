// 內層（最小可行系統，docs/design.md 第 3 節）：一局 3 分鐘、5 個等級、每一級都要自己說出或寫出來。
// 所有字都一樣處理；系統只判斷目標語言的形式，意思是使用者自己的理解。
import { isTarget, isWord, joinTokens } from './content.js';
import { L, word, save, now, decayProgress } from './store.js';

export const RUN_MS = 3 * 60 * 1000;
export const NEW_PER_RUN = 3;
const DAY = 86400000;
export const today = () => Math.floor(now() / DAY);
export const LV_NAME = ['', '認識', '理解', '說出形式', '組合', '新的情境'];

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const normalize = s => String(s || '').normalize('NFKC').toLocaleLowerCase().replace(/[\p{P}\p{S}]/gu, '').replace(/\s+/g, ' ').trim();

// ---- 理解：使用者自己用圖示和已經會的字組合（存在 word.mine，最後一筆是現在的理解）----
// 圖示存成 "emoji:🐱"，字存成字本身
export const understanding = lemma => L().words[lemma]?.mine?.at(-1)?.parts || null;
export const isEmojiPart = p => p.startsWith('emoji:');
// 寫理解時可以用的字：Lv2 以上、而且自己寫過理解的字（之後才會變成提示）
export const usableWords = except => Object.entries(L().words).filter(([l, w]) => l !== except && w.lv >= 2).map(([l]) => l);

// ---- 文法的意思：用基元表達（UD 的詞形特徵 → 基元的字）----
// 一個基元在這個語言裡有好幾個字時（英文 MUCH~MANY = much／many），全部列出
const prime = (lang, id) => { const p = lang.core.find(x => x.id === id); return p ? [...new Set([p.key, ...(p.words || [])])].join(' / ') : null; };
// 過去只看動詞、複數只看名詞（UD 也把 their 標成複數，那不是這裡要的意思）
export function markerWords(lang, feats = {}, upos = '') {
  const out = [];
  if (feats.Tense === 'Past' && (upos === 'VERB' || upos === 'AUX' || !upos)) out.push(prime(lang, 'BEFORE'), prime(lang, 'NOW'));
  if (feats.Number === 'Plur' && (upos === 'NOUN' || !upos)) out.push(prime(lang, 'MUCH_MANY'));
  return out.filter(Boolean);
}

// 一個詞元在資料裡出現過的形式和特徵
function formsOf(lang, lemma) {
  lang._forms ||= new Map();
  if (!lang._forms.has(lemma)) {
    const m = new Map();
    for (const id of lang.lemmas.get(lemma)?.sentences || [])
      for (const t of lang.sentences[id].tokens) if (t.lemma === lemma && !m.has(t.surface.toLocaleLowerCase())) m.set(t.surface.toLocaleLowerCase(), { ...t.feats, upos: t.upos });
    lang._forms.set(lemma, m);
  }
  return lang._forms.get(lemma);
}
const marked = f => (f.Tense === 'Past' && ['VERB', 'AUX'].includes(f.upos)) || (f.Number === 'Plur' && f.upos === 'NOUN');

// ---- 一局 ----
// 先出到期的字（等著不同天再答對、寫理解、快要降級），再教 3 個新字（照來源的順序）；
// 這些都做完、時間還沒到，就繼續教新字
export function startRun(lang, sourceId) {
  const lg = L(), d = today();
  const known = Object.entries(lg.words).filter(([l]) => lang.lemmas.has(l) || lang.coreByKey?.has(l));
  const rank = ([, w]) => (w.okDay != null && w.okDay < d ? 0 : w.lv === 2 ? 1 : decayProgress(w) >= 0.7 ? 2 : 3);
  const due = known.filter(([, w]) => !w.master && w.okDay !== d).sort((a, b) => rank(a) - rank(b) || (a[1].last || 0) - (b[1].last || 0)).map(([l]) => l);
  const fresh = [];
  for (const l of sourceOrder(lang, sourceId)) {
    if (fresh.length >= NEW_PER_RUN) break;
    if (!lg.words[l]) fresh.push(l);
  }
  // 到期的字裡，等著確認的和要寫理解的排最前面，新字接在後面
  const urgent = due.filter(l => rank([l, lg.words[l]]) <= 1), rest = due.filter(l => !urgent.includes(l));
  return { lang, sourceId, t0: Date.now(), queue: [...urgent, ...fresh, ...rest], pos: 0, retried: new Set(), log: [], newTiles: [], ended: false, order: sourceOrder(lang, sourceId) };
}
// 來源裡的字，照第一次出現的順序（基元 65：照基元的順序）
function sourceOrder(lang, sourceId) {
  const src = lang.sources.find(s => s.id === sourceId);
  if (src?.core) return lang.core.map(p => p.key);
  const out = new Set();
  for (const sit of lang.situations.filter(s => s.source === sourceId))
    for (const id of sit.sentences) for (const t of lang.sentences[id].tokens) if (isTarget(t)) out.add(t.lemma);
  return [...out];
}
export const timeLeft = run => Math.max(0, RUN_MS - (Date.now() - run.t0));

// 下一題：依序找一個現在能出題的字；佇列用完就從今天練過的字裡挑
export function next(run) {
  while (run.pos < run.queue.length) {
    const lemma = run.queue[run.pos++];
    const q = makeQuestion(run, lemma);
    if (q) return q;
  }
  // 時間還沒到：繼續教新字
  const lg = L(), more = run.order.find(l => !lg.words[l]);
  if (more) return makeQuestion(run, more);
  const extra = shuffle(Object.keys(lg.words).filter(l => lg.words[l].lv >= 3 && (run.lang.lemmas.has(l) || run.lang.coreByKey?.has(l))));
  for (const l of extra) { const q = makeQuestion(run, l, true); if (q) return q; }
  return null;
}

// ---- 題目 ----
const coreOf = (lang, lemma) => lang.coreByKey?.get(lemma);
const sentencesOf = (lang, lemma) => (lang.lemmas.get(lemma)?.sentences || []).map(id => lang.sentences[id]);
const tokenIndex = (s, lemma) => s.tokens.findIndex(t => t.lemma === lemma);

export function makeQuestion(run, lemma, extra = false) {
  const { lang } = run, w = word(lemma), lv = w.lv, P = coreOf(lang, lemma);
  const base = { lemma, lv, extra };
  if (lv === 1) {
    // 認識：第一次遇見，照著說或寫。文章的字附上句子（這個字標亮）
    // 練文章時附上這篇文章裡的句子；練「基元 65」時不附句子（同一個來源的畫面一致）
    const s = sentencesOf(lang, lemma).find(x => run.sourceId === x.sit.split('#')[0]) || null;
    const ti = s ? tokenIndex(s, lemma) : -1;
    const form = ti >= 0 ? s.tokens[ti].surface : P?.key || lemma;
    return { ...base, kind: 'copy', answer: form, accept: [form], sentence: s || null, hl: ti, icon: P?.icon || lang.base[lemma] || null, full: s ? joinTokens(s.tokens, lang.joiner) : form };
  }
  if (lv === 2) return { ...base, kind: 'understand', suggest: P?.icon || lang.base[lemma] || null, examples: sentencesOf(lang, lemma).slice(0, 2).map(x => joinTokens(x.tokens, lang.joiner)) };
  const mine = understanding(lemma);
  if (!mine) return { ...base, kind: 'understand', suggest: P?.icon || lang.base[lemma] || null, examples: [] };
  if (lv === 3) {
    // 說出形式：你的理解 ＋ 文法的意思（過去、複數）→ 正確的形式
    const forms = [...formsOf(lang, lemma)];
    const withMark = forms.filter(([, f]) => marked(f));
    const plain = forms.filter(([, f]) => !marked(f)).map(([s]) => s);
    if (withMark.length && Math.random() < 0.5) {
      const [form, f] = withMark[(Math.random() * withMark.length) | 0];
      return { ...base, kind: 'form', cue: mine, markers: markerWords(lang, f, f.upos), answer: form, accept: [form] };
    }
    const accept = [...new Set([lemma, ...plain, ...(P?.words || [])])];
    return { ...base, kind: 'form', cue: mine, markers: [], answer: P?.key || plain[0] || lemma, accept };
  }
  if (lv === 4) {
    // 組合：資料裡實際出現過的 2～3 個字，每個字都寫過理解；提示順序打亂
    const spans = [];
    for (const s of sentencesOf(lang, lemma)) {
      const i = tokenIndex(s, lemma);
      for (const [a, b] of [[i - 1, i], [i, i + 1], [i - 1, i + 1], [i - 2, i], [i, i + 2]]) {
        const idx = []; for (let k = a; k <= b; k++) idx.push(k);
        if (a < 0 || b >= s.tokens.length || !idx.every(k => isWord(s.tokens[k]) && (k === i || understanding(s.tokens[k].lemma)))) continue;
        // 要是一個完整的片段：有句法分析時，片段裡只能有一個字依附到片段外面（避免 "for in"、"it many" 這種跨片語的組合）
        if (s.tokens.some(t => t.head != null) && idx.filter(k => !idx.includes(s.tokens[k].head)).length > 1) continue;
        // 邊界：不以連接詞開頭，不以冠詞、介詞、連接詞結尾（"and had"、"for the"）
        if (['CCONJ', 'SCONJ'].includes(s.tokens[a].upos) || ['DET', 'ADP', 'CCONJ', 'SCONJ'].includes(s.tokens[b].upos)) continue;
        spans.push({ s, idx });
      }
    }
    if (!spans.length) return null;   // 還沒有可以組合的字：等學會更多字
    const { s, idx } = spans[(Math.random() * spans.length) | 0];
    const toks = idx.map(k => s.tokens[k]);
    const answer = joinTokens(toks, lang.joiner);
    const parts = shuffle(toks.map(t => ({ lemma: t.lemma, cue: understanding(t.lemma) || [t.lemma] })));
    const markers = [...new Set(toks.flatMap(t => markerWords(lang, t.feats, t.upos)))];
    const question = s.tokens.some(t => /[?？]/.test(t.surface));
    return { ...base, kind: 'combine', parts, markers, question, answer, accept: [answer] };
  }
  // Lv5：新的情境：沒有用這個字練過的句子，這個字空著
  const seen = new Set(w.seen || []);
  const s = sentencesOf(lang, lemma).find(x => !seen.has(x.id));
  if (!s) return null;   // 沒有新的句子：等匯入更多資料
  const ti = tokenIndex(s, lemma);
  return {
    ...base, kind: 'context', sentence: s, hl: ti, answer: s.tokens[ti].surface, accept: [s.tokens[ti].surface],
    before: joinTokens(s.tokens.slice(0, ti), lang.joiner), after: joinTokens(s.tokens.slice(ti + 1), lang.joiner), full: joinTokens(s.tokens, lang.joiner),
  };
}

export const check = (q, response) => [].concat(response).some(r => q.accept.some(a => normalize(r) === normalize(a)));

// ---- 作答 ----
// 答對：今天第一次答對先記下來；在不同的天再答對一次才升級（記憶是每一級的條件）
export function answer(run, q, ok) {
  const w = word(q.lemma), d = today(), res = { ok, levelUp: null, pending: false, tile: false, master: false };
  w.last = now();
  if (q.sentence) w.seen = [...new Set([...(w.seen || []), q.sentence.id])];
  run.log.push({ lemma: q.lemma, lv: q.lv, ok, kind: q.kind });
  if (!ok) {
    // 答錯：這一局稍後再出一次
    if (!run.retried.has(q.lemma)) { run.retried.add(q.lemma); run.queue.splice(Math.min(run.pos + 3, run.queue.length), 0, q.lemma); }
  } else if (!q.extra) {
    if (w.okDay != null && w.okDay < d) levelUp(run, q.lemma, w, res);
    else { w.okDay = d; res.pending = true; }
  }
  save();
  return res;
}
function levelUp(run, lemma, w, res) {
  delete w.okDay;
  if (w.lv === 5) { w.master = true; res.master = true; return; }
  w.lv++;
  run.queue.push(lemma);   // 這一局稍後接著做下一級
  res.levelUp = w.lv;
  if (w.lv === 2) { run.newTiles.push(lemma); res.tile = true; }
}
// Lv2：寫下理解就完成，馬上到 Lv3
export function saveUnderstanding(run, lemma, parts) {
  const w = word(lemma);
  w.mine = [...(w.mine || []), { t: now(), parts }];
  w.last = now();
  const res = { ok: true, levelUp: null };
  if (w.lv === 2) { w.lv = 3; delete w.okDay; res.levelUp = 3; run?.queue.push(lemma); }
  run?.log.push({ lemma, lv: 2, ok: true, kind: 'understand' });
  save();
  return res;
}
