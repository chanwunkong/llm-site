# POS 標籤規範 (Part-of-Speech Specification)

本文件定義 Hexagon Vocabulary & Grammar 的詞性標籤系統、CSV 欄位格式，以及 WALS 規則與 POS 的對照關係。
**所有 CSV 題庫的 POS 欄位必須嚴格使用本文件定義的標籤。**

---

## 一、POS 標籤列表

使用 `category.subcategory` 點記法，全部小寫。子類別可選填；若無適合的子類別，使用主類別即可。

### 名詞類
| 標籤 | 說明 | 範例 |
|------|------|------|
| `noun` | 一般名詞 | cat, 猫, chat |
| `noun.proper` | 專有名詞（人名、地名） | Tokyo, Marie |
| `pronoun` | 代名詞（通用） | — |
| `pronoun.personal` | 人稱代名詞 | I, he, she, 我, 彼 |
| `pronoun.demonstrative` | 指示代名詞 | this, that, これ, 那 |
| `pronoun.reflexive` | 反身代名詞 | myself, 自己 |
| `pronoun.relative` | 關係代名詞 | who, which, that |

### 動詞類
| 標籤 | 說明 | 範例 |
|------|------|------|
| `verb` | 一般動詞（現在式/原形） | run, 走る, courir |
| `verb.past` | 動詞過去式 | ran, walked, 走った |
| `verb.future` | 未來式動詞標記 | — |
| `verb.progressive` | 進行式形式 | running, 走っている |
| `auxiliary` | 助動詞（通用） | be, have, do |
| `auxiliary.modal` | 情態助動詞 | can, will, must, 能, peut |
| `auxiliary.future` | 未來時助動詞 | will, shall, aller |

### 形容詞類
| 標籤 | 說明 | 範例 |
|------|------|------|
| `adjective` | 一般形容詞 | big, 大きい, grand |
| `adjective.comparative` | 比較級形容詞 | bigger, 大きい（より） |
| `adjective.superlative` | 最高級形容詞 | biggest |

### 限定詞類
| 標籤 | 說明 | 範例 |
|------|------|------|
| `article.definite` | 定冠詞 | the, le/la, der/die/das, el/la |
| `article.indefinite` | 不定冠詞 | a, an, un/une, ein/eine |
| `numeral` | 基數詞 | one, two, 一, deux |
| `numeral.ordinal` | 序數詞 | first, 一番目, premier |

### 副詞與修飾類
| 標籤 | 說明 | 範例 |
|------|------|------|
| `adverb` | 副詞 | quickly, very, 很, très |
| `negation` | 否定詞 | not, no, never, 不, 没, ne |

### 功能詞類
| 標籤 | 說明 | 範例 |
|------|------|------|
| `preposition` | 介系詞 | in, on, at, de, に |
| `conjunction` | 連接詞 | and, but, or, et, が |
| `interjection` | 感嘆詞 | oh, wow, hey, 啊 |
| `particle` | 語助詞（語法標記） | 的, は, が, を, 了 |

---

## 二、Morphological 欄位格式

使用 `/` 分隔各變化形，順序依詞性類型固定：

| 詞性 | 格式 | 範例 |
|------|------|------|
| 名詞 | `單數/複數` | `cat/cats`、`man/men`、`猫/猫たち` |
| 動詞 | `原形/過去式/進行式/第三人稱現在` | `run/ran/running/runs` |
| 形容詞 | `原形/比較級/最高級` | `big/bigger/biggest` |
| 無變化詞 | 只填原形 | `the`、`and`、`的` |

**WALS 26 判讀（綴詞傾向）：** 比較各變化形與原形，差異在字尾 → 後綴語言；差異在字首 → 前綴語言；內部元音交替 → 屈折語。

**WALS 33 判讀（複數標記）：** 取名詞的 `單數/複數`，比較兩者差異位置。`cat/cats`（字尾加 s）→ 後綴標記；`mouse/mice`（元音交替）→ 非後綴；`猫/猫たち`（字尾加たち）→ 後綴標記。

---

