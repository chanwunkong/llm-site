# -*- coding: utf-8 -*-
# 產生 site/js/data/base.js：各學習語言的基礎單字集（詞元 → 概念與圖示）
# 第一層：NSM 65 個語意基元（nsm-primes.csv）；第二層：日常概念（concepts-a1.csv）。第一層優先。
# 日文第二層只有範例資料用到的字（concepts-ja-draft.csv，草稿）。
# 第一層支援 21 種語言：nsm-exponents.csv（英文為 NSM 標準寫法，其他語言是草稿，要母語者確認）。
# 各語言的斷詞標註工具寫字典形的方式不同（德文名詞大寫、阿拉伯文加母音符號、土耳其文用詞幹），
# 日文例外：題目的字典形來自 kuromoji，表上已經是字典形，不送 UDPipe（UDPipe 會把「たら」變成「た」，誤配到過去式）。
# 所以每個字也送到該語言的 UDPipe 模型，取工具產生的字典形一起收錄；結果存在 nsm-exponents-ud.json，表沒有變就不再連線。
import csv, json, os, re, sys, urllib.parse, urllib.request

def clean(word):
    w = re.sub(r'\([^)]*\)', '', word).strip()
    return w.split('/')[0].strip().lower()

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'site', 'js', 'data'))
# 語言代碼 → UDPipe 模型（與 site/js/data/langs.js 相同）；沒有模型的語言（孟加拉文、史瓦希里文）只收原寫法與小寫
MODEL = {'en': 'english', 'de': 'german', 'es': 'spanish', 'pt': 'portuguese', 'fr': 'french', 'it': 'italian', 'ru': 'russian',
         'hi': 'hindi', 'fa': 'persian', 'ar': 'arabic', 'ta': 'tamil', 'zh': 'chinese-gsd', 'tr': 'turkish',
         'ko': 'korean', 'vi': 'vietnamese', 'id': 'indonesian', 'th': 'thai', 'ky': 'kyrgyz'}
CACHE = 'nsm-exponents-ud.json'
cache = json.load(open(CACHE, encoding='utf-8')) if os.path.exists(CACHE) else {}

def ud_lemmas(lang, words):
    """每個字送到 UDPipe（一行一個字），回傳 {字: 工具的字典形}"""
    todo = [w for w in words if f'{lang}|{w}' not in cache]
    if todo and lang in MODEL:
        body = urllib.parse.urlencode({'model': MODEL[lang], 'tokenizer': 'presegmented', 'tagger': '', 'data': '\n'.join(todo)}).encode()
        res = json.load(urllib.request.urlopen('https://lindat.mff.cuni.cz/services/udpipe/api/process', body, timeout=120))['result']
        sents, cur = [], []
        for line in res.split('\n'):
            if not line.strip():
                if cur: sents.append(cur); cur = []
                continue
            if line.startswith('#'): continue
            c = line.split('\t')
            if '-' in c[0] or '.' in c[0]: continue
            cur.append(c[2])
        if cur: sents.append(cur)
        for w, lem in zip(todo, sents):
            cache[f'{lang}|{w}'] = lem[0] if len(lem) == 1 else ''
    return {w: cache.get(f'{lang}|{w}', '') for w in words}

base = {}
def add(lang, lemma, rec):
    lemma = (lemma or '').strip().replace(' ', '\u00a0')   # 越南文等語言的字可以含空格（匯入時換成不斷行空格）
    if not lemma or lemma.startswith('〜') or "'" in lemma: return
    base.setdefault(lang, {}).setdefault(lemma, rec)

prime = {p['id']: p for p in csv.DictReader(open('nsm-primes.csv', encoding='utf-8'))}
exps = list(csv.DictReader(open('nsm-exponents.csv', encoding='utf-8')))
langs = [k for k in exps[0] if k != 'prime']
for lang in langs:
    words = sorted({w.strip() for e in exps for w in e[lang].split(';') if w.strip()})
    lem = ud_lemmas(lang, words)
    for e in exps:
        p = prime[e['prime']]
        rec = {'id': p['id'], 'tier': 1, 'template': p['template'], 'icon': p['icon']}
        for w in (x.strip() for x in e[lang].split(';')):
            if not w: continue
            add(lang, clean(w) if lang == 'en' else w, rec)
            add(lang, w.lower(), rec)
            if lem.get(w): add(lang, lem[w], rec)
