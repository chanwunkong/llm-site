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
