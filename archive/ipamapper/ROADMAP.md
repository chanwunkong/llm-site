# 開發進度與目標

> 題型架構、模組呼叫關係、SRS 資料流見 [ARCHITECTURE.md](ARCHITECTURE.md)

---

## 設計方向 (Design Vision)

> 核心主張：成人語言學習靠邏輯建構，不靠語感培養。所有驗證邏輯保持純規則導向，不依賴 LLM。

| 柱子 | 比喻 | 目標 |
|------|------|------|
| 詞彙版圖 | 城市建設 | 每個單字是領土，版圖越大越壯觀，掌握度一眼可見 |
| 文法計分 | 弓箭傳說傷害倍率 | 同時滿足越多已解鎖 WALS 規則，代幣獎勵越高；複雜句子自然值更多 |
| 文章輸入引擎 | 自備內容驅動 | 貼入任意文章，系統比對生字，轉化為練習佇列 |

> 地圖美術（格子視覺升華 L1→L5）列為最後階段，先建立程式邏輯。
> 無預定義「組合技」—— 計分系統自動感知句子複雜度，不需要額外資料結構。

### 題型統一造句軸 (Unified Composition Spine)

> L3-V（詞塊自由造句 + WALS 計分）是所有題型的基準軸。上位下位關卡均為其延伸變化，透過「自由度」與「WALS 約束強度」兩個維度控制難易度。

| Level | 題型 ID | 題型名 | 機制 | 自由度 | WALS 介入 | 裝置需求 |
|-------|---------|--------|------|--------|-----------|----------|
| L1 | **L1-A** | 詞塊填空 | TTS 自動播例句，單字隱藏；詞塊池 4 選 1（字母變換干擾詞）；選後送出確認；選錯立即失敗 | 極低 | 無 | 喇叭 |
| L1 | **L1-S** | 唸出單字 | TTS 播放單字，學習者跟讀；SpeechRecognition 比對目標詞 | 極低 | 無 | 喇叭 + 麥克風 |
| L2 | **L2-V** | 詞塊重組 | 打亂例句詞塊，點選還原語序 | 低 | 提示（不計分） | 無 |
| L2 | **L2-A** | 聽後重組 | TTS 播打亂前例句，依記憶從詞塊池重組 | 低 | 提示（不計分） | 喇叭 |
| L2 | **L2-S** | 覆誦整句 | TTS 播例句，學習者跟讀整句；SpeechRecognition 比對目標詞 | 低 | 無 | 喇叭 + 麥克風 |
| L3 | **L3-A** | 聽寫填空 | 例句遮蓋目標詞，手寫/鍵盤輸入拼寫 | 低 | 無 | 無 |
| L3 | **L3-V** | 詞塊造句 | 自由組句，目標詞必現，WALS 計分（+2/+4/+6）| 高 | 計分 | 無 |
| L4 | **L4** | 限制造句 | 自由組句，必須滿足 ≥ ceil(解鎖數/2) 條規則才過關；不達標不扣次數 | 高 | 強制門檻 | 無 |
| L5 | **L5** | 情境造句 | 顯示語境提示句，組句回應；WALS 計分 + 情境詞加成（最高 +3） | 最高 | 計分 + 情境加成 | 無 |

---

## 當前任務 (Current Focus)


### 路線 I：test 場技術移植

**[I1] Levenshtein 容錯 — L3-A** (`js/questions/q-stub.js`)
- 新增純函式 `levenshtein(a, b)` (8 行)
- 修改 `submitL3()`：原本 `typed === target` 純等值判斷，改為相似度 ≥ 85% 即通過；反饋顯示辨識結果與相似度（例：「接近正確（辨識：helo，相似度 89%）」）；完全相符仍顯示「正確！」

**[I2] SortableJS 拖拉排序 — L2/L3-V/L4/L5 workspace** (`index.html` + `js/questions/q-stub.js`)
- `index.html`：加入 SortableJS CDN（`cdn.jsdelivr.net/npm/sortablejs@1.15.0`）
- L2-V / L2-A `activate()` 末段對 `#l2-answer-area` 呼叫 `new Sortable()`，`onEnd` callback 從 DOM `children` 的 `dataset.token` 同步回 `l2AnswerTokens[]`
- L3-V / L4 / L5 的 `activate()` 末段同理：`#l3v-sentence`→`l3vTokens[]`、`#l4-sentence`→`l4Tokens[]`、`#l5-sentence`→`l5Tokens[]`，各自 `onEnd` 同步（chip 渲染時存 `dataset.idx`）

