// 匯入：在網頁上把一篇文章拆成來源（情境 → 句子 → 每個字的 UD 詞性、詞元、詞形特徵）。
// 與 data/sources/decompose.py 的輸出格式相同。依語言用三種方式標註（見 data/langs.js 的 tagger）：
//   udpipe   UDPipe 線上服務（UD 模型），需要連網
//   kuromoji 瀏覽器內的日文斷詞，再把日文詞類對應到 UD（對應規則與 decompose.py 相同）
//   basic    瀏覽器內建的斷詞（Intl.Segmenter），沒有詞性；所有字都當成要學的字，規則不啟動
// 匯入的內容只存在這個瀏覽器裡。
const UDPIPE = 'https://lindat.mff.cuni.cz/services/udpipe/api/process';
const KUROMOJI = 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/';
const STORE_KEY = 'word-territory-imports-v1';

const SIT_SIZE = 35;                      // 每個情境約 35 句
const MIN_WORDS = 3;
const maxWords = lang => (lang.joiner === '' ? 32 : 22);
const CONTENT = new Set(['NOUN', 'VERB', 'ADJ', 'ADV', 'INTJ']);

// ---- 存取 ----
function readAll() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; } }
export const importsOf = langId => readAll()[langId] || [];
export function saveImport(langId, src) {
  const all = readAll();
  all[langId] = [...(all[langId] || []), src];
  try { localStorage.setItem(STORE_KEY, JSON.stringify(all)); }
  catch { throw new Error('瀏覽器的儲存空間不夠，請先刪除一些匯入的文章'); }
}
export function removeImport(langId, srcId) {
  const all = readAll();
  all[langId] = (all[langId] || []).filter(s => s.id !== srcId);
  try { localStorage.setItem(STORE_KEY, JSON.stringify(all)); } catch {}
}

// ---- 句子編碼：「寫法|UPOS|詞元|特徵|n」，n = 後面不空格 ----
const clean = s => String(s).replace(/\|/g, '').replace(/ /g, ' ');
function encode(w) {
  const surface = clean(w.form), lemma = clean(w.lemma || w.form);
  const parts = [surface, w.upos, lemma !== surface.toLowerCase() ? lemma : '', w.feats || '', w.nsa ? 'n' : ''];
  while (parts.length > 2 && !parts.at(-1)) parts.pop();
  return parts.join('|');
}

// ---- UDPipe：把 CoNLL-U 轉成句子（多字詞，例如西班牙文 del = de + el，合成一個字，以實詞為主） ----
function parseConllu(text) {
  const sents = [];
  let cur = [], range = null;
  const flush = () => { if (cur.length) sents.push(cur); cur = []; };
  for (const line of text.split('\n')) {
    if (!line.trim()) { flush(); continue; }
    if (line.startsWith('#')) continue;
    const c = line.split('\t');
    const nsa = /SpaceAfter=No/.test(c[9] || '');
    if (c[0].includes('-')) { const [a, b] = c[0].split('-').map(Number); range = { a, b, form: c[1], nsa, words: [] }; continue; }
    if (c[0].includes('.')) continue;
    const w = { form: c[1], lemma: c[2] === '_' ? c[1] : c[2], upos: c[3], feats: c[5] === '_' ? '' : c[5].replace(/\|/g, ';'), nsa };
    const id = Number(c[0]);
    if (range && id >= range.a && id <= range.b) {
      range.words.push(w);
      if (id === range.b) {
        const head = range.words.find(x => CONTENT.has(x.upos)) || range.words[0];
        const feats = new Map();
        for (const x of [head, ...range.words]) for (const f of x.feats.split(';').filter(Boolean)) { const [k] = f.split('='); if (!feats.has(k)) feats.set(k, f); }
        cur.push({ form: range.form, lemma: head.lemma, upos: head.upos, feats: [...feats.values()].join(';'), nsa: range.nsa });
        range = null;
      }
      continue;
    }
    cur.push(w);
  }
  flush();
  return sents;
}

// 長文分段送出，避免單次請求太大
function chunks(paras, max = 6000) {
  const out = [];
  let cur = '';
  for (const p of paras) {
    if (cur && cur.length + p.length > max) { out.push(cur); cur = ''; }
    cur += (cur ? '\n\n' : '') + p;
  }
  if (cur) out.push(cur);
  return out;
}

async function udpipe(lang, paras, progress) {
  const parts = chunks(paras), out = [];
  for (const [i, data] of parts.entries()) {
    progress(`標註中（${i + 1} / ${parts.length}）`);
    const body = new URLSearchParams({ model: lang.model, tokenizer: '', tagger: '', data });
    const r = await fetch(UDPIPE, { method: 'POST', body });
    if (!r.ok) throw new Error(`UDPipe 服務回應錯誤（${r.status}）`);
    out.push(...parseConllu((await r.json()).result));
  }
  return out;
}

