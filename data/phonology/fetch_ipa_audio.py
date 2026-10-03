# -*- coding: utf-8 -*-
"""下載單音的標準錄音（維基共享資源上 IPA 各音的錄音），轉成 mp3 放到 site/audio/ipa/。
每個音對應到英文維基百科的條目，取條目裡的錄音檔，並記錄作者與授權到 site/audio/ipa/credits.json。
用法：python3 data/phonology/fetch_ipa_audio.py
"""
import json, os, re, subprocess, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'site', 'audio', 'ipa')
UA = {'User-Agent': 'llm-site-ipa-fetch/1.0 (https://github.com/chanwunkong/llm-site)'}

PLACE = {'bilabial': 'bilabial', 'labiodental': 'labiodental', 'dental': 'dental', 'alveolar': 'alveolar',
         'postalveolar': 'palato-alveolar', 'alveolopalatal': 'alveolo-palatal', 'retroflex': 'retroflex',
         'palatal': 'palatal', 'velar': 'velar', 'uvular': 'uvular', 'pharyngeal': 'pharyngeal', 'glottal': 'glottal'}
MANNER = {'plosive': 'plosive', 'nasal': 'nasal', 'trill': 'trill', 'tap': 'tap', 'fricative': 'fricative',
          'affricate': 'affricate', 'latfric': 'lateral fricative', 'approximant': 'approximant', 'latapprox': 'lateral approximant'}
# 與 site/js/engine/ipa-chart.js 相同的位置
C = {}
def put(m, p, vl, vd):
    for s in ([vl] if isinstance(vl, str) else (vl or [])): C[s] = (m, p, False)
    for s in ([vd] if isinstance(vd, str) else (vd or [])): C[s] = (m, p, True)
for args in [('plosive','bilabial','p','b'),('plosive','alveolar','t','d'),('plosive','retroflex','ʈ','ɖ'),('plosive','palatal','c','ɟ'),
  ('plosive','velar','k','ɡ'),('plosive','uvular','q','ɢ'),('plosive','glottal','ʔ',None),('nasal','bilabial',None,'m'),('nasal','labiodental',None,'ɱ'),
  ('nasal','alveolar',None,'n'),('nasal','retroflex',None,'ɳ'),('nasal','palatal',None,'ɲ'),('nasal','velar',None,'ŋ'),('nasal','uvular',None,'ɴ'),
  ('trill','bilabial',None,'ʙ'),('trill','alveolar',None,'r'),('trill','uvular',None,'ʀ'),('tap','alveolar',None,'ɾ'),('tap','retroflex',None,'ɽ'),
  ('fricative','bilabial','ɸ','β'),('fricative','labiodental','f','v'),('fricative','dental','θ','ð'),('fricative','alveolar','s','z'),
  ('fricative','postalveolar','ʃ','ʒ'),('fricative','alveolopalatal','ɕ','ʑ'),('fricative','retroflex','ʂ','ʐ'),('fricative','palatal','ç','ʝ'),
  ('fricative','velar','x','ɣ'),('fricative','uvular','χ','ʁ'),('fricative','pharyngeal','ħ','ʕ'),('fricative','glottal','h','ɦ'),
  ('affricate','alveolar','ts','dz'),('affricate','postalveolar','tʃ','dʒ'),('affricate','alveolopalatal','tɕ','dʑ'),('affricate','retroflex','ʈʂ','ɖʐ'),
  ('latfric','alveolar','ɬ','ɮ'),('approximant','labiodental',None,'ʋ'),('approximant','alveolar',None,'ɹ'),('approximant','retroflex',None,'ɻ'),
  ('approximant','palatal',None,'j'),('approximant','velar',None,'ɰ'),('latapprox','alveolar',None,'l'),('latapprox','retroflex',None,'ɭ'),
  ('latapprox','palatal',None,'ʎ'),('latapprox','velar',None,'ʟ')]:
    put(*args)

TITLES = {}
for s, (m, p, vd) in C.items():
    TITLES[s] = [f"{'Voiced' if vd else 'Voiceless'} {PLACE[p]} {MANNER[m]}", f"{PLACE[p].capitalize()} {MANNER[m]}"]
