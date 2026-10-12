# Handoff: pronunciation feedback experiment (public copy)

Status as of 2026-10-13: the experiment became a self-hostable service with a versioned API (`API.md`, `README.md`, `Dockerfile`; code in `server/app.py`). It supports 19 languages (Vietnamese and Thai not yet; Mandarin consonants only), adds `/v1/phonemize` (eSpeak NG; pyopenjtalk for Japanese when installed), a required access token, an origin allow-list and a rate limit. The scoring method is unchanged and gives identical results to the original program. Tested only with synthetic (eSpeak) audio; no real-voice test yet. On synthetic audio, deliberate errors are detected in the right direction, but many correct productions are also judged wrong in several languages.

This is the public copy. Deployment details (machines, network, service endpoints) stay in the owner's private notes outside this repository. Do not add any of them here: this repository is public. Before pushing, run `scripts/check-private.sh`.

## 1. Goal and owner constraints

This experiment is a candidate for the game's 開口環境 (speaking mode): the learner says a word, and the system tells them how the hard sound came out.

Constraints the owner set. Follow them:

- **Language-agnostic.** Do not design around one language pair. Do not hand-pick "typical errors" per native language.
- **Do not show free phone recognition.** The owner tried Allosaurus before. Whole-word IPA output was unreadable and far from the expected IPA, so it did not help. Show feedback on the original text, plus IPA, 注音 and an articulation chart.
- **The model chooses the produced sound.** The owner rejected hand-made candidate lists. The current method lets the model choose among all phones at the target position (section 3).
- **Owner's reference is ELSA.** Per-sound colour on the word, plus clear "you sound like X" feedback.
- **UI style** (same as the game): Bauhaus. Off-white paper, black lines, flat colours, no emoji in the UI. Blue = target/correct, red = learner's sound/wrong, yellow = selected.
- **Explanations to the owner** are in Traditional Chinese, short sentences, one idea each. The owner tests only from an iPhone.

## 2. Files

| File | Purpose |
|---|---|
| `export_model.py` | Downloads `facebook/wav2vec2-xlsr-53-espeak-cv-ft` (Apache-2.0), exports it to ONNX, and quantizes it to int8 **MatMul only**. ONNX Runtime has no ConvInteger kernel, so the conv layers stay fp32. Output: `model/model.int8.onnx` (355 MB), `model/vocab.json`. The `model/` folder is not committed. |
| `build_items.py` | Turns `data/en-hard.csv` into `server/items.json`. eSpeak NG (`en-us`) gives the expected phones; they are split into model tokens by greedy longest match. |
| `data/en-hard.csv` | 12 English test words. Columns: `text, focus` (letters to underline), `target` (IPA), `sub, sub_desc` (legacy from v1, unused by scoring now). |
| `server/app.py` | Scoring HTTP service (numpy + onnxruntime), port 8080. API v1 in `API.md`; settings in `README.md`. |
| `server/index.html` | Test page (recording, results, charts). |
| `server/known-zh.json` | IPA → 注音 approximations, used only to annotate feedback. |

Run locally: `MODEL=model/model.int8.onnx VOCAB=model/vocab.json TOKEN=<secret> LEGACY=1 python server/app.py`, then open `http://localhost:8080/` for the original test page. A phone microphone needs the page served over HTTPS.

## 3. Scoring method (current, v2)

1. Audio arrives as float32 PCM, 16 kHz mono. The page decodes and resamples it in the browser, so the server needs no ffmpeg. Leading and trailing silence are trimmed.
2. One forward pass gives CTC log-probabilities over 392 eSpeak-IPA tokens.
3. **Open slot.** Keep every expected phone fixed, except the target phone. Replace the target with each candidate and compute the full-sequence CTC log-likelihood (forward algorithm).
   - Candidates are all 171 "plain IPA" model tokens: one base letter or an affricate, plus optional length, aspiration, palatalization or nasal marks. Tone digits, pinyin-style `th/kh`, and multi-vowel tokens are excluded.
   - A "dropped" option (∅) is also tested: the target is removed.