**[I3] 錄音回播 — L1-S / L2-S** (`index.html` + `js/practice.js` + `js/questions/q-stub.js`)
- `index.html`：`#l1s-result-actions` 與 `#l2s-result-actions` 各加「回播錄音」按鈕（初始 `display:none`）
- `practice.js`（L1-S）：`l1sToggleMic()` 開始收音時同步啟動 `MediaRecorder`，結果出來後以 `URL.createObjectURL(blob)` 存入 `l1sLastAudioUrl`，顯示回播按鈕
- `q-stub.js`（L2-S）：同上邏輯，存入 `l2sLastAudioUrl`，顯示回播按鈕
- 回播按鈕 `onclick` 建立 `new Audio(url).play()`；新題開始時清除舊 URL

**實作子項目**

- [x] (2026-06-12) [I1] `q-stub.js` — L3-A Levenshtein 容錯（≥ 85% 視為通過，顯示相似度提示）
- [x] (2026-06-12) [I2] `index.html` + `q-stub.js` — SortableJS 拖拉排序接入 L2-V/L2-A/L3-V/L4/L5 workspace
- [x] (2026-06-12) [I3] `index.html` + `practice.js` + `q-stub.js` — MediaRecorder 錄音回播加入 L1-S / L2-S

---

### 路線 J：語言系統重構 + WALS 技能抽選

**[J1] 語言切換介面重構**
- 移除現有語言選擇介面，改為固定 5 個語言的 toggle UI（英 / 義 / 俄 / 中 / 日），單選
- 語言選擇儲存至存檔

**[J2] 五語言 A1 WALS 規則設定檔（單一檔案）**
- 新建 `js/wals-rules.js`，結構為 `{ en: [...], it: [...], ru: [...], zh: [...], ja: [...] }`
- 每條規則含 id、名稱、說明、驗證邏輯簽名
- 現有 `grammar.js` 英語規則遷移至此；`grammar.js` 改為依當前語言從 `WALS_RULES[lang]` 動態讀取

**[J3] WALS 技能抽選機制**
- 每次練習開始前，從已解鎖 WALS 規則中隨機抽 3 條，玩家選 2 條為本場「主動規則」
- L3-V / L4 / L5 造句：主動規則命中倍率 ×2，其餘已解鎖規則退為背景 ×1
- L4 門檻改為：必須滿足 ≥1 條主動規則

**[J4] 規則組合加成**
- `js/wals-combo.js`：定義規則對協同表（初期 3-5 組），雙規則同時命中給予額外 +3
- 與語言設定檔解耦，獨立維護

**實作子項目**

- [x] (2026-06-20) [J1] `index.html` + `js/` — 語言切換 toggle UI，存入存檔
- [x] (2026-06-20) [J2] `js/wals-rules.js` — 五語言 A1 WALS 規則設定檔；`grammar.js` 動態載入
- [x] (2026-06-20) [J3] `index.html` + `js/practice.js` — 練習前技能抽選 UI + 計分倍率邏輯
- [x] (2026-06-20) [J4] `js/wals-combo.js` + `js/grammar.js` — 規則協同加成計算

---

### 文章引擎待解問題 (TEXT-6)

- [ ] [TEXT-6-1] 詞形變化比對：文章中的 "running" 無法比對詞庫的 "run"，需定義是否要做詞根還原（stemming），或改以使用者手動確認
- [ ] [TEXT-6-3] 大小寫與專有名詞：人名、地名出現為陌生詞，加入地圖無意義，需設計過濾或忽略機制
- [ ] [TEXT-6-4] 詞庫已有但未練習的詞：目前歸類為「已知」（存在於 datasets），但使用者實際上可能還不熟悉，需重新定義「已知」的標準（已在 storageData/grid vs 僅在 datasets）
- [ ] [TEXT-6-5] 多詞表達：詞庫中的 "good morning" 無法與文章中分開出現的 "good" / "morning" 匹配，需討論是否支援短語比對
- [ ] [TEXT-6-6] 多語言斷句：目前英語縮寫黑名單（Mr、Mrs、Dr 等）為過渡方案，需找多語言通用的句子邊界偵測方案替換

### 規則定義待解 (Rule Ambiguity)

- [ ] [RULE-1] WALS 116（問句 auxiliary 置句首）與 WALS 81（SVO 語序）衝突：問句結構本身不符合 SVO，需明確定義兩者是否互斥，或問句模式下 `checkWalsRule(81)` 應自動豁免
- [ ] [RULE-2] 前置修飾語順序：WALS 87（形容詞）、88（指示詞）、89（數詞）同時存在時，英語慣例為 DEM + NUM + ADJ + N（如 "those two big dogs"），但目前 `checkWalsRule` 僅各自獨立驗證位置，未定義三者共存時的順序規則

