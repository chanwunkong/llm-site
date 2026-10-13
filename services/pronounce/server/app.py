"""Pronunciation scoring service (self-hostable). Which sound did the learner
actually make at the hard-sound position?

Free decoding of the whole word drifts (inserted/dropped phones), so we do not
use it. Instead the expected sequence pins every other phone in place, and only
the target slot is open: we compute the CTC likelihood of the word with that
slot replaced by every plain IPA phone the model knows (plus "dropped"), and the
softmax over those is the model's own choice of the closest sound. No candidate
list and no assumption about the learner's native language.

API v1 (see ../API.md):
  GET  /v1/health                      service info, languages, whether the token is accepted
  POST /v1/phonemize                   {"text", "lang"} -> expected phones (model tokens)
  POST /v1/score?lang=&phones=&target= body: float32 little-endian PCM, 16 kHz mono
  GET  /v1/speak?lang=&text=&rate=     WAV from eSpeak NG, for languages the learner's device has no voice for

Settings (environment variables):
  MODEL, VOCAB      model files (see ../export_model.py)
  TOKEN             access token; required unless AUTH=off. Clients send "Authorization: Bearer <token>".
  AUTH              "off" disables the token check (only for a private machine you alone can reach)
  ALLOW_ORIGINS     comma-separated web origins allowed to call the API (CORS)
  RATE_PER_MIN      scoring requests per minute per client address (0 = no limit)
  SPEAK_PER_MIN     speak requests per minute per client address (default 120; the game reads every question aloud)
  LOG_ATTEMPTS      "1" prints one JSON line of scores per attempt (never audio)
  LEGACY            "1" also serves the original test page (/, /items, /score?id=)
"""
import hmac
import json
import os
import shutil
import subprocess
import time
import urllib.parse
from collections import defaultdict, deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
import onnxruntime as ort

VERSION = "1.0.0"
MODEL_NAME = "facebook/wav2vec2-xlsr-53-espeak-cv-ft (ONNX int8)"
HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.environ.get("MODEL", "/model/model.int8.onnx")
VOCAB = json.load(open(os.environ.get("VOCAB", "/model/vocab.json")))
TOKEN = os.environ.get("TOKEN", "")
AUTH = os.environ.get("AUTH", "on") != "off"
ALLOW_ORIGINS = [o.strip() for o in os.environ.get("ALLOW_ORIGINS", "https://chanwunkong.github.io").split(",") if o.strip()]
RATE_PER_MIN = int(os.environ.get("RATE_PER_MIN", "30"))
SPEAK_PER_MIN = int(os.environ.get("SPEAK_PER_MIN", "120"))
LOG_ATTEMPTS = os.environ.get("LOG_ATTEMPTS", "1") == "1"
LEGACY = os.environ.get("LEGACY", "0") == "1"
if AUTH and not TOKEN:
    raise SystemExit("TOKEN is required (or set AUTH=off on a machine only you can reach)")

BLANK = VOCAB["<pad>"]
INV = {v: k for k, v in VOCAB.items()}
TEMP = float(os.environ.get("TEMP", "1.0"))      # calibrates how sharp the choice is
GOOD, CLOSE = 0.6, 0.25                          # target probability thresholds for the colours
SR = 16000
DROPPED = "∅"
MAX_SECONDS = 10

# ---- languages ----
# eSpeak NG voice per game language code, and how well scoring works for it (measured 2026-10-13):
#   good     every phone of test words maps onto the model's symbols
#   no-tone  consonants are scored; vowels carry the tone in the same symbol, so they are not scored
#   unsupported  eSpeak's pronunciation or the symbols do not match well enough yet
LANGS = {
    "en": ("en-us", "good"), "de": ("de", "good"), "es": ("es", "good"), "pt": ("pt-br", "good"), "fr": ("fr-fr", "good"),
    "it": ("it", "good"), "ru": ("ru", "good"), "bn": ("bn", "good"), "hi": ("hi", "good"), "fa": ("fa", "good"),
    "ar": ("ar", "good"), "ta": ("ta", "good"), "tr": ("tr", "good"), "id": ("id", "good"), "sw": ("sw", "good"),
    "ko": ("ko", "good"), "ja": ("ja", "good"), "ky": ("ky", "good"), "zh": ("cmn", "no-tone"),
    "vi": ("vi", "unsupported"), "th": ("th", "unsupported"),
}

