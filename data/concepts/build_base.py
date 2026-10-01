# -*- coding: utf-8 -*-
# 產生 site/js/data/base.js：各學習語言的基礎單字集（詞元 → 概念與圖示）
# 第一層：NSM 65 個語意基元（nsm-primes.csv）；第二層：日常概念（concepts-a1.csv）。第一層優先。
# 日文第二層只有範例資料用到的字（concepts-ja-draft.csv，草稿）。
import csv, json, re

def clean(word):
    w = re.sub(r'\([^)]*\)', '', word).strip()
    return w.split('/')[0].strip().lower()

base = {'en': {}, 'ja': {}}
def add(lang, lemma, rec):
    if not lemma or ' ' in lemma or lemma.startswith('〜') or "'" in lemma: return  # 只收單一詞元
    base[lang].setdefault(lemma, rec)

for p in csv.DictReader(open('nsm-primes.csv', encoding='utf-8')):
    if p['template'] == 'todo': continue          # 沒有圖示的基元靠語境學
    rec = {'id': p['id'], 'tier': 1, 'template': p['template'], 'icon': p['icon']}
    for w in p['en'].split(','): add('en', clean(w), rec)
    for w in p['ja_draft'].split(','): add('ja', w.strip(), rec)

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
print({k: len(v) for k, v in base.items()}, 'tier1 en', sum(1 for v in base['en'].values() if v['tier'] == 1))
