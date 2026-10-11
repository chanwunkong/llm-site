"""Pronunciation check (experiment): which sound did the learner actually make at
the hard-sound position?

Free decoding of the whole word drifts (inserted/dropped phones), so we do not
use it. Instead the expected sequence pins every other phone in place, and only
the target slot is open: we compute the CTC likelihood of the word with that
slot replaced by every plain IPA phone the model knows (plus "dropped"), and the
softmax over those is the model's own choice of the closest sound. No candidate
list and no assumption about the learner's native language.

GET  /          test page          GET /items   word list
POST /score?id=<item id>   body: float32 little-endian PCM, 16 kHz mono
"""
import json
import os
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
import onnxruntime as ort

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.environ.get("MODEL", "/model/model.int8.onnx")
VOCAB = json.load(open(os.environ.get("VOCAB", "/model/vocab.json")))
ITEMS = {it["id"]: it for it in json.load(open(os.path.join(HERE, "items.json")))}
BLANK = VOCAB["<pad>"]
INV = {v: k for k, v in VOCAB.items()}
TEMP = float(os.environ.get("TEMP", "1.0"))      # calibrates how sharp the choice is
GOOD, CLOSE = 0.6, 0.25                          # target probability thresholds for the colours
SR = 16000
DROPPED = "∅"


MODS = set("ːʰʲˤ\u0303\u032a\u0329\u031d\u030a\u031eᵝ")   # length, aspiration, palatal, nasal, dental, ...
AFFRICATES = {"ts", "dz", "tʃ", "dʒ", "tɕ", "dʑ", "pf", "ʈʂ", "ɖʐ"}


def plain_ipa(tok):
    """One IPA segment: a single base letter (or an affricate) plus optional
    modifiers. Skips special tokens, tone/pinyin spellings and multi-vowel tokens."""
    if tok.startswith("<") or any(c.isdigit() or c in ".?^[:\"!" for c in tok) or tok[0].isupper():
        return False
    core = "".join(c for c in tok if c not in MODS)
    if len(tok) - len(core) > 1:          # doubled marks like dʲʲ, iːː
        return False
    return len(core) == 1 or core in AFFRICATES


CANDIDATES = sorted(t for t in VOCAB if plain_ipa(t))

opts = ort.SessionOptions()
opts.intra_op_num_threads = int(os.environ.get("THREADS", "4"))
session = ort.InferenceSession(MODEL, opts, providers=["CPUExecutionProvider"])


