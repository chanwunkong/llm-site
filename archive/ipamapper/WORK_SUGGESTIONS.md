# 明日工作建議 (2026-06-12)

本文件由系統在全專案審查後自動生成，依不同身分角色給出建議。
每項建議附上優先級（高/中/低）與對應檔案位置。

---

## 開發者視角 (Developer)

技術缺陷與穩健性改善，按可操作難度排序。

### 高優先

**1. 修正 L1-A shuffle 演算法**
- 檔案：`js/practice.js:49` 和 `js/practice.js:306`
- 問題：`arr.sort(() => 0.5 - Math.random())` 是已知的不均勻分佈反模式
- 修法：改用 Fisher-Yates

```js
function fisherYatesShuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
```

**2. 修正 endPractice() 失敗單字重複回塞風險**
- 檔案：`js/practice.js:271-281`
- 問題：失敗的 CSV 來源單字直接 `activeDs.words.push()`，沒有先檢查是否已存在
- 修法：push 前加 `if (!activeDs.words.find(w => w.word === item.word))`

**3. 修正 autoAdvance 計時器競態**
- 檔案：`js/practice.js:203`
- 問題：`startAutoAdvance()` 在每次呼叫時不先清除舊計時器，快速連點可產生多個並行計時器
- 修法：`startAutoAdvance()` 開頭先呼叫 `cancelAutoAdvance()` 清除舊計時器

### 中優先

**4. Canvas 字體縮放缺少遞迴**
- 檔案：`js/canvas.js:181-193`
- 問題：長單字（如 "good morning"）在 16px 時若仍超出邊界，沒有繼續縮小
- 修法：改成 while 迴圈，從 20px 逐步縮小直到 measureText 寬度合格

**5. L3 Canvas 初始化時序**
- 檔案：`js/questions/q-stub.js:206-208`
- 問題：`initL3Canvas()` 呼叫後立即 `setTimeout(resizeL3Canvas, 50)`，50ms 是 magic number，在慢速設備可能不夠
- 修法：改用 `ResizeObserver` 或 `requestAnimationFrame` 確保 layout 完成後再讀取尺寸

**6. practiceAudioDisabled 狀態說明**
- 檔案：`js/practice.js:8`
- 說明：此旗標為 session-only，不持久化是刻意設計（每次開啟練習重置）。確認此設計符合需求，若需跨 session 記憶應加入 voiceSettings。

### 低優先

**7. 全域狀態防護**
- 檔案：`js/state.js:13-14`
- `storageData` 和 `grid` 以 const 全域暴露，多個模組直接修改
- 長期建議：包成 module 或加 setter 函式控制修改入口

---

## UX 設計師視角 (UX Designer)

使用者操作流程與介面體驗問題。

### 高優先

**1. 練習中途退出無確認**
- 位置：`index.html:53`（退出按鈕）
- 問題：直接呼叫 `endPractice()`，誤觸即損失本次所有進度
- 建議：加入 `confirm('確定退出？目前進度將被計算並儲存。')` 或自訂確認 Modal

**2. 無障礙停用後缺少題型說明**
- 位置：`index.html:57-59`（audio-disabled-notice）
- 問題：顯示「已停用語音題型」但使用者不知道現在會出什麼題，也不知道如何重新啟用
- 建議：通知文字改為「已停用語音題型，本場僅顯示文字題。重新開始練習可恢復。」

**3. L3-V 造句無輸入引導**
- 位置：`js/questions/q-stub.js:304`（placeholder 文字）
- 問題：輸入框 placeholder 不夠清楚，使用者不知道可以輸入任何詞或只能輸入已學過的詞
- 建議：改 placeholder 為「輸入單字，按 Enter 加入句子（支援任何單字）」

### 中優先

**4. 倒計時進度條無秒數文字**
- 位置：`style.css:234`（countdown-bar）
- 問題：1.5 秒進度條使用者不知道「還剩多少時間」
- 建議：在進度條旁加入 "1.5s" 靜態文字，或在動畫結束前顯示 "自動跳題中..."

**5. 儲存區（storage-area）在小螢幕截斷**
- 位置：`style.css:106`（padding-right: 180px）
- 問題：硬編碼右側空間，在 375px 寬螢幕上儲存單字可能被截斷
- 建議：改為 `max-width: calc(100% - 20px)` 並讓 storage chips 換行

**6. 打卡連續數字語意不明**
- 位置：`index.html:19-21`
- 問題：「連續簽到 N 天」與「累計簽到 N 天」對使用者來說難以區分
- 建議：加入 tooltip 或小字說明「連續天數，中斷後重設」

### 低優先

**7. 地圖格子沒有 hover 提示**
- 位置：`js/canvas.js`（hex 繪圖邏輯）
- 問題：滑鼠停在地圖上無任何視覺回饋，不知道是否可點擊
- 建議：加入 hover 高亮效果（cursor + hex 邊框變亮）

