# 發音評分服務：介面 v1

遊戲和評分服務之間的約定。任何人自行架設的服務都使用同一個介面，所以遊戲只要換網址就能使用不同的服務。

## 共通規則

- 存取密碼：每個請求帶 `Authorization: Bearer <密碼>`。密碼不對時回傳 401 與 `{"ok": false, "code": "token"}`。
- 來源限制：只接受 `ALLOW_ORIGINS` 列出的網站（瀏覽器的 CORS）。其他網站回傳 403、`code: "origin"`。
- 次數限制：每個來源位址每分鐘 `RATE_PER_MIN` 次。超過時回傳 429、`code: "rate"`。
- 錯誤一律是 `{"ok": false, "code": "...", "msg": "給學習者看的中文說明"}`。

## GET /v1/health

不需要密碼也能呼叫；遊戲用它分辨「連不上」和「密碼錯誤」。

```json
{"ok": true, "version": "1.0.0", "model": "...", "authorized": true,
 "languages": {"en": "good", "zh": "no-tone", "vi": "unsupported", ...},
 "japanese_tool": "pyopenjtalk"}
```

語言的支援程度：

| 值 | 意思 |
|---|---|
| `good` | 可以評分 |
| `no-tone` | 只評子音；母音和聲調在同一個符號裡，不評（中文） |
| `unsupported` | 目前不評分（越南語、泰語） |

## POST /v1/phonemize

輸入 `{"text": "think", "lang": "en"}`（`lang` 是遊戲的語言代碼）。

```json
{"ok": true, "phones": ["θ", "ɪ", "ŋ", "k"], "ipa": ["θ", "ɪ", "ŋ", "k"], "scorable": [true, true, true, true]}
```

- `phones`：模型的音符號，評分時原樣送回。
- `ipa`：給畫面用的 IPA（模型的特殊寫法換成標準 IPA，例如 `ts.h` → `ʈʂʰ`）。
- `scorable`：這個位置能不能當目標音。

## POST /v1/score?lang=&phones=&target=

- `phones`：`/v1/phonemize` 回傳的 `phones`，JSON 字串（網址編碼）。
- `target`：目標音的位置（從 0 算）；`-1` 只確認是不是唸了這個字。
- 內容：錄音，float32 little-endian PCM，16 kHz 單聲道，最長 10 秒。瀏覽器端解碼與重新取樣。

```json
{"ok": true, "level": "bad", "target": "θ", "target_p": 0.25,
 "top": [{"ph": "f", "p": 0.42}, {"ph": "θ", "p": 0.25}], "score": 25, "ms": 140}
```

- `level`：`good`（目標音機率 ≥ 0.6）、`close`（≥ 0.25）、`bad`。
- `top`：模型認為最像的前 5 個音（`∅` 表示漏掉）。
- 聽不出是這個字時：`{"ok": false, "code": "not_the_word"}`；沒有聲音：`code: "no_speech"`。

服務**不保存錄音**。設定 `LOG_ATTEMPTS=1` 時，每次只印出一行分數。
