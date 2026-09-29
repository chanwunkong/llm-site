# 單字領土 Word Territory

以《弓箭傳說》內外兩層架構設計的通用語言學習遊戲（demo）。

- Demo: https://chanwunkong.github.io/llm-site/
- 設計文件：[docs/design.md](docs/design.md)
- 範例學習資料：依《小王子》劇情自行改寫的英文、日文簡易版本（非原文或現有譯本），詞元與 UD 詞性為人工標註。
- 測試用：`seed.html?runs=8&lang=en&go=%23land` 會**清除進度**並模擬玩過 8 局，方便直接查看領土。

推到 `main` 會自動透過 GitHub Actions 部署 `site/`。純靜態 ES modules，Three.js 由 CDN 載入，無需建置。

本機預覽：`cd site && python3 -m http.server 8000`