// ---- 日文：kuromoji（IPA 辭書）→ UD ----
let kuroP = null;
function kuromojiTokenizer(progress) {
  if (kuroP) return kuroP;
  progress('下載日文斷詞字典（約 17 MB，只需一次）');
  kuroP = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = KUROMOJI + 'build/kuromoji.js';
    s.onload = () => window.kuromoji.builder({ dicPath: KUROMOJI + 'dict/' }).build((err, t) => (err ? reject(err) : resolve(t)));
    s.onerror = () => reject(new Error('無法下載日文斷詞工具'));
    document.head.appendChild(s);
  });
  kuroP.catch(() => (kuroP = null));
  return kuroP;
}
const JA_DEM = new Set(['この', 'その', 'あの', 'どの', 'これ', 'それ', 'あれ', 'どれ', 'ここ', 'そこ', 'あそこ', 'どこ']);
function jaUpos(t) {
  const pos = t.pos, g1 = t.pos_detail_1;
  if (pos === '名詞') return { 代名詞: 'PRON', 固有名詞: 'PROPN', 数: 'NUM' }[g1] || 'NOUN';
  if (pos === '動詞') return g1 === '非自立' || g1 === '接尾' ? 'AUX' : 'VERB';
  if (pos === '形容詞') return g1 === '非自立' ? 'AUX' : 'ADJ';
  if (pos === '助詞') return { 接続助詞: 'SCONJ', 終助詞: 'PART' }[g1] || 'ADP';
  return { 副詞: 'ADV', 連体詞: 'DET', 接続詞: 'CCONJ', 感動詞: 'INTJ', 助動詞: 'AUX', 記号: 'PUNCT', 接頭詞: 'PART', フィラー: 'INTJ' }[pos] || 'X';
}
async function kuromoji(lang, paras, progress) {
  const tk = await kuromojiTokenizer(progress);
  progress('斷詞中');
  const text = paras.join('');
  return (text.match(/.+?(?:[。！？]」?|$)/gu) || []).map(s => s.trim()).filter(Boolean).map(sent =>
    tk.tokenize(sent).map(t => {
      const upos = jaUpos(t), f = [];
      if (t.pos === '助動詞' && t.conjugated_type === '特殊・タ') f.push('Tense=Past');
      if (t.pos === '助動詞' && ['特殊・ナイ', '特殊・ヌ'].includes(t.conjugated_type)) f.push('Polarity=Neg');
      if (JA_DEM.has(t.surface_form)) f.push('PronType=Dem');
      return { form: t.surface_form, lemma: t.basic_form && t.basic_form !== '*' ? t.basic_form : t.surface_form, upos, feats: f.join(';') };
    }));
}

// ---- 沒有 UD 模型的語言：瀏覽器內建斷詞 ----
function basic(lang, paras) {
  const sentSeg = new Intl.Segmenter(lang.bcp47, { granularity: 'sentence' });
  const wordSeg = new Intl.Segmenter(lang.bcp47, { granularity: 'word' });
  const out = [];
  for (const p of paras)
    for (const { segment } of sentSeg.segment(p)) {
      const segs = [...wordSeg.segment(segment.trim())], words = [];
      segs.forEach((s, i) => {
        if (!s.segment.trim()) return;
        const nsa = !(segs[i + 1] && !segs[i + 1].segment.trim());
        words.push({ form: s.segment, lemma: s.segment.toLocaleLowerCase(lang.bcp47), upos: s.isWordLike ? 'NOUN' : 'PUNCT', feats: '', nsa });
      });
      if (words.length) out.push(words);
    }
  return out;
}

// ---- 主程式 ----
export async function importText(lang, title, text, progress = () => {}) {
  // 段落：空行分段；段內換行接起來（有空格的語言補空格）
  const paras = text.replace(/\r/g, '').split(/\n\s*\n/)
    .map(p => p.split('\n').map(l => l.trim()).filter(Boolean).join(lang.joiner === '' ? '' : ' '))
    .filter(Boolean);
  if (!paras.length) throw new Error('沒有內容');
  const sents = lang.tagger === 'udpipe' ? await udpipe(lang, paras, progress)
    : lang.tagger === 'kuromoji' ? await kuromoji(lang, paras, progress)
    : basic(lang, paras);
  progress('整理句子');
  const keep = sents.filter(ws => {
    const n = ws.filter(w => !['PUNCT', 'SYM', 'X'].includes(w.upos)).length;
    return n >= MIN_WORDS && n <= maxWords(lang);
  }).map(ws => ws.map(encode).join(' '));
  if (keep.length < 5) throw new Error(`可以出題的句子太少（${keep.length} 句）。文章可能太短，或句子都太長`);
  const k = Math.max(1, Math.round(keep.length / SIT_SIZE)), size = Math.ceil(keep.length / k);
  const situations = Array.from({ length: k }, (_, i) => ({ title: k === 1 ? title : `${title}（${i + 1}/${k}）`, sentences: keep.slice(i * size, (i + 1) * size) }))
    .filter(s => s.sentences.length);
  const src = { id: `imp-${Date.now().toString(36)}`, kind: '匯入', title, credit: `你匯入的內容・${keep.length} 句（略過 ${sents.length - keep.length} 句太長或太短）`, imported: true, situations };
  saveImport(lang.id, src);
  return src;
}
