# 發音評分服務（自行架設）

遊戲的「開口環境」用這個服務做逐音評分：學習者唸一個字，服務判斷難音唸成了哪個音。程式和模型都是公開的；每個人用自己的電腦或主機架設，再把網址和存取密碼填進遊戲的設定。錄音只送到你填的服務。

介面見 [API.md](API.md)；評分方法與實驗紀錄見 [HANDOFF.md](HANDOFF.md)。

## 架設步驟

1. 產生模型（只需一次，需要 Python 與約 3 GB 空間）：

   ```
   pip install torch transformers onnx onnxruntime huggingface_hub
   python export_model.py        # 產生 model/model.int8.onnx（355 MB）與 model/vocab.json
   ```

2. 啟動服務（Docker）：

   ```
   docker build -t pronounce .
   docker run -d -p 8080:8080 -v "$PWD/model:/model:ro" \
     -e TOKEN=<自己設定一組長密碼> pronounce
   ```

3. 讓手機連得到這個服務。手機的麥克風要求網頁和服務都是 HTTPS。建議用私人網路（例如 Tailscale）讓服務只有自己的裝置能連，不要直接開放到網際網路。

4. 在遊戲的「設定 → 發音評分服務」填入網址和密碼，按「測試連線」。

## 設定

| 環境變數 | 預設 | 說明 |
|---|---|---|
| `TOKEN` | （必填） | 存取密碼 |
| `AUTH` | `on` | `off` 關閉密碼檢查，只在只有你連得到的電腦上使用 |
| `ALLOW_ORIGINS` | `https://chanwunkong.github.io` | 允許呼叫的網站，逗號分隔 |
| `RATE_PER_MIN` | `30` | 每個來源每分鐘的次數上限，`0` 不限制 |
| `LOG_ATTEMPTS` | `1` | 印出每次的分數（不含錄音） |
| `THREADS` | `4` | 模型使用的 CPU 執行緒 |
| `LEGACY` | `0` | `1` 時另外提供舊的測試頁（`/`） |

## 支援的語言

19 種：英、德、西、葡、法、義、俄、孟加拉、印地、波斯、阿拉伯、坦米爾、土耳其、印尼、史瓦希里、韓、日、吉爾吉斯、中文（只評子音）。越南語與泰語目前不評分。

**準確度注意**：目前只用合成語音（eSpeak）測過。合成語音上，故意唸錯的方向判斷得出來（think 唸成 sink → s），但很多正確的發音也會被判成錯。要用真人聲音測試後才知道實際準確度。
