# 專案架構總覽 (Architecture Overview)

> 粒度：檔案層級。函式細節以閱讀原始碼為準。
> 維護規則：每次新增模組檔案或搬移功能後，於 ROADMAP 步驟 5 同步更新本文件。

---

## 檔案職責一覽

| 檔案 | 職責 |
|------|------|
| `index.html` | 主畫面入口：Canvas 地圖 + 所有 UI 面板的 DOM 結構與 JS 載入順序 |
| `style.css` | 全域樣式：CSS 自訂屬性（主題色）、RWD、各面板版型 |
| `js/state.js` | 全域可變狀態：`appSaves`、`currentTokens`、`grid`、`storageData`、`unlockedRules`、`voiceSettings`；`getPosColor()` |
| `js/firebase.js` | Firebase 初始化（Auth + Firestore compat 模式）；Auth 狀態監聽器觸發載入邏輯 |
| `js/storage.js` | 雙重儲存：`saveCurrentData()` / `loadSaveData()` → Firestore（登入）或 LocalStorage（未登入） |
| `js/saves.js` | 多存檔 UI：建立、切換、刪除存檔，呼叫 storage.js 讀寫 |
| `js/datasets.js` | CSV 匯入、題庫管理、`buildWordPosMap()`（word→POS 快取）、`isValidPos()` 驗證 |
| `js/canvas.js` | 六角形地圖繪製：DPR 縮放、字體 while 迴圈縮放、等高線融合框、點擊區域判斷 |
| `js/grammar.js` | WALS 規則定義（`rulesA1`）、`checkWalsRule()`、解鎖邏輯、規則清單渲染、詳情 modal |
| `js/practice.js` | 練習 session 主控：SRS 抽題邏輯、TTS `speakText()`、麥克風辨識（L1-S）、升降級、`endPractice()` |
| `js/dispatcher.js` | 題型派發器：`registerQuestionModule(level, module)`、`dispatchQuestion(wordData)`（含音訊禁用過濾） |
| `js/questions/q-stub.js` | 題型模組實作（現行）：L2-V（詞塊重組）、L2-A（填空，待廢止）、L3-V（詞塊造句 + WALS 計分，基準軸）、L4 stub（待替換為限制造句） |
| `js/sentence-renderer.js` | 例句動態渲染：比對 `buildWordPosMap()`，為例句中已知單字套用 POS 背景色 |
| `js/passage.js` | 文章輸入引擎：`parsePassage()` 斷詞、`classifyPassageWords()` 比對已知詞、`addPassageWordToMap()` 加入詞庫、朗讀模式（逐句 TTS + 陌生詞高亮 + 每 3 句插入生字統整） |
| `js/ui.js` | 通用 UI 工具：`showToast()`、modal 開關、打卡日曆 |
| `js/voice.js` | 語音引擎設定 UI：列出 SpeechSynthesis 可用語音，讀寫 `voiceSettings` 至存檔 |
| `js/events.js` | 全域事件監聽：鍵盤快捷鍵（Enter 送出等） |

---

## 模組呼叫關係

```
index.html (DOM 載入順序)
 ├── state.js          ← 全域變數，所有模組共享
 ├── firebase.js       → 觸發 storage.js 載入資料
 ├── storage.js        → 讀寫 saves.js / state.js
 ├── saves.js          → 呼叫 storage.js
 ├── datasets.js       → 提供 buildWordPosMap() 給 q-stub.js / grammar.js
 ├── canvas.js         → 讀取 grid / storageData (state.js)，呼叫 getPosColor()
 ├── grammar.js        → 讀取 unlockedRules (state.js)，checkWalsRule() 被 q-stub.js 呼叫
 ├── sentence-renderer.js → 依賴 buildWordPosMap() (datasets.js)
 ├── practice.js       → 主控練習，呼叫 dispatchQuestion() (dispatcher.js)
 ├── dispatcher.js     → 維護 questionModules[]，呼叫模組 activate/deactivate
 ├── questions/q-stub.js → registerQuestionModule() 注入 dispatcher.js；呼叫 checkWalsRule() (grammar.js)
 ├── ui.js
 ├── voice.js
 └── events.js
```

