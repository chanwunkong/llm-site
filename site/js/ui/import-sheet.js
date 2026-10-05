// 匯入文章的面板：貼上文字或選 .txt 檔，網頁自動拆解成來源
import { openSheet, closeSheet, esc, toast } from './sheet.js';
import { importText } from '../engine/importer.js';
import { LANG_BY_ID } from '../data/langs.js';

const NOTE = {
  udpipe: '用 UDPipe 線上服務斷句、標詞性（需要連網；模型限非商業使用）。',
  kuromoji: '用瀏覽器內的日文斷詞工具；第一次會下載約 17 MB 的字典。',
  basic: '這個語言沒有詞性標註模型：只切字，所有字都當成要學的字，文法規則與連鎖不會啟動。',
};

export function openImport(langId, onDone) {
  const lang = LANG_BY_ID[langId];
  openSheet(`<h2>匯入文章（${esc(lang.zh)}）</h2>
    <p class="muted">貼上你想讀的內容：文章、小說、劇本、歌詞都可以。系統會自動斷句、切成段落來出題。內容只存在這個瀏覽器裡，不會上傳。</p>
    <input class="filter" id="impTitle" placeholder="標題" autocomplete="off">
    <textarea class="filter imp-text" id="impText" placeholder="貼上文字（建議 50 句以上）" dir="auto"></textarea>
    <label class="btn ghost sm imp-file">或選擇 .txt 檔<input type="file" id="impFile" accept=".txt,text/plain" hidden></label>
    <p class="muted">${NOTE[lang.tagger]}${lang.weak ? '這個語言的模型訓練資料較少，斷詞與詞性的錯誤會比較多。' : ''}</p>
    <p class="muted" id="impMsg"></p>
    <button class="btn gold big" id="impGo">開始匯入</button>`, {}, body => {
    const $ = s => body.querySelector(s);
    $('#impFile').onchange = async e => {
      const f = e.target.files[0];
      if (!f) return;
      $('#impText').value = await f.text();
      if (!$('#impTitle').value) $('#impTitle').value = f.name.replace(/\.txt$/i, '');
    };
    $('#impGo').onclick = async () => {
      const title = $('#impTitle').value.trim() || '未命名', text = $('#impText').value;
      if (!text.trim()) return toast('請先貼上文字');
      const go = $('#impGo');
      go.disabled = true;
      try {
        const src = await importText(lang, title, text, m => { $('#impMsg').textContent = m; });
        closeSheet();
        toast(`已匯入「${src.title}」：${src.situations.length} 段`);
        onDone(src);
      } catch (e) {
        $('#impMsg').textContent = `匯入失敗：${e.message}`;
        go.disabled = false;
      }
    };
  });
}