def trim(x, frame=320, pad=0.15):
    """Drop leading/trailing silence so the model has less audio to process."""
    if len(x) < frame:
        return x
    e = np.sqrt(np.mean(x[: len(x) // frame * frame].reshape(-1, frame) ** 2, axis=1))
    on = np.where(e > max(e.max() * 0.05, 1e-3))[0]
    if not len(on):
        return x[:0]
    a = max(0, on[0] * frame - int(pad * SR))
    b = min(len(x), (on[-1] + 1) * frame + int(pad * SR))
    return x[a:b]


def log_probs(audio):
    x = (audio - audio.mean()) / np.sqrt(audio.var() + 1e-7)
    logits = session.run(None, {"audio": x[None, :].astype(np.float32)})[0][0]
    m = logits.max(axis=1, keepdims=True)
    return logits - m - np.log(np.exp(logits - m).sum(axis=1, keepdims=True))


def ctc_loglik(lp, labels):
    """log P(labels | audio) with the CTC forward algorithm."""
    ext = [BLANK]
    for l in labels:
        ext += [l, BLANK]
    ext = np.array(ext)
    S = len(ext)
    skip_ok = np.zeros(S, bool)
    skip_ok[2:] = (ext[2:] != BLANK) & (ext[2:] != ext[:-2])
    alpha = np.full(S, -np.inf)
    alpha[0] = lp[0, ext[0]]
    if S > 1:
        alpha[1] = lp[0, ext[1]]
    for t in range(1, lp.shape[0]):
        prev1 = np.concatenate(([-np.inf], alpha[:-1]))
        prev2 = np.where(skip_ok, np.concatenate(([-np.inf, -np.inf], alpha[:-2])), -np.inf)
        alpha = np.logaddexp(np.logaddexp(alpha, prev1), prev2) + lp[t, ext]
    return np.logaddexp(alpha[-1], alpha[-2]) if S > 1 else alpha[-1]


def greedy(lp):
    ids = lp.argmax(axis=1)
    out, last = [], None
    for i in ids:
        if i != last and i != BLANK:
            out.append(INV[int(i)])
        last = i
    return out


def edit_distance(a, b):
    d = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        prev, d[0] = d[0], i
        for j, y in enumerate(b, 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (x != y))
    return d[-1]


def score(item, audio):
    t0 = time.time()
    audio = trim(audio)
    if len(audio) < 0.25 * SR:
        return {"ok": False, "msg": "沒有聽到聲音，請靠近一點再唸一次"}
    lp = log_probs(audio)
    expected = [VOCAB[p] for p in item["phones"]]
    k = item["target_index"]
    # open only the target slot; every other phone stays fixed
    names, lls = [], []
    for ph in CANDIDATES + [DROPPED]:
        seq = expected[:k] + ([] if ph == DROPPED else [VOCAB[ph]]) + expected[k + 1:]
        if seq:
            names.append(ph)
            lls.append(ctc_loglik(lp, seq))
    lls = np.array(lls) / TEMP
    probs = np.exp(lls - lls.max())
    probs /= probs.sum()
    target = item["phones"][k]
    # length variants (e / eː) are one sound for feedback; fold them together so they
    # don't split the vote. Keep the target's own spelling for its group.
    short = lambda ph: ph.replace("ː", "")
    merged = {}
    for ph, pr in zip(names, probs):
        key = target if short(ph) == short(target) else short(ph)
        merged[key] = merged.get(key, 0.0) + float(pr)
    ranked = sorted(merged.items(), key=lambda kv: -kv[1])
    p_target = merged.get(target, 0.0)
    top = [{"ph": ph, "p": round(pr, 3)} for ph, pr in ranked[:5] if pr >= 0.02]
    heard = greedy(lp)
    best = names[int(np.argmax(probs))]
    best_seq = item["phones"][:k] + ([] if best == DROPPED else [best]) + item["phones"][k + 1:]
    mismatch = edit_distance(heard, best_seq) / len(item["phones"])
    ms = int((time.time() - t0) * 1000)
    print(json.dumps({"id": item["id"], "target": target, "p_target": round(p_target, 3), "top": top,
                      "heard": "".join(heard), "mismatch": round(mismatch, 2),
                      "sec": round(len(audio) / SR, 2), "ms": ms}, ensure_ascii=False), flush=True)
    # free decoding is only a sanity check that this was the right word at all
    if mismatch > 1.0:
        return {"ok": False, "msg": f"聽不太出是「{item['text']}」，請再唸一次", "ms": ms}
    level = "good" if p_target >= GOOD else "close" if p_target >= CLOSE else "bad"
    return {"ok": True, "level": level, "target": target, "target_p": round(p_target, 3),
            "top": top, "score": round(p_target * 100), "ms": ms}


class Handler(BaseHTTPRequestHandler):
    def reply(self, code, ctype, body):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def json(self, obj, code=200):
        self.reply(code, "application/json; charset=utf-8", json.dumps(obj, ensure_ascii=False).encode())

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/":
            with open(os.path.join(HERE, "index.html"), "rb") as f:
                return self.reply(200, "text/html; charset=utf-8", f.read())
        if path == "/items":
            return self.json([{**{k: it[k] for k in ("id", "lang", "text", "segments", "sub", "sub_desc")},
                               "target": it["phones"][it["target_index"]]} for it in ITEMS.values()])
        if path == "/known/zh":
            with open(os.path.join(HERE, "known-zh.json"), "rb") as f:
                return self.reply(200, "application/json; charset=utf-8", f.read())
        if path == "/healthz":
            return self.reply(200, "text/plain", b"ok")
        self.reply(404, "text/plain", b"not found")

    def do_POST(self):
        p = urllib.parse.urlparse(self.path)
        item = ITEMS.get(urllib.parse.parse_qs(p.query).get("id", [""])[0])
        if p.path != "/score" or not item:
            return self.json({"ok": False, "msg": "找不到題目"}, 404)
        n = int(self.headers.get("Content-Length") or 0)
        if n > SR * 4 * 10:  # 10 s max
            return self.json({"ok": False, "msg": "錄音太長了"}, 413)
        audio = np.frombuffer(self.rfile.read(n), dtype="<f4")
        self.json(score(item, audio))


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