### 待辦（低優先）

- [ ] 優化 Web Speech API 語音辨識失敗時的提示與重試體驗
- [ ] 執行 Firebase 登入同步 E2E 流程：登入 → 練習 → 退出 → 換裝置 → 驗證資料還原

---

## 長期願景 (Long-term Vision)

- 詞彙地形：地形高低即等級高低，已由等高線融合繪製實現，L5 群體聚集成山脈，L1 孤格呈低谷；視覺化無需額外美術工作
- 詞彙空間關係：相鄰格子同詞性或語義相關時產生加成效果
- L5 情境造句（REDESIGN-5）：給定語境提示句，以目標詞組句回應，WALS 計分 + 情境加成；純規則驗證，不依賴 LLM
- 空間路徑計分：地圖上相鄰單字的可行路徑廣度決定積分
- 跨裝置雲端同步與離線支援

---

## 歷史紀錄 (Archive)

- [x] (2026-06-12) [路線I] QA-1~6 程式碼審查：全數通過，無邏輯錯誤（CSV去重、dispatcher旗標、existingWords、SRS升降級、佇列邊界、L3-V計分）
- [x] (2026-06-12) [路線H] 題型模組重建：L1-A/L1-S 拆分、L2-S 新增、L3-A 補接 dispatcher、L4 無規則備援、TTS 補齊、dev modal 9 題型
- [x] (2026-06-12) [路線G] REDESIGN-1~5 + UX-P-7/9/15 + UX-L-1~5：L1 詞塊填空+覆誦二段式、L2-A 聽後重組、L4 限制造句、L5 情境造句全實作；跨題型按鈕視覺統一；進度列圖示化；WALS hints 摺疊；版面一致性修正
- [x] (2026-06-12) [路線E] UX-P-1~5 練習面板整改：不捲動版面、word card row wrapper、per-type 欄位顯隱、L2 POS 色塊、L2-A canvas 放大
- [x] (2026-06-12) [路線F] UX-P-10~14 音訊控制重構：移除 L1-V 閃卡、拆分聆聽/說話停用旗標、移除 L1-A 冗餘按鈕、COMMON_WORD_POS 備援表、HWR 狀態提示
- [x] (2026-06-12) [UX-P-6] Tesseract.js v4 OCR 備援：動態載入、debounce 800ms、黑字白底臨時 canvas 提高辨識率、全程狀態提示
- [x] (2026-06-11) [路線B] SCORE-1~3 文法計分強化：L3-V 即時代幣（satisfiedCount×2）、分層反饋、ruleHitCounts 存檔、規則卡片顯示觸發次數
- [x] (2026-06-11) [路線C] TEXT-1~5 文章輸入引擎：js/passage.js 新模組；設定頁卡片；分析結果；addPassageWordToMap；朗讀模式（逐句TTS + 陌生詞高亮 + 每3句插入統整卡）
- [x] (2026-06-11) [路線D] TEXT-7~8 文章朗讀支線：CSV/TXT 上傳、存檔持久化、#reading-view 全螢幕視圖、主畫面 Reading 按鈕、英語縮寫斷句保護
- [x] (2026-06-11) [TEXT-6-2] 功能詞歸類確認：功能詞由詞庫覆蓋，無需程式碼層停用詞過濾
- [x] (2026-06-11) [TEST] 臨時測試工具：DEV 按鈕 + debug modal + `startDebugPractice(level, moduleIdx)`
- [x] (2026-06-11) [ARCH-1~2] 建立 ARCHITECTURE.md；CLAUDE.md 加入同步維護規則
- [x] (2026-06-11) [BUG-1~5] shuffle 反模式、endPractice 重複檢查、autoAdvance 計時器、canvas 字體 while 縮放、L3 canvas 雙重 rAF
- [x] (2026-06-11) [UX-1~7] 退出確認、無障礙說明、L3-V placeholder、countdown label、storage padding RWD、打卡小字、WALS 詳情 modal
- [x] (2026-06-11) [TEMP-1] 載入預設題庫 Lesson1 按鈕
- [x] (2026-06-11) [DUP-1/2] 跨單字庫去重；[POS-1~6] POS dot-notation + 9 色；[SKIP-1~4] 無障礙 requiresAudio 過濾
- [x] (2026-06-11) 題型架構完整實作：L1-A、L1-S、L2-V、L2-A、L3-V、Dispatcher；checkWalsRule() 10 條規則
- [x] (2026-06-10) 多存檔系統、語音設定、Canvas 事件重構、模組化拆分