# Some voices (for example Kyrgyz) write a few phones in eSpeak's ASCII names; the model learned
# them that way, so they stay as model tokens, and are folded to IPA for feedback and merging.
# Mandarin initials use the model's pinyin-like names (ts.h = ʈʂʰ, th = tʰ); same treatment.
FOLD = {"S": "ʃ", "Z": "ʒ", "tS": "tʃ", "dZ": "dʒ", "N": "ŋ", "X": "χ",
        "s.": "ʂ", "ts.": "ʈʂ", "ts.h": "ʈʂʰ", "r.": "ɻ", "th": "tʰ", "ph": "pʰ", "kh": "kʰ", "tsh": "tsʰ", "tɕh": "tɕʰ"}
MODS = set("ːʰʲˤ̪̩̝̞̃̊ᵝ")   # length, aspiration, palatal, nasal, dental, ...
AFFRICATES = {"ts", "dz", "tʃ", "dʒ", "tɕ", "dʑ", "pf", "ʈʂ", "ɖʐ"}


def plain_ipa(tok):
    """One IPA segment: a single base letter (or an affricate) plus optional
    modifiers. Skips special tokens, tone/pinyin spellings and multi-vowel tokens."""
    if tok in FOLD:
        return True
    if tok.startswith("<") or any(c.isdigit() or c in ".?^[:\"!" for c in tok) or tok[0].isupper():
        return False
    core = "".join(c for c in tok if c not in MODS)
    if len(tok) - len(core) > 1:          # doubled marks like dʲʲ, iːː
        return False
    return len(core) == 1 or core in AFFRICATES


def ipa(tok):
    return FOLD.get(tok, tok)


CANDIDATES = sorted(t for t in VOCAB if plain_ipa(t))

opts = ort.SessionOptions()
opts.intra_op_num_threads = int(os.environ.get("THREADS", "4"))
session = ort.InferenceSession(MODEL, opts, providers=["CPUExecutionProvider"])


# ---- pronunciation (expected phones) ----
STRIP = set("ˈˌ‍ _-\n")
JA_KANA_TOOL = None
try:                                   # Japanese: eSpeak misreads kanji, so use pyopenjtalk when it is installed
    import pyopenjtalk as JA_KANA_TOOL  # noqa: N811
except Exception:
    pass
OJT = {"a": "a", "i": "i", "u": "ɯ", "e": "e", "o": "o", "A": "a", "I": "i", "U": "ɯ", "E": "e", "O": "o", "N": "ɴ",
       "k": "k", "ky": "kʲ", "g": "ɡ", "gy": "ɡʲ", "s": "s", "sh": "ɕ", "z": "z", "j": "dʑ", "t": "t", "ty": "tʲ", "ts": "ts",
       "ch": "tɕ", "d": "d", "dy": "dʲ", "n": "n", "ny": "ɲ", "h": "h", "hy": "ç", "f": "ɸ", "b": "b", "by": "bʲ", "p": "p",
       "py": "pʲ", "m": "m", "my": "mʲ", "r": "ɾ", "ry": "ɾʲ", "w": "w", "y": "j", "v": "v"}


def to_tokens(text_ipa):
    """Split an IPA string into model tokens by greedy longest match; None if something does not map."""
    out, i = [], 0
    while i < len(text_ipa):
        for n in (4, 3, 2, 1):
            if text_ipa[i:i + n] in VOCAB:
                out.append(text_ipa[i:i + n])
                i += n
                break
        else:
            return None
    return out


def phonemize(text, lang):
    if lang not in LANGS or LANGS[lang][1] == "unsupported":
        return None, "unsupported language"
    if lang == "ja" and JA_KANA_TOOL:
        ph = [p for p in JA_KANA_TOOL.g2p(text).split(" ") if p not in ("pau", "", "cl")]
        toks = [OJT.get(p) for p in ph]
        if all(t and t in VOCAB for t in toks):
            return toks, None
    if not shutil.which("espeak-ng"):
        return None, "espeak-ng is not installed"
    raw = subprocess.run(["espeak-ng", "-q", "--ipa=3", "-v", LANGS[lang][0], text],
                         capture_output=True, text=True, timeout=10).stdout
    toks = to_tokens("".join(c for c in raw if c not in STRIP).strip())
    if not toks:
        return None, "could not map the pronunciation onto the model's symbols"
    return toks, None


# ---- scoring ----
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