json.dump(cache, open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)

concepts = {c['id']: c for c in csv.DictReader(open('concepts-a1.csv', encoding='utf-8'))}
for c in concepts.values():
    rec = {'id': c['id'], 'tier': 2, 'template': c['template'], 'icon': c['icon']}
    for h in c['cefrj_headwords'].split(';'): add('en', clean(h), rec)
for r in csv.DictReader(open('concepts-ja-draft.csv', encoding='utf-8')):
    c = concepts[r['concept_id']]
    for w in r['ja_lemmas'].split(';'): add('ja', w.strip(), {'id': c['id'], 'tier': 2, 'template': c['template'], 'icon': c['icon']})

js = ('// 自動產生（data/concepts/build_base.py），請勿手動修改。\n'
      '// 第一層：NSM 語意基元；第二層：日常概念（種子為 The CEFR-J Wordlist Version 1.5, compiled by Yukio Tono, TUFS）。\n'
      f'export const BASE = {json.dumps(base, ensure_ascii=False)};\n')
open('../../site/js/data/base.js', 'w', encoding='utf-8').write(js)
# ---- 內建來源「基元 65」：每種語言一個資料檔 site/data/core/<語言>.json ----
# 相對的基元：Lv2 的干擾選項、Lv3 的一對題
OPPOSITE = [('BIG', 'SMALL'), ('GOOD', 'BAD'), ('BEFORE', 'AFTER'), ('ABOVE', 'BELOW'), ('FAR', 'NEAR'), ('MUCH_MANY', 'LITTLE_FEW'),
            ('LONG_TIME', 'SHORT_TIME'), ('LIVE', 'DIE'), ('THE_SAME', 'OTHER'), ('WANT', 'DONT_WANT'), ('SEE', 'HEAR'), ('I', 'YOU'),
            ('ONE', 'TWO'), ('ALL', 'SOME'), ('THINK', 'KNOW'), ('TRUE', 'MAYBE'), ('IF', 'BECAUSE'), ('SOMEONE', 'SOMETHING'),
            ('KIND', 'PART'), ('DO', 'HAPPEN'), ('BE_SOMEWHERE', 'THERE_IS'), ('WHEN_TIME', 'WHERE_PLACE'), ('MOMENT', 'FOR_SOME_TIME'),
            ('NOW', 'HERE'), ('SAY', 'WORDS'), ('INSIDE', 'SIDE'), ('MORE', 'VERY'), ('PEOPLE', 'BODY'), ('MOVE', 'TOUCH'), ('NOT', 'CAN')]
opp = {}
for a, b in OPPOSITE: opp[a], opp[b] = b, a
core_dir = os.path.join('..', '..', 'site', 'data', 'core')
os.makedirs(core_dir, exist_ok=True)
index = []
for lang in langs:
    primes = []
    for e in exps:
        words = [w.strip() for w in e[lang].split(';') if w.strip()]
        if not words: continue
        p = prime[e['prime']]
        primes.append({'id': p['id'], 'key': words[0], 'words': words, 'group': p['group'], 'opposite': opp.get(p['id']),
                       'icon': {'id': p['id'], 'tier': 1, 'template': p['template'], 'icon': p['icon']}})
    json.dump({'lang': lang, 'primes': primes}, open(os.path.join(core_dir, f'{lang}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    index.append(lang)
json.dump(index, open(os.path.join(core_dir, 'index.json'), 'w', encoding='utf-8'))

print({k: len(v) for k, v in base.items()})
print('tier1', {k: len({r['id'] for r in v.values() if r['tier'] == 1}) for k, v in base.items()})
