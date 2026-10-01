// IPA 表格的位置：依國際語音學會（IPA）的標準表格排列
// 子音：發音方法 × 發音部位 × 清濁；母音：舌位高低 × 前後 × 圓展
import { norm } from './phono.js';

export const PLACES = [
  ['bilabial', '雙唇'], ['labiodental', '唇齒'], ['dental', '齒'], ['alveolar', '齒齦'], ['postalveolar', '齦後'],
  ['alveolopalatal', '齦顎'], ['retroflex', '捲舌'], ['palatal', '硬顎'], ['velar', '軟顎'], ['uvular', '小舌'],
  ['pharyngeal', '咽'], ['glottal', '聲門'],
];
export const MANNERS = [
  ['plosive', '塞音'], ['nasal', '鼻音'], ['trill', '顫音'], ['tap', '閃音'], ['fricative', '擦音'],
  ['affricate', '塞擦音'], ['latfric', '邊擦音'], ['approximant', '近音'], ['latapprox', '邊近音'],
];
export const HEIGHTS = [['close', '高'], ['nearclose', '次高'], ['closemid', '半高'], ['mid', '中'], ['openmid', '半低'], ['nearopen', '次低'], ['open', '低']];
export const BACKS = [['front', '前'], ['central', '央'], ['back', '後']];

// 基本符號 → [方法, 部位, 濁音?]
const C = {};
const put = (manner, place, voiceless, voiced) => {
  for (const s of [].concat(voiceless || [])) C[s] = [manner, place, false];
  for (const s of [].concat(voiced || [])) C[s] = [manner, place, true];
};
put('plosive', 'bilabial', 'p', 'b'); put('plosive', 'alveolar', 't', 'd'); put('plosive', 'retroflex', 'ʈ', 'ɖ');
put('plosive', 'palatal', 'c', 'ɟ'); put('plosive', 'velar', 'k', ['ɡ', 'g']); put('plosive', 'uvular', 'q', 'ɢ'); put('plosive', 'glottal', 'ʔ');
put('nasal', 'bilabial', null, 'm'); put('nasal', 'labiodental', null, 'ɱ'); put('nasal', 'alveolar', null, 'n'); put('nasal', 'retroflex', null, 'ɳ');
put('nasal', 'palatal', null, 'ɲ'); put('nasal', 'velar', null, 'ŋ'); put('nasal', 'uvular', null, 'ɴ');
put('trill', 'bilabial', null, 'ʙ'); put('trill', 'alveolar', null, 'r'); put('trill', 'uvular', null, 'ʀ');
put('tap', 'labiodental', null, 'ⱱ'); put('tap', 'alveolar', null, 'ɾ'); put('tap', 'retroflex', null, 'ɽ');
put('fricative', 'bilabial', 'ɸ', 'β'); put('fricative', 'labiodental', 'f', 'v'); put('fricative', 'dental', 'θ', 'ð');
put('fricative', 'alveolar', 's', 'z'); put('fricative', 'postalveolar', 'ʃ', 'ʒ'); put('fricative', 'alveolopalatal', 'ɕ', 'ʑ');
put('fricative', 'retroflex', 'ʂ', 'ʐ'); put('fricative', 'palatal', 'ç', 'ʝ'); put('fricative', 'velar', 'x', 'ɣ');
put('fricative', 'uvular', 'χ', 'ʁ'); put('fricative', 'pharyngeal', 'ħ', 'ʕ'); put('fricative', 'glottal', 'h', 'ɦ');
put('affricate', 'labiodental', 'pf'); put('affricate', 'alveolar', 'ts', 'dz'); put('affricate', 'postalveolar', 'tʃ', 'dʒ');
put('affricate', 'alveolopalatal', 'tɕ', 'dʑ'); put('affricate', 'retroflex', 'ʈʂ', 'ɖʐ');
put('latfric', 'alveolar', 'ɬ', 'ɮ');
put('approximant', 'bilabial', 'ʍ', 'w'); put('approximant', 'labiodental', null, 'ʋ'); put('approximant', 'alveolar', null, 'ɹ');
put('approximant', 'retroflex', null, 'ɻ'); put('approximant', 'palatal', null, ['j', 'ɥ']); put('approximant', 'velar', null, 'ɰ');
put('latapprox', 'alveolar', null, 'l'); put('latapprox', 'retroflex', null, 'ɭ'); put('latapprox', 'palatal', null, 'ʎ'); put('latapprox', 'velar', null, 'ʟ');

// 母音 → [高低, 前後, 圓唇?]
const V = {};
const vow = (h, b, unround, round) => { if (unround) V[unround] = [h, b, false]; if (round) V[round] = [h, b, true]; };
vow('close', 'front', 'i', 'y'); vow('close', 'central', 'ɨ', 'ʉ'); vow('close', 'back', 'ɯ', 'u');
vow('nearclose', 'front', 'ɪ', 'ʏ'); vow('nearclose', 'back', null, 'ʊ');
vow('closemid', 'front', 'e', 'ø'); vow('closemid', 'central', 'ɘ', 'ɵ'); vow('closemid', 'back', 'ɤ', 'o');
vow('mid', 'central', 'ə', null); V['ɚ'] = ['mid', 'central', false];
vow('openmid', 'front', 'ɛ', 'œ'); vow('openmid', 'central', 'ɜ', 'ɞ'); vow('openmid', 'back', 'ʌ', 'ɔ');
vow('nearopen', 'front', 'æ', null); vow('nearopen', 'central', 'ɐ', null);
vow('open', 'front', 'a', 'ɶ'); vow('open', 'back', 'ɑ', 'ɒ');

// 去掉附加符號、長音、送氣、顎化等，只留基本符號（用來決定位置）
export const base = s => norm(s).replace(/[ʰʲʷˠˤⁿˡ˞ʼ]/g, '');

// 回傳 { kind: 'consonant'|'vowel'|'diphthong'|'other', ... }
export function position(seg) {
  const b = base(seg);
  if (C[b]) { const [manner, place, voiced] = C[b]; return { kind: 'consonant', manner, place, voiced }; }
  if (V[b]) { const [height, back, round] = V[b]; return { kind: 'vowel', height, back, round }; }
  // 多母音（雙母音、三合母音）：依序列出每個組成母音的位置，畫箭頭用
  if ([...b].length > 1 && [...b].every(c => V[c]))
    return { kind: 'diphthong', parts: [...b].map(c => ({ c, height: V[c][0], back: V[c][1], round: V[c][2] })) };
  return { kind: 'other' };
}