def score(phones, k, audio, tag=""):
    """phones: expected model tokens; k: index of the target phone, or -1 to only check the word."""
    t0 = time.time()
    audio = trim(audio)
    if len(audio) < 0.25 * SR:
        return {"ok": False, "code": "no_speech", "msg": "沒有聽到聲音，請靠近一點再唸一次"}
    lp = log_probs(audio)
    expected = [VOCAB[p] for p in phones]
    heard = greedy(lp)
    if k < 0:
        mismatch = edit_distance(heard, phones) / len(phones)
        ms = int((time.time() - t0) * 1000)
        if mismatch > 1.0:
            return {"ok": False, "code": "not_the_word", "msg": "聽不太出是這個字，請再唸一次", "ms": ms}
        return {"ok": True, "level": None, "match": round(max(0.0, 1 - mismatch), 3), "ms": ms}
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
    target = ipa(phones[k])
    # length variants (e / eː) and eSpeak ASCII names (S / ʃ) are one sound for feedback
    short = lambda ph: ipa(ph).replace("ː", "")
    merged = {}
    for ph, pr in zip(names, probs):
        key = target if short(ph) == short(target) else short(ph)
        merged[key] = merged.get(key, 0.0) + float(pr)
    ranked = sorted(merged.items(), key=lambda kv: -kv[1])
    p_target = merged.get(target, 0.0)
    top = [{"ph": ph, "p": round(pr, 3)} for ph, pr in ranked[:5] if pr >= 0.02]
    best = names[int(np.argmax(probs))]
    best_seq = phones[:k] + ([] if best == DROPPED else [best]) + phones[k + 1:]
    mismatch = edit_distance(heard, best_seq) / len(phones)
    ms = int((time.time() - t0) * 1000)
    if LOG_ATTEMPTS:   # scores only; audio is never stored
        print(json.dumps({"tag": tag, "target": target, "p_target": round(p_target, 3), "top": top,
                          "mismatch": round(mismatch, 2), "sec": round(len(audio) / SR, 2), "ms": ms}, ensure_ascii=False), flush=True)
    # free decoding is only a sanity check that this was the right word at all
    if mismatch > 1.0:
        return {"ok": False, "code": "not_the_word", "msg": "聽不太出是這個字，請再唸一次", "ms": ms}
    level = "good" if p_target >= GOOD else "close" if p_target >= CLOSE else "bad"
    return {"ok": True, "level": level, "target": target, "target_p": round(p_target, 3),
            "top": top, "score": round(p_target * 100), "ms": ms}


# ---- speaking (eSpeak NG) ----
# Robotic, but it covers every game language; used only when the device has no voice for the language.
SPEAK_CACHE, SPEAK_CACHE_MAX = {}, 500


def speak_wav(text, lang, rate):
    voice = LANGS.get(lang, (None,))[0]
    if not voice or not shutil.which("espeak-ng"):
        return None
    wpm = max(80, min(260, int(170 * rate)))
    key = (voice, wpm, text)
    if key not in SPEAK_CACHE:
        if len(SPEAK_CACHE) >= SPEAK_CACHE_MAX:
            SPEAK_CACHE.pop(next(iter(SPEAK_CACHE)))
        SPEAK_CACHE[key] = subprocess.run(["espeak-ng", "--stdout", "-v", voice, "-s", str(wpm), text],
                                          capture_output=True, timeout=10).stdout
    return SPEAK_CACHE[key]


# ---- protection ----
hits = defaultdict(deque)


