// eSpeak NG（WebAssembly，GPL-3.0，放在網站的 vendor/espeak-ng/）：在手機上朗讀與產生音標，不連任何伺服器。
// 第一次使用時下載約 18 MB，瀏覽器會快取。每次呼叫就像執行一次指令列程式，結果寫進記憶體中的檔案。
const URL_JS = new URL('../../vendor/espeak-ng/espeak-ng.js', import.meta.url).href;
let mod = null;
export const onDownload = { fn: null };   // 第一次下載時通知畫面

export async function run(args) {
  if (!mod) { onDownload.fn?.(); mod = import(URL_JS).then(m => m.default); }
  try { return await (await mod)({ arguments: args }); }
  catch (e) { mod = null; throw e; }
}
