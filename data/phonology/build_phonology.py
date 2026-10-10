# -*- coding: utf-8 -*-
# 產生 site/js/data/phonology.js：各語言的音位清單（PHOIBLE）與範例資料每個字的音素。
# 執行：.venv/bin/python data/phonology/build_phonology.py <phoible.csv 路徑>
#   英文等語言用 eSpeak NG 轉 IPA；日文用 pyopenjtalk（處理は→wa、を→o、長音等）再轉 IPA。
# 音位清單：PHOIBLE 2.0（Moran & McCloy 2019），CC BY-SA 3.0。
import csv, json, re, subprocess, sys, os
from collections import defaultdict
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
PHOIBLE = sys.argv[1]

# WALS 語言代碼 → ISO 639-3（PHOIBLE 以 ISO 對應）
ISO = {'eng': 'eng', 'ger': 'deu', 'spa': 'spa', 'por': 'por', 'fre': 'fra', 'ita': 'ita', 'rus': 'rus', 'ben': 'ben', 'hin': 'hin',
       'prs': 'pes', 'ams': 'arb', 'tml': 'tam', 'mnd': 'cmn', 'tur': 'tur', 'jpn': 'jpn', 'kor': 'kor', 'vie': 'vie', 'ind': 'ind', 'tha': 'tha', 'swa': 'swh'}
# 同一語言有多份清單時：學習目標語言指定與所用語音一致的清單；其他依來源優先順序（寬式標音優先）
PREFER = {'eng': '2175',   # 美國西部／中西部，對應 eSpeak 的 en-us 語音
          'jpn': '384',    # UPSID 日語（寬式）
          'mnd': '1047'}   # 北京話（PHOIBLE 整理）
PRIORITY = ['ph', 'upsid', 'gm', 'ea', 'uz', 'aa', 'ra', 'saphon', 'er', 'spa']

rows = defaultdict(list)
meta = {}
with open(PHOIBLE, encoding='utf-8') as f:
    for r in csv.DictReader(f):
        if r['ISO6393'] in ISO.values():
            rows[r['InventoryID']].append(r)
            meta[r['InventoryID']] = (r['ISO6393'], r['Source'], r['LanguageName'])
INV, SRC = {}, {}
for wid, iso in ISO.items():
    cands = [i for i, m in meta.items() if m[0] == iso]
    if not cands: continue
    best = PREFER.get(wid) if PREFER.get(wid) in cands else sorted(cands, key=lambda i: (PRIORITY.index(meta[i][1]) if meta[i][1] in PRIORITY else 99, int(i)))[0]
    INV[wid] = sorted({r['Phoneme'] for r in rows[best] if r['SegmentClass'] != 'tone'})   # 邊緣音位也保留（例如日文的 ɡ、w）
    SRC[wid] = {'inventory': best, 'source': meta[best][1], 'name': meta[best][2]}
    # 分類：子音、母音（用 PHOIBLE 的 SegmentClass）
CLASS = {}
for inv in rows.values():
    for r in inv: CLASS.setdefault(r['Phoneme'], r['SegmentClass'])

# ---- 每個字的 IPA ----
sys.path.insert(0, os.path.join(ROOT, 'site', 'js', 'data'))
def sample_words(lang):
    """示範來源（site/data/sources/ 的資料檔，見清單 index.json）裡的所有字"""
    data = os.path.join(ROOT, 'site', 'data', 'sources')
    files = [os.path.join(data, f) for f in json.load(open(os.path.join(data, 'index.json'))).get(lang, [])]
    out = set()
    for path in files:
        src = open(path, encoding='utf-8').read()
        for sent in re.findall(r"""['"]([^'"\n]*\|PUNCT[^'"\n]*)['"]""", src):
            for tok in sent.split(' '):
                p = tok.split('|')
                if len(p) < 2 or p[1] in ('PUNCT', 'SYM', 'X'): continue
                out.add(p[0]); out.add(p[2] if len(p) > 2 and p[2] else p[0].lower())
    return sorted(out)

def espeak(text, voice):
    ipa = subprocess.run(['espeak-ng', '-v', voice, '-q', '--ipa', text], capture_output=True, text=True).stdout.strip()
    return re.sub(r'[ˈˌ‿\s_]', '', ipa)

OJT = {'a': 'a', 'i': 'i', 'u': 'ɯ', 'e': 'e', 'o': 'o', 'A': 'a', 'I': 'i', 'U': 'ɯ', 'E': 'e', 'O': 'o', 'N': 'ɴ',
       'k': 'k', 'ky': 'kʲ', 'g': 'ɡ', 'gy': 'ɡʲ', 's': 's', 'sh': 'ɕ', 'z': 'z', 'j': 'dʑ', 't': 't', 'ty': 'tʲ', 'ts': 'ts', 'ch': 'tɕ',
       'd': 'd', 'dy': 'dʲ', 'n': 'n', 'ny': 'ɲ', 'h': 'h', 'hy': 'ç', 'f': 'ɸ', 'b': 'b', 'by': 'bʲ', 'p': 'p', 'py': 'pʲ',
       'm': 'm', 'my': 'mʲ', 'y': 'j', 'r': 'ɾ', 'ry': 'ɾʲ', 'w': 'w', 'v': 'v'}