def rate_ok(addr, kind="score"):
    limit = SPEAK_PER_MIN if kind == "speak" else RATE_PER_MIN
    if limit <= 0:
        return True
    now, q = time.time(), hits[(addr, kind)]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= limit:
        return False
    q.append(now)
    return True


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):          # no request log lines (they would include client addresses)
        pass

    def cors(self):
        origin = self.headers.get("Origin", "")
        if origin in ALLOW_ORIGINS or "*" in ALLOW_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin or "*")
            self.send_header("Vary", "Origin")

    def reply(self, code, ctype, body):
        self.send_response(code)
        self.cors()
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def json(self, obj, code=200):
        self.reply(code, "application/json; charset=utf-8", json.dumps(obj, ensure_ascii=False).encode())

    def authorized(self):
        if not AUTH:
            return True
        got = self.headers.get("Authorization", "")
        return got.startswith("Bearer ") and hmac.compare_digest(got[7:].encode(), TOKEN.encode())

    def guard(self, kind="score"):
        """Browser origin, token and rate checks for the API. Returns True when the request may continue."""
        origin = self.headers.get("Origin")
        if origin and origin not in ALLOW_ORIGINS and "*" not in ALLOW_ORIGINS:
            self.json({"ok": False, "code": "origin", "msg": "這個網站不能使用此服務"}, 403)
            return False
        if not self.authorized():
            self.json({"ok": False, "code": "token", "msg": "存取密碼不正確"}, 401)
            return False
        if not rate_ok(self.client_address[0], kind):
            self.json({"ok": False, "code": "rate", "msg": "太頻繁了，請稍等一下"}, 429)
            return False
        return True

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Access-Control-Max-Age", "600")
        # Chrome asks before a public site calls a private-network address (for example a Tailscale machine)
        if self.headers.get("Access-Control-Request-Private-Network") == "true":
            self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/healthz":
            return self.reply(200, "text/plain", b"ok")
        if path == "/v1/health":
            # answers without a token too, so the game can tell "wrong token" from "cannot reach"
            return self.json({"ok": True, "version": VERSION, "model": MODEL_NAME, "authorized": self.authorized(),
                              "languages": {k: v[1] for k, v in LANGS.items()}, "speak": sorted(LANGS),
                              "japanese_tool": "pyopenjtalk" if JA_KANA_TOOL else "espeak-ng"})
        if path == "/v1/speak":
            if not self.guard("speak"):
                return
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            text = q.get("text", [""])[0][:300]
            try:
                rate = float(q.get("rate", ["1"])[0])
            except ValueError:
                rate = 1.0
            wav = speak_wav(text, q.get("lang", [""])[0], rate) if text.strip() else None
            if not wav:
                return self.json({"ok": False, "code": "speak", "msg": "這個語言不能朗讀"}, 400)
            return self.reply(200, "audio/wav", wav)
        if LEGACY:
            if path == "/":
                with open(os.path.join(HERE, "index.html"), "rb") as f:
                    return self.reply(200, "text/html; charset=utf-8", f.read())
            if path == "/items":
                return self.json([{**{k: it[k] for k in ("id", "lang", "text", "segments", "sub", "sub_desc")},
                                   "target": it["phones"][it["target_index"]]} for it in ITEMS.values()])
            if path == "/known/zh":
                with open(os.path.join(HERE, "known-zh.json"), "rb") as f:
                    return self.reply(200, "application/json; charset=utf-8", f.read())
        self.reply(404, "text/plain", b"not found")

    def read_body(self, limit):
        n = int(self.headers.get("Content-Length") or 0)
        if n > limit:
            return None
        return self.rfile.read(n)

    def do_POST(self):
        p = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(p.query)
        if p.path == "/v1/phonemize":
            if not self.guard():
                return
            body = self.read_body(10_000)
            try:
                req = json.loads(body or b"{}")
            except ValueError:
                return self.json({"ok": False, "code": "bad_request", "msg": "格式錯誤"}, 400)
            phones, err = phonemize(str(req.get("text", ""))[:200], str(req.get("lang", "")))
            if not phones:
                return self.json({"ok": False, "code": "phonemize", "msg": err})
            return self.json({"ok": True, "phones": phones, "ipa": [ipa(t) for t in phones],
                              "scorable": [plain_ipa(t) for t in phones]})
        if p.path == "/v1/score":
            if not self.guard():
                return
            try:
                phones = json.loads(q.get("phones", ["[]"])[0])
                k = int(q.get("target", ["-1"])[0])
            except ValueError:
                return self.json({"ok": False, "code": "bad_request", "msg": "格式錯誤"}, 400)
            if not phones or not all(isinstance(t, str) and t in VOCAB for t in phones) or not -1 <= k < len(phones) \
                    or (k >= 0 and not plain_ipa(phones[k])):
                return self.json({"ok": False, "code": "bad_request", "msg": "音標資料不正確"}, 400)
            body = self.read_body(SR * 4 * MAX_SECONDS)
            if body is None:
                return self.json({"ok": False, "code": "too_long", "msg": "錄音太長了"}, 413)
            return self.json(score(phones, k, np.frombuffer(body, dtype="<f4"), q.get("lang", [""])[0]))
        if LEGACY and p.path == "/score":
            item = ITEMS.get(q.get("id", [""])[0])
            if not item:
                return self.json({"ok": False, "msg": "找不到題目"}, 404)
            body = self.read_body(SR * 4 * MAX_SECONDS)
            if body is None:
                return self.json({"ok": False, "msg": "錄音太長了"}, 413)
            return self.json(score(item["phones"], item["target_index"], np.frombuffer(body, dtype="<f4"), item["id"]))
        self.reply(404, "text/plain", b"not found")


ITEMS = {it["id"]: it for it in json.load(open(os.path.join(HERE, "items.json")))} if LEGACY else {}

if __name__ == "__main__":
    print(f"pronounce {VERSION}: auth={'on' if AUTH else 'off'} origins={ALLOW_ORIGINS} rate/min={RATE_PER_MIN}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("PORT", "8080"))), Handler).serve_forever()
