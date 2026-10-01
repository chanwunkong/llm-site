# 舊專案封存

語言學習相關的早期原型，統一收在這裡，只作為參考，不會部署到 GitHub Pages（Pages 只部署 `site/`）。
現行設計以 [docs/design.md](../docs/design.md) 為準。

| 資料夾 | 來源 | 內容 |
|---|---|---|
| `ipamapper/` | [chanwunkong/IPAMapper](https://github.com/chanwunkong/IPAMapper) `master` @ 5161722（以 git subtree 併入，**保留完整 commit 歷史**） | 前一版遊戲：六角形詞彙版圖、WALS 倍率計分、技能抽選、規則組合加成、文章匯入引擎、9 種題型；`IPA/` IPA 符號表；`swadesh/` 核心字圖示；`test/` 各種實驗頁 |
| `sidetest/kyrgyz/` | [chanwunkong/SideTest](https://github.com/chanwunkong/SideTest) `Kyrgyz/` @ 5c71de0 | 吉爾吉斯語 A1.1 聽力與跟讀原型 |
| `sidetest/allosaurus-server/` | [chanwunkong/SideTest](https://github.com/chanwunkong/SideTest) `allosaurus-server/` @ 5c71de0 | Allosaurus 通用音素辨識的 Cloud Run 伺服器（FastAPI） |

- SideTest 的 `Lingo/` 與 `ipamapper/test/` 逐檔比對完全相同（11 個檔案），不另外保存。
- `ipamapper/CLAUDE.md` 已改名為 `CLAUDE.legacy.md`，避免被當成本專案現行的工作規則。

## 仍在外部運作的服務（刪除程式碼不會關閉它們）

- Allosaurus 伺服器：`https://allosaurus-api-878665537417.asia-east1.run.app`（Google Cloud Run）。SideTest 根目錄的 `config.js` 仍有這個網址，ClimbingToolbox 也共用那份 config.js。
- Firebase 專案 `test-5dbba`：IPAMapper 與 SideTest 都用它做登入與雲端存檔。
