// 在手機上產生每個字的音標（IPA），再依這個語言的音位清單（PHOIBLE）切成一個一個的音。
// 方法與 data/phonology/build_phonology.py 相同（內建文章的音標由它在電腦上產生）。日文用斷詞工具的讀音（假名）轉 IPA。
import { INVENTORIES } from '../data/phonology.js';
import { LANG_BY_ID } from '../data/langs.js';
import { norm } from './phono.js';
import * as ES from './espeak.js';

// 不同工具對同一個音的寫法差異（只用在切音）
const EQUIV = { ɹ: ['ɻ', 'r'], ɻ: ['ɹ', 'r'], e: ['ɛ', 'eɪ'], ɛ: ['e'], o: ['ɔ', 'oʊ'], ɔ: ['o', 'ɑ'], a: ['ɑ'], ɑ: ['a'],
  ʌ: ['ɐ', 'ə'], ɐ: ['ə', 'ʌ'], ɚ: ['ə'], ɜ: ['ə', 'ɚ'], i: ['iɪ', 'ɪ'], u: ['ʊ', 'ɯ'], ᵻ: ['ɪ'], ɾ: ['tʰ', 'd'],
  ɕ: ['s', 'ʃ'], ʑ: ['z', 'ʒ'], ɸ: ['h', 'f'], ç: ['h'], ɲ: ['n'] };
// eSpeak 有些語言（例如吉爾吉斯語）用 ASCII 名稱寫音
const FOLD = [['tS', 'tʃ'], ['dZ', 'dʒ'], ['S', 'ʃ'], ['Z', 'ʒ'], ['N', 'ŋ'], ['X', 'χ']];

export function segment(ipa, inv) {
  const byNorm = new Map();
  for (const x of [...inv].sort((a, b) => a.length - b.length)) if (!byNorm.has(norm(x))) byNorm.set(norm(x), x);
  const invSet = new Set(inv);
  const tokens = [...new Set([...inv, ...byNorm.keys()])].sort((a, b) => b.length - a.length);
  const segs = [];
  let i = 0;
  while (i < ipa.length) {
    const t = tokens.find(tk => tk && ipa.startsWith(tk, i));
    if (t) { segs.push(invSet.has(t) ? t : byNorm.get(t)); i += t.length; continue; }
    const c = ipa[i++];
    if (c === 'ː') continue;
    segs.push(byNorm.get(norm(c)) || byNorm.get(c + 'ʰ') || (EQUIV[c] || []).map(e => byNorm.get(norm(e))).find(Boolean) || c);
  }
  return segs;
}
const clean = s => FOLD.reduce((x, [a, b]) => x.split(a).join(b), s.replace(/[ˈˌ‍_\-[\]()0-9]/g, '')).trim();

// words：同一個語言的字（不重複）；回傳 {字（小寫）: [音…]}
export async function forWords(words, langId, progress = () => {}) {
  const lang = LANG_BY_ID[langId], inv = INVENTORIES[lang?.wals] || [];
  if (!lang?.espeak || !inv.length || !words.length) return {};
  const out = {}, B = 60;
  for (let i = 0; i < words.length; i += B) {
    progress(`產生音標（${Math.min(i + B, words.length)} / ${words.length}）`);
    const part = words.slice(i, i + B);
    let got = await phonemes(part, lang.espeak);
    // 一次送多個字時，eSpeak 的輸出以空格分開；數量對不上就改成一個一個送
    if (got.length !== part.length) got = await Promise.all(part.map(async w => (await phonemes([w], lang.espeak)).join('')));
    part.forEach((w, k) => { if (got[k]) out[w.toLocaleLowerCase()] = segment(clean(got[k]), inv); });
  }
  return out;
}
async function phonemes(words, voice) {
  const es = await ES.run(['--phonout', '/ph.txt', '-q', '--ipa=3', '-v', voice, words.join('\n')]);
  return es.FS.readFile('/ph.txt', { encoding: 'utf8' }).replace(/\n/g, ' ').trim().split(/\s+/).filter(Boolean);
}

// ---- 日文：片假名讀音 → IPA ----
const KANA = {};
const row = (cons, kana, vowels = ['a', 'i', 'ɯ', 'e', 'o']) => [...kana].forEach((k, n) => { if (k !== '・') KANA[k] = cons + vowels[n]; });
row('', 'アイウエオ'); row('k', 'カキクケコ'); row('s', 'サ・スセソ'); row('t', 'タ・・テト'); row('n', 'ナニヌネノ');
row('h', 'ハ・・ヘホ'); row('m', 'マミムメモ'); row('j', 'ヤ・ユ・ヨ'); row('ɾ', 'ラリルレロ'); row('w', 'ワ・・・ヲ');
row('ɡ', 'ガギグゲゴ'); row('z', 'ザ・ズゼゾ'); row('d', 'ダ・・デド'); row('b', 'バビブベボ'); row('p', 'パピプペポ');
Object.assign(KANA, { シ: 'ɕi', チ: 'tɕi', ツ: 'tsɯ', ヒ: 'çi', フ: 'ɸɯ', ジ: 'dʑi', ヂ: 'dʑi', ヅ: 'zɯ', ヲ: 'o', ン: 'ɴ', ヴ: 'vɯ' });
const SMALL = { ャ: 'a', ュ: 'ɯ', ョ: 'o', ァ: 'a', ィ: 'i', ゥ: 'ɯ', ェ: 'e', ォ: 'o' };
const PALATAL = { キ: 'kʲ', ギ: 'ɡʲ', シ: 'ɕ', ジ: 'dʑ', チ: 'tɕ', ニ: 'ɲ', ヒ: 'ç', ビ: 'bʲ', ピ: 'pʲ', ミ: 'mʲ', リ: 'ɾʲ' };
export function kanaToIpa(kata) {
  let out = '';
  const k = [...kata];
  for (let i = 0; i < k.length; i++) {
    const c = k[i], next = k[i + 1];
    if (SMALL[next] && PALATAL[c]) { out += PALATAL[c] + SMALL[next]; i++; continue; }
    if (c === 'ッ') { const n = KANA[next]; if (n) out += n[0]; continue; }      // 促音：下一個子音重複
    if (c === 'ー') { out += 'ː'; continue; }
    out += KANA[c] || SMALL[c] || '';
  }
  return out;
}
export function forJapanese(pairs) {   // pairs：[[寫法, 片假名讀音], …]
  const inv = INVENTORIES.jpn || [], out = {};
  for (const [w, r] of pairs) if (r && r !== '*') out[w.toLocaleLowerCase()] = segment(kanaToIpa(r), inv);
  return out;
}