4. Softmax over the log-likelihoods (`TEMP`, default 1.0) gives the model's own distribution over "which sound was produced here".
5. Length variants are merged for feedback (e and eː count as one sound).
6. Level comes from the target's probability: `GOOD` ≥ 0.6, `CLOSE` ≥ 0.25, else bad.
7. Sanity gate: greedy-decode the whole word. Compare it (edit distance) with the expected sequence, where the slot holds the best candidate. Reject only if the distance is above 1.0 × the word length ("聽不太出是…"). This rejects the wrong word or noise, but never a mispronunciation.

Why this design: free decoding drifts (insertions, deletions, wrong segments), while pinning the context keeps the decision local. History: v1 compared the target with one fixed substitute. The owner rejected it because accents differ ("台語母語者跟中文母語者的差異方向完全不一樣").

Response JSON: `{ok, level, target, target_p, top:[{ph,p}...5], score, ms}`. The server prints one JSON line per attempt, which can be used to calibrate the thresholds.

## 4. Test page (server/index.html)

- Recording auto-stops. The first 0.3 s measure background noise; recording stops after 0.7 s of silence following speech. Limits: 4 s with no speech, 5 s total.
- `getUserMedia` uses `echoCancellation`, `noiseSuppression` and `autoGainControl` all set to `false`. With them on, a fake-mic test turned a /θ/ into /s/, because the processing smears the high frequencies that separate θ, f and s. Keep them off.
- Results:
  - One sentence. Example: 你的音比較像 /f/（清唇齒擦音，像中文的「ㄈ」）.
  - Top-5 bars: IPA, articulation description, 注音.
  - Chart, using the same IPA layout as the game's `site/js/engine/ipa-chart.js` (tables ported inline):
    - Consonants: a mini table with only the places and manners in use.
    - Vowels: a trapezoid with the candidates, an arrow from target to the learner's sound, and direction text (舌頭太高, 太後面, …). It auto-zooms when the points are close. A note is added when the two sounds differ only in length.
- Reference audio uses the browser's `speechSynthesis` (en-US).

## 5. Results so far (synthetic eSpeak audio only)

Speed on a 4-core Cortex-A55 ARM board (CPU only): about 1.1–2.0 s per word on the server.

| Target | Said | Model's top choice |
|---|---|---|
| think /θ/ | think | θ 66% (good) |
| think /θ/ | sink / fink / tink | s 89% / f 83% / t 93% |
| three /θ/ | free / tree | f 66% / t 88% |
| very /v/ | very / wery | v 89% / w 88% |
| right /ɹ/ | right / light | ɹ 94% / l 98% |
| ship /ɪ/ | ship (correct) | e 50% (**wrong**) |
| sit /ɪ/ | sit (correct) | e 78% (**wrong**) |
| bad /æ/ | bad (correct) | a 48%, æ 15% (**wrong**) |

Consonants: strong, and the direction of the error is detected. Vowels: unreliable on synthetic audio. It is unknown whether this comes from the robotic eSpeak vowels or from the model.

## 6. Next steps

1. **Real-voice test by the owner (top priority).**
   - Consonants: mispronounce on purpose in different directions.
   - Vowels: say ship / sit / bad / man correctly and check for false alarms.
   - Compare the overall feel with ELSA.
2. Calibrate `GOOD` / `CLOSE` / `TEMP` from the logged real attempts.
3. If vowels stay unreliable, options to evaluate:
   - Restrict vowel candidates to vowels near the target in the chart.
   - Score vowels with averaged frame posteriors over the aligned segment instead of whole-sequence likelihood.
   - Try a larger or newer phone model.
   Do not pick one without the owner.
4. Integrate into the game's 開口環境:
   - Items come from the game's own data (target-language words plus hard sounds vs the learner's known languages, PHOIBLE-based, already in the game).
   - The 注音 annotation should come from the learner's known-language inventories, not only `known-zh.json`.
   - The game is a public static site, so it needs a public HTTPS scoring endpoint. How (and whether) to expose the scoring server is a security decision for the owner. Do not set up any public access without asking. An in-browser model is the alternative, but 355 MB is too large for phones today.

## 7. Gotchas

- Keep noise suppression off when recording (section 4).
- Do not commit model files; regenerate them with `export_model.py`.
- After restarting the server, the old process may answer for a few seconds. Wait before testing.
