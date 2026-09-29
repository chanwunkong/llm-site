# A1 概念清單（第一版）

- `concepts-a1.csv`：351 個以圖像定義的概念。欄位：概念 ID、emoji、UD 詞性、清晰度（A = 單看圖就明確；B = 慣用圖示，需搭配例句）、分類、給譯者的意思說明、對應的 CEFR-J headword。
- `concepts-a1-need-icon.txt`：日常、具體，但沒有合適 emoji 的字，需要另外找圖示或繪製。
- `build_a1.py`：產生與檢查清單的腳本（檢查 headword 都在 A1、沒有共用 emoji）。

原則：同一個意思的名詞、形容詞、動詞（sun / sunny）只保留一個概念，其他詞形在語境中學；多義字依圖像拆開（orange → 🍊 / 🟧）。

資料來源：The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of Foreign Studies. Retrieved from https://github.com/openlanguageprofiles/olp-en-cefrj on 2026-09-29.
（授權：研究與商業用途皆可免費使用，改編需適當引用出處。）