TITLES.update({
    'w': ['Voiced labial–velar approximant'], 'ʍ': ['Voiceless labial–velar fricative'], 'ɥ': ['Voiced labial–palatal approximant'],
    'ʔ': ['Glottal stop'], 'ɾ': ['Voiced alveolar tap and flap', 'Alveolar tap'], 's': ['Voiceless alveolar fricative'], 'z': ['Voiced alveolar fricative'],
    'ʃ': ['Voiceless postalveolar fricative'], 'ʒ': ['Voiced postalveolar fricative'], 'tʃ': ['Voiceless postalveolar affricate'], 'dʒ': ['Voiced postalveolar affricate'],
})
V = {'i': 'Close front unrounded vowel', 'y': 'Close front rounded vowel', 'ɨ': 'Close central unrounded vowel', 'ʉ': 'Close central rounded vowel',
     'ɯ': 'Close back unrounded vowel', 'u': 'Close back rounded vowel', 'ɪ': 'Near-close near-front unrounded vowel', 'ʏ': 'Near-close near-front rounded vowel',
     'ʊ': 'Near-close near-back rounded vowel', 'e': 'Close-mid front unrounded vowel', 'ø': 'Close-mid front rounded vowel', 'ɘ': 'Close-mid central unrounded vowel',
     'ɵ': 'Close-mid central rounded vowel', 'ɤ': 'Close-mid back unrounded vowel', 'o': 'Close-mid back rounded vowel', 'ə': 'Mid central vowel',
     'ɛ': 'Open-mid front unrounded vowel', 'œ': 'Open-mid front rounded vowel', 'ɜ': 'Open-mid central unrounded vowel', 'ɞ': 'Open-mid central rounded vowel',
     'ʌ': 'Open-mid back unrounded vowel', 'ɔ': 'Open-mid back rounded vowel', 'æ': 'Near-open front unrounded vowel', 'ɐ': 'Near-open central vowel',
     'a': 'Open front unrounded vowel', 'ɶ': 'Open front rounded vowel', 'ɑ': 'Open back unrounded vowel', 'ɒ': 'Open back rounded vowel'}
for s, t in V.items(): TITLES[s] = [t]

# 自動比對容易抓到條目裡的其他例子，這些音直接指定標準錄音的檔名
FILES = {
    'p': 'Voiceless bilabial plosive.ogg', 'b': 'Voiced bilabial plosive.ogg', 't': 'Voiceless alveolar plosive.ogg', 'd': 'Voiced alveolar plosive.ogg',
    'ɟ': 'Voiced palatal plosive.ogg', 'ɢ': 'Voiced uvular stop.oga', 'n': 'Alveolar nasal.ogg', 'r': 'Alveolar trill.ogg', 'ʀ': 'Uvular trill.ogg',
    'ɾ': 'Alveolar tap.ogg', 'f': 'Voiceless labiodental fricative.ogg', 'v': 'Voiced labiodental fricative.ogg',
    's': 'Voiceless alveolar sibilant.ogg', 'z': 'Voiced alveolar sibilant.ogg', 'ʃ': 'Voiceless palato-alveolar sibilant.ogg', 'ʒ': 'Voiced palato-alveolar sibilant.ogg',
    'ʂ': 'Voiceless retroflex sibilant.ogg', 'ʐ': 'Voiced retroflex sibilant.ogg', 'tʃ': 'Voiceless palato-alveolar affricate.ogg', 'dʒ': 'Voiced palato-alveolar affricate.ogg',
    'ɬ': 'Voiceless alveolar lateral fricative.ogg', 'j': 'Palatal approximant.ogg', 'l': 'Alveolar lateral approximant.ogg', 'ɭ': 'Retroflex lateral approximant.ogg',
    'ʎ': 'Palatal lateral approximant.ogg', 'w': 'Voiced labio-velar approximant.ogg', 'ʍ': 'Voiceless labio-velar fricative.ogg', 'ɥ': 'Labial-palatal approximant.ogg',
    'ɐ': 'Near-open central unrounded vowel.ogg', 'ʌ': 'Open-mid back unrounded vowel.ogg', 'ɔ': 'Open-mid back rounded vowel.ogg', 'ɒ': 'Open back rounded vowel.ogg',
    'œ': 'Open-mid front rounded vowel.ogg', 'ɻ': 'Retroflex approximant.ogg', 'ʈ': 'Voiceless retroflex stop.oga', 'ɖ': 'Voiced retroflex stop.oga',
}

