# 專案概述
Hexagon Vocabulary & Grammar，結合六角形地圖介面、無冷卻間隔重複系統 (SRS) 與 Firebase 雲端同步。
本專案採用「迴圈模式 (Loop Mode)」開發，重視檔案模組化、自動化腳本與系統自適應記憶機制。

# 檔案導引
開發前必須讀取 ROADMAP.md 了解當前任務進度與下一個目標。

# 技術棧
- 前端：純 HTML, CSS (自訂屬性), Vanilla JavaScript（全域變數共享，無 ES Module import/export，所有 JS 檔案以 `<script>` 依序載入）。
- 後端：Firebase (Auth, Firestore) 版本 10.12.0 (compat 模式)。
- 圖形：HTML5 Canvas API。
- 語音：Web Speech API (SpeechSynthesis, SpeechRecognition)。
- 工具：Prettier (自動格式化)、Git/GitHub (版控與自動上傳)。

# 系統自適應與記憶機制 (Self-Correction & Memory)
系統必須具備自我驗證與知識跨對話傳承的能力。
1. 封閉迴圈：確立目標與評分標準 -> 實作 -> 檢視環境回饋 (如報錯、Console 訊息、UI 跑位) -> 修正 -> 持續迭代直到達標。
2. 五步記憶法：開發過程遭遇錯誤或學到新架構時，嚴格執行以下流程，將單次經驗轉化為系統長期記憶：
   - [記錄] 犯錯先記下。
   - [追查] 追查根本原因。
   - [確認] 確認因果關係無誤。
   - [歸納] 整理成通則，並主動更新至本文件 (CLAUDE.md) 的「除錯通則與專案知識」區塊。
   - [查閱] 之後執行任務前直接查閱通則，避免重複推論與重犯同錯。

# 核心業務邏輯
1. 狀態與存檔管理
   - 支援多存檔 (`appSaves`)，獨立保存 tokens、grid、storageData、checkInHistory、unlockedRules 與 `voiceSettings`。
   - 雙重儲存機制：登入狀態同步至 Firestore，未登入存於 LocalStorage。
2. 測驗系統 (SRS)
   - 抽取規則：L5 隨機取 5 個；L1-L4 取時間 (`levelUpdatedAt`) 最舊的前 5 個；L0 取題庫新字。
   - 防禦規則：絕對禁止加入 SRS 天數冷卻邏輯，單純依據時間戳記排序。
   - 升降級規則：過關升級並更新時間戳記；L1-L4 失敗等級不變且不更新；L5 失敗降為 L4 並更新；L0 失敗保留原順序。
3. 視覺與互動 (建設遊戲化)
   - 地圖格子背景色對應單字詞性 (POS)。
   - 地形高低即等級高低：等高線融合（L2-5）讓同等級相鄰格子連成高原，L5 群形成山峰，L1 孤格呈低谷；無需額外美術升級，地形本身就是視覺化。
   - 等高線 (Level 2-5) 需判斷相鄰且同級/高級的六角形，將外框融合繪製。
   - 區分點擊空地 (放置單字) 與點擊既有方塊 (觸發互動)。
4. 題型設計原則 (統一造句軸)
   - 核心主張：L3-V（詞塊自由造句 + WALS 計分）是所有題型的基準軸，上下各級為其延伸變化。
   - 每個 Level 有標準版（視覺/鍵盤）與音訊/口說變體（-A 聽、-S 說），各自為獨立模組，由 dispatcher 隨機抽取。
   - 完整題型清單：
     - L1-A：詞塊填空，TTS 自動播例句，單字隱藏，字母變換干擾詞 4 選 1，選後送出確認，選錯立即失敗（requiresListening）
     - L1-S：唸出單字，TTS 播放目標單字，SpeechRecognition 比對（`requiresSpeaking`）
     - L2-V：詞塊重組，打亂例句，點選還原語序
     - L2-A：聽後重組，TTS 播例句，依記憶重組詞塊（`requiresListening`）
     - L2-S：覆誦整句，TTS 播例句，學習者跟讀整句，SpeechRecognition 比對目標詞（`requiresSpeaking`）
     - L3-A：聽寫填空，例句遮蓋目標詞，手寫/鍵盤輸入拼寫（原名 L3）
     - L3-V：詞塊造句，自由組句，目標詞必現，WALS 計分 —— 基準軸
     - L4：限制造句，自由組句，必須滿足 ≥ ceil(解鎖數/2) 條規則才過關（無規則時同 L3-V）
     - L5：情境造句，語境提示句，組句回應，WALS 計分 + 情境詞加成（最高 +3）
   - 命名規則：-A 後綴 = TTS 發聲（`requiresListening: true`）；-S 後綴 = TTS 發聲 + 麥克風（`requiresSpeaking: true`）；-V 後綴 = 視覺操作（無旗標）。

