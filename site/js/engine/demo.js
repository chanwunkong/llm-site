// 內建示範來源：資料檔放在 data/sources/（由 data/sources/decompose.py 產生），啟動時依清單 index.json 載入。
// 示範資料不寫進程式碼；和使用者匯入的文章一樣，都是資料。
// 發布時程式網址會加上版本號（?v=…），資料檔沿用同一個版本號，手機才不會讀到舊的快取。
const V = new URL(import.meta.url).search;

// 內建來源「基元 65」：每種語言的 NSM 語意基元（data/core/<語言>.json，由 data/concepts/build_base.py 產生）
export async function loadCore() {
  try {
    const langs = await (await fetch(`data/core/index.json${V}`)).json();
    const out = {};
    await Promise.all(langs.map(async l => { out[l] = (await (await fetch(`data/core/${l}.json${V}`)).json()).primes; }));
    return out;
  } catch {
    return {};
  }
}

export async function loadDemo() {
  try {
    const idx = await (await fetch(`data/sources/index.json${V}`)).json();
    const out = {};
    await Promise.all(Object.entries(idx).map(async ([lang, files]) => {
      out[lang] = await Promise.all(files.map(f => fetch(`data/sources/${f}${V}`).then(r => r.json())));
    }));
    return out;
  } catch {
    return {};   // 讀不到時只剩使用者匯入的文章
  }
}