def exists(f):
    d = api('commons.wikimedia.org', {'action': 'query', 'titles': 'File:' + f, 'prop': 'imageinfo'})['query']['pages'][0]
    return not d.get('missing') and 'imageinfo' in d

def api(host, params):
    url = f'https://{host}/w/api.php?' + urllib.parse.urlencode({**params, 'format': 'json', 'formatversion': 2})
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return json.load(r)

def audio_of(title):
    d = api('en.wikipedia.org', {'action': 'query', 'titles': title, 'redirects': 1, 'prop': 'images', 'imlimit': 100})
    page = d['query']['pages'][0]
    if page.get('missing'): return None, None
    files = [i['title'] for i in page.get('images', []) if re.search(r'\.(ogg|oga|wav|mp3)$', i['title'], re.I)]
    if not files: return page['title'], None
    # 條目名稱的字最多出現在檔名裡的，就是資訊框裡的那個錄音
    words = set(re.findall(r'[a-z]+', page['title'].lower()))
    files.sort(key=lambda f: -len(words & set(re.findall(r'[a-z]+', f.lower()))))
    return page['title'], files[0]

def main():
    os.makedirs(OUT, exist_ok=True)
    credits, missing = {}, []
    for sym, titles in TITLES.items():
        got = None
        if sym in FILES:
            if exists(FILES[sym]): got = ('(指定)', 'File:' + FILES[sym])
            else: print('  指定檔不存在：', sym, FILES[sym])
        for t in ([] if got else titles):
            art, f = audio_of(t)
            if f: got = (art, f); break
        if not got: missing.append(sym); continue
        art, f = got
        info = api('commons.wikimedia.org', {'action': 'query', 'titles': f, 'prop': 'imageinfo', 'iiprop': 'url|extmetadata'})['query']['pages'][0]['imageinfo'][0]
        meta = info.get('extmetadata', {})
        clean = lambda k: re.sub(r'<[^>]+>', '', meta.get(k, {}).get('value', '')).strip()
        name = '%04x' % ord(sym[0]) + ('-' + '%04x' % ord(sym[1]) if len(sym) > 1 else '')
        src = os.path.join(OUT, name + '.src')
        with urllib.request.urlopen(urllib.request.Request(info['url'], headers=UA), timeout=60) as r, open(src, 'wb') as w: w.write(r.read())
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-ac', '1', '-b:a', '48k', os.path.join(OUT, name + '.mp3')], check=True)
        os.remove(src)
        credits[sym] = {'file': name + '.mp3', 'article': art, 'source': info['descriptionurl'] if 'descriptionurl' in info else f'https://commons.wikimedia.org/wiki/{urllib.parse.quote(f)}',
                        'author': clean('Artist'), 'license': clean('LicenseShortName')}
        print(sym, art, '|', f, '|', credits[sym]['license'])
    # ɥ 沒有標準錄音（條目裡只有法語單字的例子），不收
    if 'ɥ' in credits: os.remove(os.path.join(OUT, credits.pop('ɥ')['file']))
    json.dump(credits, open(os.path.join(OUT, 'credits.json'), 'w'), ensure_ascii=False, indent=1)
    with open(os.path.join(ROOT, 'site', 'js', 'data', 'ipa-audio.js'), 'w') as w:
        w.write('// 單音錄音（維基共享資源）：檔名、來源、作者與授權；由 data/phonology/fetch_ipa_audio.py 產生\n')
        w.write('export const IPA_AUDIO = ' + json.dumps(credits, ensure_ascii=False) + ';\n')
    print('missing:', ' '.join(missing))

main()
