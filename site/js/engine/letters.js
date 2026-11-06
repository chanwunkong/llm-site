// 字母上色用：把字的每個字母對到評分服務回傳的音（ELSA 式的字母上色）
// 對應表 data/letters/<語言>.json 由 data/phonology/build_letters.py 產生（eSpeak NG + EM 對齊）。
// 沒有對應表的語言（中文、日文等）用通用規則：每個字母對到差不多一樣多的音。
const V = new URL(import.meta.url).search;
const MODS = new Set('ːˑʰʲʷˠˤⁿˡ˞ʼ');
const tables = {};
const STEP = 7;   // 每一步加分：不加的話，步數少（兩個字母綁一起）的路徑總會贏

async function table(lang) {
  if (!(lang in tables)) tables[lang] = fetch(`data/letters/${lang}.json${V}`).then(r => (r.ok ? r.json() : null)).catch(() => null);
  return tables[lang];
}

// 和 build_letters.py 一樣切音段：基本符號加上後面的附加符號
function segs(ipa) {
  const out = [];
  for (const c of ipa.normalize('NFD')) {
    if (/[\d\sˈˌ‍_.\-]/.test(c)) continue;
    if (out.length && (MODS.has(c) || /\p{Mn}/u.test(c))) out[out.length - 1] += c;
    else out.push(c);
  }
  return out.map(s => s.normalize('NFC'));
}
const graphemes = word => [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(word)].map(s => s.segment);
const isLetter = g => /\p{L}/u.test(g);

// word：要顯示的字；tokens：服務回傳的每個音（ipa 陣列）。
// 回傳 [{ text, toks: [音的索引…] }]，依序拼起來就是原本的字；對不起來時回傳 null（只在音標上色）
export async function align(lang, word, tokens) {
  const t = await table(lang);
  const g = graphemes(word), gl = g.map(x => x.toLowerCase());
  const s = [], owner = [];
  tokens.forEach((tok, k) => segs(tok).forEach(x => { s.push(x); owner.push(k); }));
  const n = g.length, m = s.length;
  if (!n || !m) return null;
  const pairs = t?.pairs || {}, maxG = t?.maxG || 1, K = Math.max(t?.K || 0, Math.ceil(m / Math.max(1, g.filter(isLetter).length)) + 1);
  const avg = m / Math.max(1, g.filter(isLetter).length);
  // 一步的分數：表上有就用表上的機率；沒有就依「每個字母平均幾個音」給一個很低的分數，讓它還是對得起來
  const cost = (gi, a, sj, b) => {
    const gs = gl.slice(gi, gi + a);
    if (!gs.every(isLetter)) return a === 1 && b === 0 ? 0 : -Infinity;   // 空白、撇號等不發音
    const v = pairs[`${gs.join('')}\t${s.slice(sj, sj + b).join(' ')}`];
    if (v !== undefined) return v + STEP;
    return (t ? -20 : -2) - 2 * Math.abs(b - avg * a) - (a - 1) * 4;
  };
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(-Infinity)), back = Array.from({ length: n + 1 }, () => new Array(m + 1));
  dp[0][0] = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= m; j++) {
      if (dp[i][j] === -Infinity) continue;
      for (let a = 1; a <= maxG && i + a <= n; a++)
        for (let b = 0; b <= K && j + b <= m; b++) {
          const v = dp[i][j] + cost(i, a, j, b);
          if (v > dp[i + a][j + b]) { dp[i + a][j + b] = v; back[i + a][j + b] = [a, b]; }
        }
    }
  if (dp[n][m] === -Infinity) return null;
  const chunks = [];
  for (let i = n, j = m; i > 0;) {
    const [a, b] = back[i][j];
    chunks.unshift({ text: g.slice(i - a, i).join(''), toks: [...new Set(owner.slice(j - b, j))], letter: g.slice(i - a, i).some(isLetter) });
    i -= a; j -= b;
  }
  // 不發音的字母跟著前一個（開頭的話是後一個）音上色
  chunks.forEach((c, i) => {
    if (c.toks.length || !c.letter) return;
    const near = chunks.slice(0, i).reverse().find(x => x.toks.length) || chunks.slice(i + 1).find(x => x.toks.length);
    if (near) c.toks = near.toks;
  });
  return chunks.map(({ text, toks }) => ({ text, toks }));
}
