// 內容處理：解析標註好的句子、建立詞元索引、統計語塊。
// 這裡的邏輯只依賴 UD 詞性與詞元，不含任何語言專屬規則。

// UD 封閉詞類與標點：不佔領土格子
const CLOSED = new Set(['DET', 'ADP', 'PRON', 'AUX', 'CCONJ', 'SCONJ', 'PART']);
const NON_WORD = new Set(['PUNCT', 'SYM', 'X']);
const CONTENT = new Set(['NOUN', 'PROPN', 'VERB', 'ADJ', 'ADV', 'INTJ', 'NUM']);

export const isWord = t => !NON_WORD.has(t.upos);
export const isContent = t => CONTENT.has(t.upos) && t.upos !== 'NUM' && t.upos !== 'PROPN';
export const isFunction = t => CLOSED.has(t.upos);
// 可以出題的字：實詞與功能詞（專有名詞、數字不出題）
export const isTarget = t => isContent(t) || isFunction(t);

// 「寫法|UPOS|詞元|特徵|n」：第 5 欄 n 表示後面不空格（匯入時由標註工具提供）
function parseToken(raw) {
  const [surface, upos, lemma, feats, misc] = raw.split('|');
  return {
    surface,
    upos,
    lemma: lemma || surface.toLowerCase(),
    feats: Object.fromEntries((feats || '').split(';').filter(Boolean).map(f => f.split('='))),
    nsa: misc === 'n',
    sa: misc === 's',
  };
}

