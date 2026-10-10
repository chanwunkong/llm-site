// 內建示範來源：資料檔放在 data/sources/（由 data/sources/decompose.py 產生），啟動時依清單 index.json 載入。
// 示範資料不寫進程式碼；和使用者匯入的文章一樣，都是資料。
// 發布時程式網址會加上版本號（?v=…），資料檔沿用同一個版本號，手機才不會讀到舊的快取。
const V = new URL(import.meta.url).search;

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
