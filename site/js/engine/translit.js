// 替代朗讀：把文字轉成「相近語言」的聲音唸得出來的字母。只處理字母，其他字元照原樣。
// 吉爾吉斯文（西里爾字母）→ 土耳其文字母：兩者都是突厥語，母音和諧與多數音相同。
const KY_TR = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ё: 'yo', ж: 'c', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', ң: 'n',
  о: 'o', ө: 'ö', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ү: 'ü', ф: 'f', х: 'h', ц: 'ts', ч: 'ç', ш: 'ş', щ: 'şç',
  ъ: '', ы: 'ı', ь: '', э: 'e', ю: 'yu', я: 'ya',
};
const VOWELS = 'аеёиоөуүыэюяaeıioöuü';
const isLetter = c => !!c && /\p{L}/u.test(c);
const upTr = s => s.replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase();

function kyToTr(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], lo = ch.toLowerCase(), prev = text[i - 1]?.toLowerCase();
    let r = lo === 'е' ? (!isLetter(prev) || VOWELS.includes(prev) ? 'ye' : 'e') : KY_TR[lo];
    if (r === undefined) { out += ch; continue; }
    if (ch !== lo) r = isLetter(text[i + 1]) && text[i + 1] === text[i + 1].toLowerCase() ? upTr(r[0] || '') + r.slice(1) : upTr(r);
    out += r;
  }
  return out;
}

// 吉爾吉斯文 → 俄文字母：俄文沒有 ө ү ң。子音後面的 ө ү 用 ё ю（子音變軟，接近圓唇前母音），其他位置用 о у。
function kyToRu(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], lo = ch.toLowerCase(), prev = text[i - 1]?.toLowerCase();
    const afterCons = isLetter(prev) && !VOWELS.includes(prev) && prev !== 'ь' && prev !== 'ъ';
    let r = { ө: afterCons ? 'ё' : 'о', ү: afterCons ? 'ю' : 'у', ң: 'н' }[lo];
    if (r === undefined) { out += ch; continue; }
    out += ch !== lo ? r.toUpperCase() : r;
  }
  return out;
}

const TABLE = { 'ky>tr': kyToTr, 'ky>ru': kyToRu };
export const convert = (text, from, to) => (TABLE[`${from}>${to}`] || (t => t))(text);
