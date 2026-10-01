# NSM 65 個語意基元（Goddard & Wierzbicka 2014 版）：基礎單字集的第一層。
# 英文為 NSM 標準說法；日文依 NSM 日語研究整理，為「草稿」，需要母語者確認。
# icon：單一 emoji 或組合模板（contrast:*A|B）；「待設計」表示目前沒有夠清楚的圖示。
# clarity：A = 單看圖就明確；B = 慣用圖示，需搭配例句；C = 待設計。
# merges：第二層（CEFR-J 概念清單）中與此基元重疊、併入此基元的概念 ID。
import csv, collections

PRIMES = """
# 實體
I|實體|I, me|私|🙋|B|
YOU|實體|you|あなた|🫵|B|
SOMEONE|實體|someone, who|誰か, 誰|👤|B|
SOMETHING|實體|something, thing, what|何か, もの, 何|✳️|C|
PEOPLE|實體|people|人, 人々|👥|B|people
BODY|實體|body|体|🧍|B|
# 關係
KIND|關係|kind (of)|種類|🗂️|C|
PART|關係|part (of)|部分|🧩|B|piece
# 限定
THIS|限定|this|この, これ|👇|B|
THE_SAME|限定|the same|同じ|🟰|B|
OTHER|限定|other, else|他, 別|🔀|C|
# 數量
ONE|數量|one|一つ|1️⃣|A|
TWO|數量|two|二つ|2️⃣|A|
SOME|數量|some|いくつか|contrast:🍎🍎🍎🍎|*🍎🍎|C|
ALL|數量|all|全部, みんな|💯|B|
MUCH_MANY|數量|much, many|たくさん|contrast:*🍎🍎🍎|🍎|B|
LITTLE_FEW|數量|little, few|少し|contrast:🍎🍎🍎|*🍎|B|
# 評價
GOOD|評價|good|いい|👍|B|good
BAD|評價|bad|悪い|👎|B|bad
# 描述
BIG|描述|big|大きい|contrast:*🐘|🐭|B|big
SMALL|描述|small|小さい|contrast:🐘|*🐭|B|small
# 心智
THINK|心智|think|思う|🤔|A|think
KNOW|心智|know|知る, 分かる|💡|B|
WANT|心智|want|〜たい, ほしい|🫴|B|
DONT_WANT|心智|don't want|〜たくない, いらない|🙅|B|
FEEL|心智|feel|感じる|🫶|B|
SEE|心智|see|見る|👀|A|look
HEAR|心智|hear|聞く|🎧|B|listen
# 言語
SAY|言語|say|言う|🗣️|B|
WORDS|言語|words|言葉|💬|B|
TRUE|言語|true|本当|✅|B|correct
# 動作與事件
DO|動作|do|する|🛠️|C|
HAPPEN|動作|happen|起こる|💥|B|
MOVE|動作|move|動く|↪️|C|
# 存在與擁有
BE_SOMEWHERE|存在|be (somewhere)|いる, ある|📍|C|
THERE_IS|存在|there is|ある, いる|✨|C|
BE_SOMEONE|存在|be (someone/something)|〜だ, 〜である|🪪|C|
MINE|存在|(is) mine|私の|🤲|C|
# 生命
LIVE|生命|live (be alive)|生きる|💓|B|
DIE|生命|die|死ぬ|🥀|B|
# 時間
WHEN_TIME|時間|when, time|時, いつ|🕰️|B|
NOW|時間|now|今|待設計|C|
BEFORE|時間|before|前|⏪|B|
AFTER|時間|after|後|⏩|B|
LONG_TIME|時間|a long time|長い間|待設計|C|
SHORT_TIME|時間|a short time|短い間|待設計|C|
FOR_SOME_TIME|時間|for some time|しばらく|待設計|C|
MOMENT|時間|moment|瞬間, 一瞬|⏱️|B|
# 空間
WHERE_PLACE|空間|where, place|所, どこ|🗺️|B|
HERE|空間|here|ここ|📌|B|
ABOVE|空間|above|上|⬆️|B|
BELOW|空間|below|下|⬇️|B|
FAR|空間|far|遠い|🔭|B|
NEAR|空間|near|近い|🤏|C|
SIDE|空間|side|横, 側|↔️|C|
INSIDE|空間|inside|中|📥|C|
TOUCH|空間|touch (contact)|触る|👆|B|
# 邏輯
NOT|邏輯|not, no|ない, 〜ない|🚫|A|
MAYBE|邏輯|maybe|かもしれない|🤷|B|
CAN|邏輯|can|できる|👌|C|
BECAUSE|邏輯|because|から, ので|待設計|C|
IF|邏輯|if|もし, 〜たら|待設計|C|
# 強化
VERY|強化|very|とても|‼️|B|
MORE|強化|more|もっと|➕|B|
# 相似
LIKE_AS|相似|like, as, way|〜のよう, 〜みたい|待設計|C|
"""

rows = []
for line in PRIMES.strip().splitlines():
    if not line.strip() or line.startswith('#'): continue
    parts = line.split('|')
    if parts[4].startswith('contrast:'):
        parts[4:6] = [parts[4] + '|' + parts[5]]
    pid, group, en, ja, icon, clarity, merges = parts
    template, _, spec = icon.partition(':') if icon.startswith('contrast:') else ('single', '', icon)
    if icon == '待設計': template, spec = 'todo', ''
    rows.append(dict(id=pid, group=group, en=en, ja_draft=ja, template=template, icon=spec, clarity=clarity, merges=merges))

assert len(rows) == 65, len(rows)
dup = [i for i, c in collections.Counter(r['icon'] for r in rows if r['icon']).items() if c > 1]
assert not dup, dup

with open('nsm-primes.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=['id', 'group', 'en', 'ja_draft', 'template', 'icon', 'clarity', 'merges'])
    w.writeheader(); w.writerows(rows)
print('primes:', len(rows), dict(collections.Counter(r['clarity'] for r in rows)))
print('merges:', [r['merges'] for r in rows if r['merges']])