# 任務執行規範 (Loop Workflow)
每次接收開發指令時，嚴格遵守以下流程：
1. 確立目標：檢視 ROADMAP.md 與「除錯通則與專案知識」。
2. 計畫提案：**在動任何程式碼之前**，先將本次任務拆分為具體子項目，寫入 ROADMAP.md 的「當前任務」區塊，並向使用者說明計畫內容。**必須等待使用者明確確認後，才能進行步驟 3。**
3. 實作修改：修改相關模組檔案 (HTML/CSS/JS)。
4. 回饋與驗證：觸發自適應迴圈，主動檢查邏輯與報錯，若有錯誤則進入五步記憶法。
5. 標記押期：確認達標後，將 ROADMAP.md 的任務標記為 [x] 並押上完成日期 (如 `[x] (2026-06-11)`)。嚴禁更動歷史任務。若本次修改新增了模組檔案或搬移了功能，同步更新 `ARCHITECTURE.md` 的對應區塊。
6. 自動歸檔：若當前任務的已完成項目超過 5 條，主動移至 `## 歷史紀錄 (Archive)`。
7. 版本控制：`git add/commit/push` 全自動執行，使用者已預先授權，無需每次確認。
8. 推進迴圈：任務與上傳完成後，詢問是否繼續執行下一項任務。

# 開發與溝通規範
- 直接說明重點，簡潔精準，避免堆砌詞藻。
- 絕對禁止使用任何表情符號。
- 避免使用對比式論述。
- 維持模組化結構，新增邏輯需歸類至對應的獨立 JS 檔案中。

---

# 除錯通則與專案知識 (Knowledge Base)
(此區塊由系統依據五步記憶法自動擴充)
- [架構通則] 步驟 2「計畫提案」不可省略：即使任務看似明確，也必須先將子項目寫入 ROADMAP.md 並等待使用者確認，再動程式碼。跳過此步驟是違規行為。
- [除錯-POS色彩] L2-V/L2-A 詞塊色彩失效根因：`buildWordPosMap()` 只涵蓋已收錄進 datasets/storageData/grid 的單字，常見功能詞（冠詞、介系詞、代名詞、助動詞等）無 POS 資料，導致 `pos` 為空串。修正方案：在 q-stub.js 維護 `COMMON_WORD_POS` 備援表，render 函式改為 `wordMap.get(clean) || COMMON_WORD_POS[clean] || ''`。日後若改用外部詞典 API 亦遵循此 fallback 優先順序。
- [除錯-手寫辨識] Chrome Handwriting Recognition API (`navigator.createHandwritingRecognizer`) 為實驗性功能，在 Chrome 128+ 已被移除。舊實作靜默略過（return 不更新 UI），使用者看不到任何提示。修正方案：`initHWR()` 改為雙層架構：原生 HWR API 優先，不支援時動態載入 Tesseract.js v4 OCR 備援（`unpkg.com/tesseract.js@4`）；`#l3-hwr-status` 全程顯示狀態。OCR 辨識時須以黑字白底臨時 canvas 送入，原始藍字灰底 canvas 準確率較差。
- [除錯-重複按鈕] L1-A 模組 activate() 已自動播放例句與單字，但 HTML 中保留了「再聽單字/再聽例句」手動重播按鈕，造成功能重複。根因：重構 L1-A 自動播放邏輯時未同步清理 HTML 殘留元素。通則：模組 activate() 行為變更後，必須同步檢查 HTML 中對應的操作按鈕是否仍有存在意義。