## 三、CSV 題庫格式範例

```csv
Word,Phonetic,POS,Morphological,Sentence,Etymology
cat,/kæt/,noun,cat/cats,The cat is sleeping.,Old English catt
run,/rʌn/,verb,run/ran/running/runs,She runs every day.,Old English rinnan
big,/bɪɡ/,adjective,big/bigger/biggest,He has a big house.,Origin unknown
the,/ðə/,article.definite,the,The cat is here.,Old English þē
a,/ə/,article.indefinite,a,I see a cat.,Old English ān
will,/wɪl/,auxiliary.future,will,She will go tomorrow.,Old English willan
not,/nɒt/,negation,not,I do not know.,Old English naht
this,/ðɪs/,pronoun.demonstrative,this/these,This cat is mine.,Old English þis
two,/tuː/,numeral,two,I have two cats.,Old English twā
```

---

## 四、WALS A1 規則定義

每條規則定義驗證所需的 POS 標籤與序列邏輯。

### A 類：語序規則（POS 序列）

**WALS 81 — 核心語序 (SVO)**
- 需要：`pronoun.personal / noun` + `verb` + `noun / pronoun`
- 驗證：句子中 [主語 POS] 出現在 [動詞 POS] 之前

**WALS 87 — 形容詞與名詞**
- 需要：`adjective` + `noun`
- 驗證：任何 [adjective] 出現在相鄰或較近的 [noun] 之前（前置修飾）

**WALS 88 — 指示詞與名詞**
- 需要：`pronoun.demonstrative` + `noun`
- 驗證：[pronoun.demonstrative] 出現在 [noun] 之前

**WALS 89 — 數詞與名詞**
- 需要：`numeral` + `noun`
- 驗證：[numeral] 出現在 [noun] 之前

### B 類：出現規則（特定 POS 是否存在）

**WALS 37 — 定冠詞**
- 需要：`article.definite`
- 驗證：句中存在至少一個 POS 為 `article.definite` 的詞

**WALS 38 — 不定冠詞**
- 需要：`article.indefinite`
- 驗證：句中存在至少一個 POS 為 `article.indefinite` 的詞

**WALS 66 — 過去式**
- 需要：`verb.past`
- 驗證：句中存在至少一個 POS 為 `verb.past` 的詞

**WALS 67 — 未來式**
- 需要：`auxiliary.future` 或 `verb.future`
- 驗證：句中存在至少一個符合上述 POS 的詞

**WALS 112 — 否定詞**
- 需要：`negation`
- 驗證：句中存在至少一個 POS 為 `negation` 的詞

**WALS 116 — 是非問句**
- 需要：`auxiliary`（任何子類別）
- 驗證：POS 為 `auxiliary.*` 的詞出現在句首，且句子以 `?` 結尾

### C 類：形態規則（Morphological 欄位）

**WALS 26 — 綴詞傾向**
- 取句中已知詞的 morphological 欄位
- 比較各變化形與原形的差異位置（字首 / 字尾 / 內部）
- 若多數差異在字尾 → 後綴語言規則成立

**WALS 33 — 複數標記**
- 取句中名詞的 morphological 欄位（格式：`單數/複數`）
- 若複數形 = 單數形 + 字尾字串 → 後綴複數標記規則成立

---

## 五、getPosColor() 色彩對照

| POS 主類別 | 顏色代碼 | 顏色描述 |
|------------|----------|----------|
| `noun` / `noun.proper` | `#e6f2ff` | 淺藍 |
| `pronoun.*` | `#dce8ff` | 中藍 |
| `verb.*` / `auxiliary.*` | `#ffe6e6` | 淺紅 |
| `adjective.*` | `#e6ffe6` | 淺綠 |
| `adverb` | `#ffecd9` | 淺橙 |
| `article.*` / `numeral.*` | `#f0e6ff` | 淺紫 |
| `negation` | `#ffe6f0` | 淺粉 |
| `preposition` / `conjunction` | `#e8f5e9` | 薄荷 |
| `particle` / `interjection` | `#ffffe6` | 淺黃 |