**8. WALS 規則「查看」按鈕無內容**
- 位置：`js/grammar.js:97`
- 問題：按下查看只彈 toast，沒有展示規則詳情
- 建議：彈出卡片顯示規則說明、需要的 POS 組合範例

---

## QA 測試員視角 (QA Tester)

明日應執行的測試案例，涵蓋新功能與回歸。

### 新功能測試（本週新增）

**TEMP-1：載入預設題庫 Lesson1**
1. 無存檔狀態下按「載入預設題庫」→ 應顯示「請先建立存檔」
2. 有存檔，按一次載入 → 應成功匯入 80 個單字，active 切換至 Lesson1.csv
3. 再按一次 → 應顯示「預設題庫已載入」不重複匯入
4. GitHub Pages 環境（無 Lesson1.csv 的情境）→ 應顯示載入失敗提示

**SKIP（無障礙模式）**
5. 開始練習後按「無法聆聽/說話」→ 不應再出現語音辨識（L1-S）或聽音選字（L1-A）題型
6. 按下後再重新開始練習（退出後再進）→ 按鈕應恢復為可用狀態
7. Level 1 且音訊停用 → 確認 dispatcher 仍有可用題型（非音訊模組），不應當機

**DUP-2：跨單字庫去重**
8. 匯入兩個含相同單字的 CSV → 第一個單字庫練習後，切換第二個單字庫練習 → 相同單字不應再出現

### 回歸測試（既有核心功能）

**SRS 升降級**
9. L1 單字答對 3 次 → 應升至 L2，`levelUpdatedAt` 應更新
10. L5 單字答錯 → 應降至 L4，`levelUpdatedAt` 應更新
11. L1-L4 單字答錯 → 等級不變，`levelUpdatedAt` 不更新

**L3-V POS 造句**
12. 加入含目標單字的 2 詞以上句子 → 應可提交
13. 未包含目標單字直接提交 → 應提示「句子必須包含目標單字」
14. 解鎖任一 WALS 規則後，造句滿足該規則 → 應顯示 ✓

**存檔系統**
15. 建立存檔 A 練習後切換存檔 B → A 的地圖與 SRS 資料不應影響 B
16. 登入 Firebase 後練習 → 資料應同步至 Firestore，換裝置後可讀回

### 邊界條件

17. 所有地圖單字均 L5 且無新 CSV 詞 → 練習按鈕應提示「題庫練習完畢」不當機
18. CSV 含 POS 不符規範的單字 → 應顯示警告 toast，其餘正常單字仍正常匯入
19. 儲存區滿（5 個）時按 Play → 應提示「存放區已滿」

---

## 產品負責人視角 (Product Owner)

功能優先級與方向建議，基於現有進度與使用者價值。

### 明日最高價值任務

**第一優先：L4 自由造句題型（最長懸空的核心功能）**
- 現狀：L4 模組是純 stub，`submitGrammar()` 直接呼叫 `skipWord()`
- 現在 POS 系統已完成（dot-notation + posTypes），L4 實作條件成熟
- 建議實作方向：
  - 顯示目標單字，要求使用者在輸入框輸入完整句子
  - 解析句子中每個詞的 POS（從單字庫 map 查詢）
  - 驗證是否符合至少一條已解鎖 WALS 規則
  - 通過：升級 + 給代幣；失敗：提示缺少哪個 POS

**第二優先：WALS 規則「查看」功能**
- 現狀：解鎖後的規則按「查看」只彈 toast
- 使用者解鎖規則後需要理解規則才能在 L3-V / L4 中應用
- 建議：彈出卡片顯示規則說明 + POS 序列範例 + 例句
- 實作量：中等，主要是 UI 展示，`rulesA1[rule].posTypes` 資料已備好

### 中期待辦（本週內）

**Firebase 登入同步測試**
- 現狀：ROADMAP 有列但標記為「基礎優化」，是否有登入流程的 E2E 測試？
- 建議：安排一次完整的「登入 → 練習 → 退出 → 換裝置 → 驗證資料」流程

**CSV 題庫擴充**
- 現狀：Lesson1.csv 含 80 個入門詞，全是問候 + 家人 + 數字
- 建議新增 Lesson2（動詞、形容詞各 30 個），以便讓 WALS 87（形容詞與名詞）等規則有實際練習素材

### 長期方向提醒

**L5 自由對話（LLM 整合）需要前置決策**
- 整合哪個 LLM API？需要費用預算規劃
- LLM 回應延遲如何影響練習體驗？
- 建議：先用 mock LLM 驗證 UI 流程，再接真實 API

**深色模式**
- 使用者長時間使用時眼睛疲勞，`style.css` 無 `prefers-color-scheme: dark`
- 實作量低，但視覺設計需要完整規劃色彩映射

---

*本文件由 Claude Sonnet 4.6 在 2026-06-11 生成，供 2026-06-12 工作參考。*
