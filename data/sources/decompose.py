# -*- coding: utf-8 -*-
"""本機拆解腳本：把一篇長文拆成網站用的來源資料（情境 → 句子 → 每個字的 UD 詞性、詞元、詞形特徵）。

用 Stanza（Apache 2.0）做斷句與詞性標註，只依賴 UD 的通用標記，任何 Stanza 支援的語言都能用。
日文例外：Stanza 的日文詞元常出錯（あたま → 勧ま），改用 pyopenjtalk（NAIST 日本語辭書）斷詞，再把日文詞類對應到 UD。
語言專屬的對應只放在這個前處理腳本裡；網站的邏輯仍然只認 UD。
輸出資料檔 site/data/sources/<id>.json，並更新清單 site/data/sources/index.json；網站啟動時讀取清單載入。
示範資料只放在資料檔，不寫進程式碼。

用法：.venv/bin/python data/sources/decompose.py <來源設定 id>
設定寫在 SOURCES；新增來源只要加一筆設定（原文檔、語言、怎麼清理、怎麼分章）。
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, 'data', 'sources', 'raw')
OUT = os.path.join(ROOT, 'site', 'data', 'sources')

# 情境的大小：一局只從目前的情境出題，太大會一直練不完、太小會變成背誦
SIT_MIN, SIT_MAX = 25, 45
# 太長的句子在手機上不好作答，太短的（只有一兩個字的對白）沒有語境
MIN_WORDS = 3
# 日文切得比較細（助詞、ます、た 各算一個），上限放寬
MAX_WORDS = {'en': 22, 'ja': 32}


def clean_gutenberg(text):
    text = text.split('*** START OF', 1)[1].split('\n', 1)[1]
    return text.split('*** END OF', 1)[0]


def clean_aozora(text):
    # 去掉檔頭的記號說明、檔尾的底本資訊、ルビ、入力者注
    parts = re.split(r'-{20,}', text)
    body = parts[2] if len(parts) >= 3 else text
    body = re.split(r'\n底本：', body)[0]
    body = re.sub(r'《[^》]*》', '', body)
    body = re.sub(r'［＃[^］]*］', '', body)
    return body.replace('｜', '').replace('　', '')


def read_plain(text):
    return text


SOURCES = {
    'en-oz': {
        'lang': 'en', 'file': 'oz.txt', 'encoding': 'utf-8', 'clean': clean_gutenberg,
        'title': 'The Wonderful Wizard of Oz', 'kind': '小說', 'credit': 'L. Frank Baum, 1900（公版，Project Gutenberg #55）',
        # 目錄之後才是正文；每章以「Chapter I」開頭，下一行是章名
        'chapters': r'\n\s*Chapter ([IVXL]+)\s*\n+\s*(.+?)\s*\n', 'skip_toc': True, 'max_chapters': 8,
    },
    'ja-tebukuro': {
        'lang': 'ja', 'file': 'tebukuroo_kaini.txt', 'encoding': 'shift_jis', 'clean': clean_aozora,
        'title': '手袋を買いに', 'kind': '童話', 'credit': '新美南吉, 1943（公版，青空文庫）', 'chapters': None,
    },
    'ja-chumon': {
        'lang': 'ja', 'file': 'chumonno_oi_ryoriten.txt', 'encoding': 'shift_jis', 'clean': clean_aozora,
        'title': '注文の多い料理店', 'kind': '童話', 'credit': '宮沢賢治, 1924（公版，青空文庫）', 'chapters': None,
    },
    # 依《小王子》劇情自行改寫的簡易版本（本專案撰寫）；原文檔以「# 段落標題」分段
    'en-prince': {
        'lang': 'en', 'file': 'prince-en.txt', 'encoding': 'utf-8', 'clean': read_plain,
        'title': 'The Little Prince（改寫版）', 'kind': '故事', 'credit': '依《小王子》劇情自行改寫（本專案）',
        'chapters': r'(?m)^#\s*(.+?)\s*$', 'title_group': 1,
    },
    'ja-prince': {
        'lang': 'ja', 'file': 'prince-ja.txt', 'encoding': 'utf-8', 'clean': read_plain,
        'title': '星の王子さま（改作）', 'kind': '故事', 'credit': '依《小王子》劇情自行改寫（本專案）',
        'chapters': r'(?m)^#\s*(.+?)\s*$', 'title_group': 1,
    },
}


def chapters_of(cfg, body):
    """回傳 [(章名, 文字)]；沒有分章的作品整篇當一章"""
    if not cfg.get('chapters'):
        return [(cfg['title'], body)]
    ms = list(re.finditer(cfg['chapters'], body))
    if cfg.get('skip_toc'):
        # 目錄裡的章名連在一起出現；正文的「Chapter I」是第二次出現的那個
        first = [i for i, m in enumerate(ms) if m.group(1) == 'I']
        ms = ms[first[1]:] if len(first) > 1 else ms
    out = []
    for i, m in enumerate(ms):
        end = ms[i + 1].start() if i + 1 < len(ms) else len(body)
        out.append((m.group(cfg.get('title_group', 2)).strip(), body[m.end():end]))
    return out[: cfg.get('max_chapters') or None]


# ---- 日文：pyopenjtalk 的詞類 → UD ----
JA_CLOSED_PARTICLE = {'接続助詞': 'SCONJ', '終助詞': 'PART'}
JA_DEM = ('この', 'その', 'あの', 'これ', 'それ', 'あれ', 'ここ', 'そこ', 'あそこ')
# 疑問詞（日文斷詞工具不標）：用來排除「何、どこ…」開頭的問句，它們不是是非問句
JA_INT = ('何', 'なに', 'なん', '誰', 'だれ', 'どこ', 'いつ', 'どれ', 'どう', 'なぜ', 'どうして', 'どちら', 'どっち', 'いくつ', 'いくら', 'どんな', 'どの')

class JaWord:
    def __init__(self, text, upos, lemma, feats=''):
        self.text, self.upos, self.lemma, self.feats = text, upos, lemma, feats

def ja_upos(n):
    pos, g1 = n['pos'], n['pos_group1']
    if pos == '名詞':
        return {'代名詞': 'PRON', '固有名詞': 'PROPN', '数': 'NUM'}.get(g1, 'NOUN')
    if pos == '動詞': return 'AUX' if g1 in ('非自立', '接尾') else 'VERB'
    if pos == '形容詞': return 'AUX' if g1 == '非自立' else 'ADJ'
    if pos == '助詞': return JA_CLOSED_PARTICLE.get(g1, 'ADP')
    return {'副詞': 'ADV', '連体詞': 'DET', '接続詞': 'CCONJ', '感動詞': 'INTJ', '助動詞': 'AUX',
            '記号': 'PUNCT', '接頭詞': 'PART', 'フィラー': 'INTJ'}.get(pos, 'X')

def ja_feats(n, upos):
    f = []
    if n['pos'] == '助動詞' and n['ctype'] in ('特殊・タ',): f.append('Tense=Past')
    if n['pos'] == '助動詞' and n['ctype'] in ('特殊・ナイ', '特殊・ヌ'): f.append('Polarity=Neg')
    if n['string'] in JA_DEM: f.append('PronType=Dem')
    if n['string'] in JA_INT: f.append('PronType=Int')
    return ';'.join(f)

def ja_sentences(text):
    import pyopenjtalk
    # 句點、驚嘆號、問號（後面可能接 」）之後斷句
    for sent in re.findall(r'.+?(?:[。！？]」?|$)', text):
        sent = sent.strip()
        if not sent: continue
        words = []
        for n in pyopenjtalk.run_frontend(sent):
            up = ja_upos(n)
            lemma = n['orig'] if n['orig'] not in ('*', '') else n['string']
            words.append(JaWord(n['string'], up, lemma, ja_feats(n, up)))
        yield words


def clean_form(t):
    return t.replace(' ', '').replace('|', '')


def encode(word, dep=None):
    """「寫法|UPOS|詞元|特徵|空格|依附」，後面空的欄位省略"""
    surface = clean_form(word.text)
    lemma = clean_form(word.lemma or surface)
    feats = (word.feats or '').replace('|', ';')
    parts = [surface, word.upos, lemma if lemma != surface.lower() else '', feats, '', f'{dep[0]},{dep[1]}' if dep else '']
    while len(parts) > 2 and not parts[-1]:
        parts.pop()
    return '|'.join(parts)


# ---- 句法分析：把已經切好的字送到 UDPipe（輸入格式 horizontal = 一行一句、字以空格分開），只取依存關係 ----
UDPIPE = 'https://lindat.mff.cuni.cz/services/udpipe/api/process'
UDPIPE_MODEL = {'en': 'english', 'ja': 'japanese-gsd'}

def parse_deps(lang, sents, batch=80):
    """sents：每句是字的清單。回傳每句每個字的 (依附的位置, 關係)；依附的位置從 0 算，句子核心是 -1"""
    import urllib.request, urllib.parse
    out = []
    for i in range(0, len(sents), batch):
        part = sents[i:i + batch]
        data = '\n'.join(' '.join(clean_form(w.text) for w in ws) for ws in part)
        body = urllib.parse.urlencode({'model': UDPIPE_MODEL[lang], 'input': 'horizontal', 'tagger': '', 'parser': '', 'data': data}).encode()
        res = json.load(urllib.request.urlopen(UDPIPE, body, timeout=120))['result']
        parsed, cur = [], []
        for line in res.split('\n'):
            if not line.strip():
                if cur: parsed.append(cur); cur = []
                continue
            if line.startswith('#'): continue
            c = line.split('\t')
            if '-' in c[0] or '.' in c[0]: continue
            cur.append((int(c[6]) - 1, c[7]))
        if cur: parsed.append(cur)
        for ws, deps in zip(part, parsed):
            out.append(deps if len(deps) == len(ws) else None)   # 字數對不上就不用
        print(f'  句法分析 {min(i + batch, len(sents))} / {len(sents)}')
    return out


def main(sid):
    import stanza
    cfg = SOURCES[sid]
    raw = open(os.path.join(RAW, cfg['file']), encoding=cfg['encoding'], errors='replace').read()
    body = cfg['clean'](raw)
    nlp = None if cfg['lang'] == 'ja' else stanza.Pipeline(cfg['lang'], processors='tokenize,mwt,pos,lemma',
                                                           verbose=False, download_method=stanza.DownloadMethod.REUSE_RESOURCES)
    chapters, kept, dropped = [], 0, 0
    for title, text in chapters_of(cfg, body):
        # 段落內的換行接起來（古騰堡每行約 70 字就換行）
        paras = [re.sub(r'\s*\n\s*', ' ' if cfg['lang'] == 'en' else '', p).strip() for p in re.split(r'\n\s*\n', text)]
        paras = [p for p in paras if p]
        if cfg['lang'] == 'ja':   # 青空文庫有時一句話跨兩行（「…しましたが、」換行），接起來交給 Stanza 斷句
            paras = [''.join(l.strip() for l in text.split('\n'))]
        sents = []
        parsed = ja_sentences(paras[0]) if nlp is None else (s.words for s in nlp('\n\n'.join(paras)).sentences)
        for words in parsed:
            n = sum(1 for w in words if w.upos not in ('PUNCT', 'SYM', 'X'))
            if MIN_WORDS <= n <= MAX_WORDS.get(cfg['lang'], 22):
                sents.append(list(words)); kept += 1
            else:
                dropped += 1
        chapters.append((title, sents))
    # 句法分析（全部的句子一起送），再編碼
    flat = [ws for _, ss in chapters for ws in ss]
    deps = parse_deps(cfg['lang'], flat)
    k_ = 0
    situations = []
    for title, ss in chapters:
        sents = []
        for ws in ss:
            d = deps[k_]; k_ += 1
            sents.append(' '.join(encode(w, d[j] if d else None) for j, w in enumerate(ws)))
        # 依句數切成大小相近的情境
        k = max(1, round(len(sents) / ((SIT_MIN + SIT_MAX) / 2)))
        size = -(-len(sents) // k)
        for i in range(k):
            chunk = sents[i * size:(i + 1) * size]
            if chunk:
                situations.append({'title': title if k == 1 else f'{title}（{i + 1}/{k}）', 'sentences': chunk})
    src = {'id': sid, 'kind': cfg['kind'], 'title': cfg['title'], 'credit': cfg['credit'], 'situations': situations}
    os.makedirs(OUT, exist_ok=True)
    src['generated'] = f'data/sources/decompose.py {sid}；斷句與詞性：Stanza（日文 pyopenjtalk）；句法分析：UDPipe（UD 2.17，CC BY-NC-SA）；句子格式：寫法|UPOS|詞元|特徵|空格|依附'
    path = os.path.join(OUT, sid + '.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(src, f, ensure_ascii=False, indent=0)
    write_index()
    print(f'{sid}: {len(situations)} 個情境，保留 {kept} 句、略過 {dropped} 句（太長或太短），{os.path.getsize(path) // 1024} KB')


def write_index():
    """清單：每個語言有哪些示範來源（依 SOURCES 的順序）"""
    idx = {}
    for sid, cfg in SOURCES.items():
        if os.path.exists(os.path.join(OUT, sid + '.json')):
            idx.setdefault(cfg['lang'], []).append(sid + '.json')
    with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(idx, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    for sid in sys.argv[1:] or SOURCES:
        main(sid)
