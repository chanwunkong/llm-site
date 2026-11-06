# 發音資料

`build_phonology.py` 產生 `site/js/data/phonology.js`：
- **音位清單**：PHOIBLE 2.0。授權 **CC BY-SA 3.0**，因此產生的 `phonology.js` 中的音位清單也以 CC BY-SA 3.0 提供。
  引用：Moran, Steven & McCloy, Daniel (eds.) 2019. *PHOIBLE 2.0.* Jena: Max Planck Institute for the Science of Human History. https://phoible.org
- **字的發音**：英文用 eSpeak NG（`brew install espeak-ng`），日文用 pyopenjtalk（`pyopenjtalk-prebuilt`，需 numpy<2）。

執行方式（在 repo 根目錄）：
```
python3 -m venv .venv && .venv/bin/pip install pyopenjtalk-prebuilt "numpy<2"
curl -L -o /tmp/phoible.csv https://raw.githubusercontent.com/phoible/dev/master/data/phoible.csv
.venv/bin/python data/phonology/build_phonology.py /tmp/phoible.csv
```

## 單音錄音

`fetch_ipa_audio.py` 從維基共享資源下載 IPA 各音的標準錄音（多數為 Peter Isotalo 等人錄製），轉成 mp3 放在 `site/audio/ipa/`，並產生 `site/js/data/ipa-audio.js`。每個檔案的來源、作者與授權（CC BY-SA 3.0／4.0、CC BY、CC0、公眾領域）記錄在 `site/audio/ipa/credits.json`，發音頁的詳細面板也會顯示來源。ɥ 沒有標準錄音，不收。

## 字母和音的對應（build_letters.py）

給發音結果的字母上色用（像 ELSA）。每種語言取 wordfreq 最常用的 5000 個字，用 eSpeak NG（和評分服務同一套聲音）產生發音，
再用 EM 對齊學出「1～2 個字母 ↔ 0～K 個音」的機率，輸出到 `site/data/letters/<語言>.json`。
執行時 `site/js/engine/letters.js` 用這張表把字母對到服務回傳的每個音；中文、日文、斯瓦希里文、吉爾吉斯文沒有表，用通用規則。

```
pip install wordfreq        # 另外需要 espeak-ng
python data/phonology/build_letters.py            # 全部語言（約 3 分鐘）
python data/phonology/build_letters.py en de      # 只做某些語言
```
