# 基礎單字集（第三版）

兩層結構：
- **第一層 `nsm-primes.csv`**：NSM 的 65 個語意基元（Goddard & Wierzbicka 2014）。幾乎所有語言都有對應字，是「我的理解」最基本的材料。欄位：ID、分類、英文說法、日文說法（草稿，需母語者確認）、圖示模板、圖示、清晰度（A／B／C = 待設計）、併入的第二層概念。由 `build_nsm.py` 產生。
- **第二層 `concepts-a1.csv`**：從 CEFR-J A1 整理的日常概念。和基元重疊的概念（good、big、think、see…）已併入第一層，不重複。

## 第二層說明

- `concepts-a1.csv`：399 個以圖像定義的概念。欄位：概念 ID、圖示模板（single / place / role / action / contrast）、圖示內容、主 emoji、UD 詞性、清晰度（A = 單看圖就明確；B = 慣用圖示，需搭配例句）、分類、給譯者的意思說明、對應的 CEFR-J headword。
- `concepts-a1-need-icon.txt`：日常、具體，但沒有合適 emoji 的字，需要另外找圖示或繪製。
- `build_a1.py`：產生與檢查清單的腳本（檢查 headword 都在 A1、沒有共用圖示）。
- `gen_preview.py`：產生預覽頁 `site/concepts.html`。

組合圖示只用四種固定模板，讓學習者學一次就能看懂：
- `place:🏠+🍳`：場所＋用途（主圖大、用途小圖放角落），例如廚房
- `role:🧑+🚗`：人＋工作，例如司機
- `action:💵>🛍️`：動作 A→B，例如買
- `contrast:*🐘|🐭`：對比，兩個並排、`*` 標記的是答案，例如大

原則：同一個意思的名詞、形容詞、動詞（sun / sunny）只保留一個概念，其他詞形在語境中學；多義字依圖像拆開（orange → 🍊 / 🟧）。

資料來源：The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of Foreign Studies. Retrieved from https://github.com/openlanguageprofiles/olp-en-cefrj on 2026-09-29.
（授權：研究與商業用途皆可免費使用，改編需適當引用出處。）
