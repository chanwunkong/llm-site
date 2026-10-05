# 來源拆解（本機腳本）

`decompose.py` 把一篇長文拆成網站用的來源資料：情境 → 句子 → 每個字的 UD 詞性、詞元、詞形特徵，輸出到 `site/js/data/sources/<id>.js`，再由 `site/js/data/<語言>.js` 匯入。

```
.venv/bin/python data/sources/decompose.py            # 全部來源
.venv/bin/python data/sources/decompose.py en-oz      # 指定來源
.venv/bin/python data/phonology/build_phonology.py <phoible.csv>   # 之後重建每個字的發音
```

- 斷句與標註：Stanza（Apache 2.0；`pip install stanza`，模型第一次執行時下載到 `~/stanza_resources`）。
- 日文例外：Stanza 的日文詞元常出錯，改用 pyopenjtalk（NAIST 日本語辭書）斷詞，再把日文詞類對應到 UD，並從助動詞標出 `Tense=Past`（た）與 `Polarity=Neg`（ない、ぬ）。語言專屬的對應只在這個前處理腳本裡，網站的邏輯只認 UD。
- 情境：依章節切，每個情境 25～45 句；太長（英文 22 字、日文 32 個詞以上）或太短（3 個字以下）的句子不收。
- 新增來源：在 `SOURCES` 加一筆設定（原文檔、語言、清理方式、分章規則）。

## 目前的示範來源（皆為公版）

| id | 作品 | 原文 |
|---|---|---|
| en-oz | L. Frank Baum, *The Wonderful Wizard of Oz*（1900），前 8 章 | Project Gutenberg #55（`raw/oz.txt`） |
| ja-tebukuro | 新美南吉〈手袋を買いに〉 | 青空文庫（`raw/tebukuroo_kaini.txt`，Shift_JIS） |
| ja-chumon | 宮沢賢治〈注文の多い料理店〉 | 青空文庫（`raw/chumonno_oi_ryoriten.txt`，Shift_JIS） |

## 網頁匯入

使用者也可以直接在網頁上匯入（首頁「＋ 匯入文章」），邏輯在 `site/js/engine/importer.js`，輸出格式與本腳本相同，存在瀏覽器的 localStorage：

- 16 種語言：UDPipe 線上服務（https://lindat.mff.cuni.cz/services/udpipe/ ，UD 2.17 模型，CC BY-NC-SA，限非商業使用）。多字詞（例如西班牙文 del = de + el）合成一個字，以實詞為主。
- 日文：kuromoji.js（Apache 2.0，從 jsDelivr 載入，字典約 17 MB），詞類對應規則與本腳本相同。
- 孟加拉語、史瓦希里語：沒有 UD 模型，用瀏覽器內建的 Intl.Segmenter 斷詞，沒有詞性。
- 句子格式多一個第 5 欄：`n` 表示這個字後面不空格（來自 UDPipe 的 SpaceAfter=No）。
