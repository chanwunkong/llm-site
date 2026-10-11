"""data/<set>.csv -> server/items.json

Each row names one hard sound in one word. eSpeak NG gives the expected phones;
they are split into the model's phone tokens (greedy longest match). The word is
split into [before, focus letters, after] so the result can be coloured on the
original text instead of showing IPA.
"""
import csv
import json
import subprocess
import sys

VOCAB = json.load(open("model/vocab.json"))
STRIP = "ˈˌ‍ "


def phones(text, voice):
    ipa = subprocess.run(["espeak-ng", "-q", "--ipa=3", "-v", voice, text],
                         capture_output=True, text=True, check=True).stdout
    ipa = "".join(c for c in ipa if c not in STRIP).strip()
    out, i = [], 0
    while i < len(ipa):
        for n in (4, 3, 2, 1):
            if ipa[i:i + n] in VOCAB:
                out.append(ipa[i:i + n])
                i += n
                break
        else:
            sys.exit(f"{text}: no model token for {ipa[i:]!r} in {ipa!r}")
    return out


def build(path, lang, voice):
    items = []
    for row in csv.DictReader(open(path, encoding="utf-8")):
        seq = phones(row["text"], voice)
        if row["target"] not in seq:
            sys.exit(f"{row['text']}: target {row['target']} not in {seq}")
        i = row["text"].index(row["focus"])
        items.append({
            "id": f"{lang}-{row['text']}",
            "lang": lang,
            "text": row["text"],
            "segments": [row["text"][:i], row["focus"], row["text"][i + len(row["focus"]):]],
            "phones": seq,
            "target_index": seq.index(row["target"]),
            "sub": row["sub"],
            "sub_desc": row["sub_desc"],
        })
    return items


if __name__ == "__main__":
    items = build("data/en-hard.csv", "en", "en-us")
    json.dump(items, open("server/items.json", "w"), ensure_ascii=False, indent=1)
    for it in items:
        print(it["id"], it["phones"], "focus", it["segments"][1], "->", it["phones"][it["target_index"]], "vs", it["sub"])
