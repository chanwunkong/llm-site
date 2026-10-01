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

function parseToken(raw) {
  const [surface, upos, lemma, feats] = raw.split('|');
  return {
    surface,
    upos,
    lemma: lemma || surface.toLowerCase(),
    feats: Object.fromEntries((feats || '').split(';').filter(Boolean).map(f => f.split('='))),
  };
}

// 句子顯示：依語言設定檔的 joiner 串接；標點前不加空白
export function joinTokens(tokens, joiner) {
  let out = '';
  tokens.forEach((t, i) => {
    const s = typeof t === 'string' ? t : t.surface;
    const punct = typeof t !== 'string' && t.upos === 'PUNCT';
    out += (i === 0 || punct ? '' : joiner) + s;
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