// 句子顯示：依語言設定檔的 joiner 串接。標點前、開引號或開括號後、以撇號開頭的附著詞（’m、's）前不加空白
const OPENING = /^[“‘"'(\[「『（¿¡«„]$/u;
// 第 i 個字前面要放的分隔（和 joinTokens 的規則相同），給逐字畫句子的畫面使用
export function spaceBefore(tokens, i, joiner) {
  if (i === 0) return '';
  const t = tokens[i], p = tokens[i - 1];
  if (p.sa) return ' ';
  const punct = t.upos === 'PUNCT' && !OPENING.test(t.surface);
  return punct || OPENING.test(p.surface) || /^[’']/.test(t.surface) || p.nsa ? '' : joiner;
}

export function joinTokens(tokens, joiner) {
  let out = '', prev = null, prevNsa = false, prevSa = false;
  tokens.forEach((t, i) => {
    const s = typeof t === 'string' ? t : t.surface;
    const punct = typeof t !== 'string' && t.upos === 'PUNCT' && !OPENING.test(s);
    const glue = i === 0 || punct || OPENING.test(prev) || /^[’']/.test(s) || prevNsa;
    out += (prevSa && i > 0 ? ' ' : glue ? '' : joiner) + s;
    prev = s;
    prevNsa = typeof t !== 'string' && t.nsa;
    prevSa = typeof t !== 'string' && t.sa;
  });
  return out;
}

// base：基礎單字集（詞元 → 概念與圖示），由 data/concepts/build_base.py 產生
export function buildLanguage(data, base = {}) {
  const sentences = [];
  const situations = [];
  const lemmas = new Map(); // lemma -> { lemma, upos, content, forms:Set, freq, sentences:[] , home }
  for (const src of data.sources) {
    src.situations.forEach((sit, si) => {
      const sitObj = { key: `${src.id}#${si}`, source: src.id, index: si, title: sit.title, sentences: [], lemmas: new Set() };
      for (const raw of sit.sentences) {
        const tokens = raw.split(' ').map(parseToken);
        const s = { id: sentences.length, sit: sitObj.key, tokens };
        sentences.push(s);
        sitObj.sentences.push(s.id);
        tokens.forEach((t, i) => {
          if (!isWord(t)) return;
          let L = lemmas.get(t.lemma);
          if (!L) {
            L = { lemma: t.lemma, upos: t.upos, content: isContent(t), target: isTarget(t), forms: new Set(), midForms: new Set(), freq: 0, sentences: [], home: sitObj.key };
            lemmas.set(t.lemma, L);
          }
          if (isContent(t)) L.content = true;
          if (isTarget(t)) L.target = true;
          L.forms.add(t.surface);
          if (i > 0) L.midForms.add(t.surface);
          L.freq++;
          if (L.sentences.at(-1) !== s.id) L.sentences.push(s.id);
          sitObj.lemmas.add(t.lemma);
        });
      }
      situations.push(sitObj);
    });
  }
  const lang = { ...data, base, sentences, situations, lemmas };
  lang.chunks = mineChunks(lang);
  mineFormulas(lang);
  return lang;
}

// 語塊：同一句中相鄰的實詞（中間只隔功能詞，最多 2 個），以詞元統計出現次數
export function mineChunks(lang) {
  const counts = new Map();
  for (const s of lang.sentences) {
    const idx = [];
    s.tokens.forEach((t, i) => { if (isContent(t)) idx.push(i); });
    const linked = (a, b) => {
      if (b - a - 1 > 2) return false;
      for (let k = a + 1; k < b; k++) if (!isFunction(s.tokens[k])) return false;
      return true;
    };
    for (let n = 2; n <= 3; n++) {
      for (let i = 0; i + n <= idx.length; i++) {
        const span = idx.slice(i, i + n);
        let ok = true;
        for (let k = 0; k < n - 1; k++) if (!linked(span[k], span[k + 1])) ok = false;
        if (!ok) continue;
        const ls = span.map(j => s.tokens[j].lemma);
        if (new Set(ls).size !== ls.length) continue;
        const key = ls.join(' ');
        const c = counts.get(key) || { lemmas: ls, count: 0, example: s.id };
        c.count++;
        counts.set(key, c);
      }
    }
  }
  return [...counts.values()].filter(c => c.count >= 2);
}

// ---- 語塊（固定說法）：2～5 個字的高頻組合，包含功能詞，例如 at the end of the day、could you please ----
// 只用統計，不分語言：以字典形計數（made a wish = make a wish），不跨標點；
// 出現次數夠多、而且一起出現的機率遠高於偶然（每個切分點的 PMI 都夠高）；至少含一個實詞；
// 不含專有名詞（人名、地名不是可以套用的說法）；「冠詞／助詞＋單一名詞」是文法規則的範圍，不算語塊；
// 邊界要完整：後面緊接助動詞或專有名詞時不算（ありまし｜た、you have｜been、the Cowardly｜Lion），不以冠詞結尾；
// 字與字不空格的語言（中文、日文、泰文），附著的字（助詞、助動詞、て）不能放在開頭，也不能被切在後面；
// 長語塊和裡面的短語塊次數差不多時只留長的。結果：lang.formulas、lang.formulaSpans（句子 → 出現位置）
export const FORMULA = { minLen: 2, maxLen: 5, minPmi: 3, keepRatio: 0.8 };
export function mineFormulas(lang) {
  const key = t => t.lemma.toLocaleLowerCase();
  const bound = lang.joiner === '', BOUND = new Set(['ADP', 'AUX', 'PART', 'SCONJ']);
  const counts = new Map(), first = new Map();
  let N = 0;
  const segments = s => {   // 不跨標點的連續字
    const out = [];
    let cur = [];
    s.tokens.forEach((t, i) => { if (isWord(t)) cur.push(i); else { if (cur.length) out.push(cur); cur = []; } });
    if (cur.length) out.push(cur);
    return out;
  };
  for (const s of lang.sentences)
    for (const seg of segments(s)) {
      N += seg.length;
      for (let i = 0; i < seg.length; i++)
        for (let n = 1; n <= FORMULA.maxLen && i + n <= seg.length; n++) {
          const idx = seg.slice(i, i + n), k = idx.map(j => key(s.tokens[j])).join(' ');
          const next = s.tokens[idx.at(-1) + 1]?.upos;
          if (n > 1 && (next === 'AUX' || next === 'PROPN' || (bound && BOUND.has(next)))) continue;
          counts.set(k, (counts.get(k) || 0) + 1);
          if (n > 1 && !first.has(k)) first.set(k, idx.map(j => s.tokens[j]));
        }
    }
  const minCount = lang.sentences.length >= 300 ? 3 : 2;
  const pmi = k => {
    const w = k.split(' '), c = counts.get(k);
    let min = Infinity;
    for (let cut = 1; cut < w.length; cut++) {
      const l = counts.get(w.slice(0, cut).join(' ')), r = counts.get(w.slice(cut).join(' '));
      min = Math.min(min, Math.log2((c * N) / (l * r)));
    }
    return min;
  };
  const shapeOk = ts => {
    if (ts.some(t => t.upos === 'PROPN') || ts.at(-1).upos === 'DET' || (bound && BOUND.has(ts[0].upos))) return false;
    const content = ts.filter(isContent);
    return content.length > 0 && !(content.length === 1 && content[0].upos === 'NOUN');
  };
  let cands = [...first.keys()].filter(k => counts.get(k) >= minCount && shapeOk(first.get(k)) && pmi(k) >= FORMULA.minPmi);
  // 只留最長的：被更長的語塊包含、而且次數差不多的短語塊拿掉
  cands = cands.filter(k => !cands.some(o => o !== k && o.length > k.length && (' ' + o + ' ').includes(' ' + k + ' ') && counts.get(o) >= FORMULA.keepRatio * counts.get(k)));
  const set = new Set(cands);
  lang.formulas = cands.map(k => ({ key: k, count: counts.get(k), tokens: first.get(k).map(t => t.surface) })).sort((a, b) => b.count - a.count);
  // 每句裡的出現位置：長的優先，不重疊
  lang.formulaSpans = new Map();
  for (const s of lang.sentences) {
    const found = [];
    for (const seg of segments(s))
      for (let n = FORMULA.maxLen; n >= FORMULA.minLen; n--)
        for (let i = 0; i + n <= seg.length; i++) {
          const idx = seg.slice(i, i + n);
          if (!set.has(idx.map(j => key(s.tokens[j])).join(' '))) continue;
          if (found.some(f => !(idx.at(-1) < f[0] || idx[0] > f.at(-1)))) continue;
          found.push(idx);
        }
    if (found.length) lang.formulaSpans.set(s.id, found);
  }
}