def openjtalk(text):
    import pyopenjtalk
    ph = [p for p in pyopenjtalk.g2p(text).split(' ') if p not in ('pau', '')]
    out = []
    for i, p in enumerate(ph):
        if p == 'cl':                     # 促音：下一個子音變長
            out.append('ː' if i + 1 < len(ph) else ''); continue
        s = OJT.get(p, p)
        if out and s in 'aiɯeo' and out[-1] == s: out[-1] = s + 'ː'   # 長音
        else: out.append(s)
    return ''.join(out)

import unicodedata
def norm(s):
    """比較用：去掉長音與附加符號（例如齒音、舌位），保留送氣 ʰ、顎化 ʲ 等會區分意思的記號"""
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').replace('ː', '').replace('|', '')
# 不同工具對同一個音的寫法差異（只用在把字的發音切成音位時）
EQUIV = {'ɹ': ['ɻ', 'r'], 'ɻ': ['ɹ', 'r'], 'e': ['ɛ', 'eɪ'], 'ɛ': ['e'], 'o': ['ɔ', 'oʊ'], 'ɔ': ['o', 'ɑ'], 'a': ['ɑ'], 'ɑ': ['a'],
         'ʌ': ['ɐ', 'ə'], 'ɐ': ['ə', 'ʌ'], 'ɚ': ['ə'], 'ɜ': ['ə', 'ɚ'], 'i': ['iɪ', 'ɪ'], 'u': ['ʊ', 'ɯ'], 'ᵻ': ['ɪ'], 'ɾ': ['tʰ', 'd'],
         'ɕ': ['s', 'ʃ'], 'ʑ': ['z', 'ʒ'], 'ɸ': ['h', 'f'], 'ç': ['h'], 'ɲ': ['n']}

def segment(ipa, inv):
    """依目標語言的音位清單切音：先找完全相同，再找去掉細節後相同，再找送氣版本，最後找寫法相近的音"""
    by_norm = {}
    for x in sorted(inv, key=len):
        by_norm.setdefault(norm(x), x)
    tokens = sorted(set(inv) | set(by_norm), key=len, reverse=True)
    segs, i = [], 0
    while i < len(ipa):
        for tkn in tokens:
            if ipa.startswith(tkn, i):
                seg = tkn if tkn in inv else by_norm[tkn]; i += len(tkn); break
        else:
            c = ipa[i]; i += 1
            if c == 'ː' and segs: segs[-1] = by_norm.get(norm(segs[-1]) + 'ː', segs[-1]); continue
            seg = by_norm.get(norm(c)) or by_norm.get(c + 'ʰ') or next((by_norm[norm(e)] for e in EQUIV.get(c, []) if norm(e) in by_norm), c)
        segs.append(seg)
    return segs

WORDS = {}
for lang, wid, voice in [('en', 'eng', 'en-us'), ('ja', 'jpn', None)]:
    WORDS[lang] = {}
    for w in sample_words(lang):
        ipa = espeak(w, voice) if voice else openjtalk(w)
        WORDS[lang][w] = segment(ipa, INV[wid])

js = ('// 自動產生（data/phonology/build_phonology.py），請勿手動修改。\n'
      '// 音位清單：Moran, Steven & McCloy, Daniel (eds.) 2019. PHOIBLE 2.0. Jena: Max Planck Institute for the Science of Human History. (CC BY-SA 3.0)\n'
      '// 字的發音：eSpeak NG（英文）、pyopenjtalk（日文）。\n'
      f'export const INVENTORIES = {json.dumps(INV, ensure_ascii=False)};\n'
      f'export const INVENTORY_SOURCES = {json.dumps(SRC, ensure_ascii=False)};\n'
      f'export const SEGMENT_CLASS = {json.dumps({s: CLASS.get(s, "") for v in INV.values() for s in v}, ensure_ascii=False)};\n'
      f'export const WORD_IPA = {json.dumps(WORDS, ensure_ascii=False)};\n')
open(os.path.join(ROOT, 'site', 'js', 'data', 'phonology.js'), 'w', encoding='utf-8').write(js)
print({k: len(v) for k, v in INV.items()})
print({k: v['source'] for k, v in SRC.items()})
for lang in WORDS: print(lang, len(WORDS[lang]), list(WORDS[lang].items())[:8])
