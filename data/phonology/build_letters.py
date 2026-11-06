"""字母和音的對應表（給 ELSA 式的字母上色用）：site/data/letters/<語言>.json

做法：每種語言取 wordfreq 最常用的字，用 eSpeak NG 產生發音（和評分服務同一套），
再用 EM 演算法（Jiampojamarn 等 2007 的 many-to-many 對齊）學出「1～2 個字母 ↔ 0～K 個音」的機率。
執行時（site/js/engine/letters.js）用這張表把字的字母對到服務回傳的每個音。
邏輯不含任何語言專屬規則；中文、日文的字和音差太多，不訓練，執行時用通用規則。

用法（需要 espeak-ng 與 wordfreq）：python data/phonology/build_letters.py [語言 ...]
"""
import json, math, pathlib, subprocess, sys, unicodedata
from collections import defaultdict

import regex      # wordfreq 的相依套件，用來切字素（\X）
import wordfreq

# 和評分服務（services/pronounce/server/app.py 的 LANGS）同一套 eSpeak 聲音
VOICES = {"en": "en-us", "de": "de", "es": "es", "pt": "pt-br", "fr": "fr-fr", "it": "it", "ru": "ru", "bn": "bn",
          "hi": "hi", "fa": "fa", "ar": "ar", "ta": "ta", "tr": "tr", "id": "id", "ko": "ko"}
N_WORDS, ITERS, MAX_G = 5000, 6, 2
STRIP = set("ˈˌ‍ _-\n.")
MODS = set("ːˑʰʲʷˠˤⁿˡ˞ʼ")
OUT = pathlib.Path(__file__).resolve().parents[2] / "site/data/letters"


def segs(ipa):
    """音標切成音段：一個基本符號加上後面的附加符號（長音、送氣、顎化、組合附加符號）"""
    out = []
    for c in ipa:
        if c in STRIP or c.isdigit():
            continue
        if out and (c in MODS or unicodedata.category(c) == "Mn"):
            out[-1] += c
        else:
            out.append(c)
    return out


def letters(word):
    return regex.findall(r"\X", word.lower())


def espeak(words, voice):
    raw = subprocess.run(["espeak-ng", "-q", "--ipa=3", "-v", voice], input="\n".join(words),
                         capture_output=True, text=True, timeout=600).stdout.splitlines()
    return raw if len(raw) == len(words) else None


def edges(g, p, K):
    """字母 g[i:] 和音 p[j:] 可以走的步：1～MAX_G 個字母對 0～K 個音"""
    for a in range(1, MAX_G + 1):
        for b in range(0, K + 1):
            yield a, b


def em(pairs, K):
    prob = defaultdict(lambda: 1e-3)
    for _ in range(ITERS):
        counts = defaultdict(float)
        for g, p in pairs:
            n, m = len(g), len(p)
            fw = [[0.0] * (m + 1) for _ in range(n + 1)]
            fw[0][0] = 1.0
            for i in range(n + 1):
                for j in range(m + 1):
                    if not fw[i][j]:
                        continue
                    for a, b in edges(g, p, K):
                        if i + a <= n and j + b <= m:
                            fw[i + a][j + b] += fw[i][j] * prob[("".join(g[i:i + a]), " ".join(p[j:j + b]))]
            if not fw[n][m]:
                continue
            bw = [[0.0] * (m + 1) for _ in range(n + 1)]
            bw[n][m] = 1.0
            for i in range(n, -1, -1):
                for j in range(m, -1, -1):
                    for a, b in edges(g, p, K):
                        if i + a <= n and j + b <= m and bw[i + a][j + b]:
                            bw[i][j] += prob[("".join(g[i:i + a]), " ".join(p[j:j + b]))] * bw[i + a][j + b]
            z = fw[n][m]
            for i in range(n + 1):
                for j in range(m + 1):
                    if not fw[i][j]:
                        continue
                    for a, b in edges(g, p, K):
                        if i + a <= n and j + b <= m and bw[i + a][j + b]:
                            k = ("".join(g[i:i + a]), " ".join(p[j:j + b]))
                            counts[k] += fw[i][j] * prob[k] * bw[i + a][j + b] / z
        total = sum(counts.values())
        prob = defaultdict(lambda: 1e-9, {k: v / total for k, v in counts.items() if v / total > 1e-7})
    return prob


def build(lang):
    words = [w for w in wordfreq.top_n_list(lang, N_WORDS * 2) if regex.fullmatch(r"\p{L}[\p{L}\p{M}]*", w)][:N_WORDS]
    ipa = espeak(words, VOICES[lang])
    if not ipa:
        print(lang, "eSpeak 輸出行數對不上，略過")
        return None
    pairs = [(letters(w), segs(x)) for w, x in zip(words, ipa) if " " not in x.strip()]
    pairs = [(g, p) for g, p in pairs if g and p and len(g) <= 16]
    ratio = sum(len(p) for _, p in pairs) / sum(len(g) for g, _ in pairs)
    K = max(2, min(4, math.ceil(ratio * 2)))       # 一個字母最多對幾個音：依這種文字平均每個字母幾個音
    prob = em(pairs, K)
    table = {f"{g}\t{p}": round(math.log(v), 2) for (g, p), v in prob.items() if v > 1e-5}
    print(lang, len(pairs), "字", f"K={K}", len(table), "組")
    return {"K": K, "maxG": MAX_G, "pairs": table}


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for lang in sys.argv[1:] or VOICES:
        t = build(lang)
        if t:
            (OUT / f"{lang}.json").write_text(json.dumps(t, ensure_ascii=False, separators=(",", ":")))