---

## SRS 資料流

```
1. 應用啟動
   firebase.js (Auth 狀態) → storage.js (loadSaveData)
   → state.js 填入：storageData / grid / unlockedRules / ruleHitCounts / voiceSettings / tokens / passageText

2. 地圖互動
   canvas.js (點擊判斷)
   ├── 空地 → 從 storageData 取詞 → 放入 grid → canvas.js 重繪
   └── 方塊 → speakText() (practice.js / TTS)

3. 練習 session
   practice.js startPractice()
   → SRS 抽題（L0：新字 / L1-L4：最舊 5 個 / L5：隨機 5 個）
   → dispatchQuestion(wordData) (dispatcher.js)
     → 隨機選取 questionModules[level] 中一個模組
     → module.activate(wordData) (q-stub.js / practice.js)

4. 答題結果
   模組 submit 函式 → practice.js 升降級邏輯
   → 更新 levelUpdatedAt / level
   → storage.js saveCurrentData() → Firestore / LocalStorage
```

---

## Level-Module 設計（統一造句軸）

> 所有題型以 L3-V 詞塊造句 + WALS 計分為軸，透過「自由度」與「WALS 約束強度」向上下延伸。
> 音訊（TTS / SpeechRecognition）為跨級修飾器，不獨立成題型類別。

| Level | 認知目標 | 題型名 | 機制摘要 | 音訊維度 | 自由度 | WALS | 狀態 |
|-------|---------|--------|----------|---------|--------|------|------|
| L1 | 詞形認知 | 詞塊填空 | 例句挖空，詞塊池 4 選 1（目標詞 + 3 同 POS 干擾詞） | TTS 播例句；SpeechRecognition 覆誦整句 | 極低 | 無 | 待重構（REDESIGN-1/2） |
| L2 | 句型理解 | 詞塊重組 | 打亂例句，還原語序 | TTS 播原句（音訊版：聽後重組） | 低 | 提示 | 視覺版完成（L2-V）；音訊版待重構（REDESIGN-3） |
| L3 | 文法規則 | 詞塊造句 | 自由組句，目標詞必現，WALS 即時反饋計分 | TTS 播目標詞 | 高 | 計分 | 完成（L3-V） — 基準軸 |
| L4 | 文法應用 | 限制造句 | 自由組句，須同時滿足 ceil(解鎖數/2) 條規則才過關 | TTS 播目標詞 | 高 | 強制門檻 | 待開發（REDESIGN-4） |
| L5 | 情境應用 | 情境造句 | 語境提示句，以目標詞組句回應，計分 + 情境加成 | TTS + SpeechRecognition | 最高 | 計分＋情境 | 規劃中（REDESIGN-5） |

### 已廢止模組

| 模組 | 廢止原因 | 折入方向 |
|------|---------|---------|
| L1-V（閃卡自評） | 被動認知，無助詞形記憶 | — |
| L1-A（聽音多選） | 功能折入 L1 詞塊填空的音訊維度 | REDESIGN-1 |
| L2-A（手寫填空） | 設計重對齊：手寫辨識為輔助輸入，核心機制（單字填空）不符統一造句軸；功能折入 L2 聽後重組 | REDESIGN-3 |

---

## 存檔資料結構

每個存檔（`appSaves[i]`）包含：

| 欄位 | 說明 |
|------|------|
| `tokens` | 代幣數量 |
| `storageData` | 儲存區詞條陣列（含 level、levelUpdatedAt） |
| `grid` | 地圖擺放狀態（key = `q,r`） |
| `checkInHistory` | 打卡日期陣列 |
| `unlockedRules` | 已解鎖 WALS 規則 ID 陣列 |
| `ruleHitCounts` | 各規則在練習中被滿足的累計次數（`{ [ruleId]: number }`） |
| `voiceSettings` | `{ voiceURI, lang }` |
| `passageText` | 使用者存入的文章全文（朗讀支線用） |
| `datasets` | 題庫清單（含 usedIndices） |
