// 常見英文單字的 POS 備援表（buildWordPosMap 不涵蓋未收錄的功能詞）
const COMMON_WORD_POS = {
    // 冠詞
    the:'DT', a:'DT', an:'DT',
    // 介系詞
    in:'IN', on:'IN', at:'IN', of:'IN', to:'IN', for:'IN', with:'IN',
    from:'IN', by:'IN', about:'IN', into:'IN', through:'IN', over:'IN',
    under:'IN', between:'IN', after:'IN', before:'IN', during:'IN',
    without:'IN', within:'IN', along:'IN', around:'IN', among:'IN',
    // 代名詞
    i:'PRP', you:'PRP', he:'PRP', she:'PRP', it:'PRP', we:'PRP', they:'PRP',
    me:'PRP', him:'PRP', her:'PRP', us:'PRP', them:'PRP',
    my:'PRP$', your:'PRP$', his:'PRP$', its:'PRP$', our:'PRP$', their:'PRP$',
    this:'DT', that:'DT', these:'DT', those:'DT',
    // 連接詞
    and:'CC', or:'CC', but:'CC', nor:'CC', so:'CC', yet:'CC',
    // 助動詞/be 動詞
    is:'VBZ', are:'VBP', was:'VBD', were:'VBD', be:'VB', been:'VBN',
    being:'VBG', am:'VBP',
    can:'MD', could:'MD', will:'MD', would:'MD', shall:'MD', should:'MD',
    may:'MD', might:'MD', must:'MD', do:'VB', does:'VBZ', did:'VBD',
    have:'VB', has:'VBZ', had:'VBD', having:'VBG',
    // 常見副詞
    not:'RB', also:'RB', just:'RB', very:'RB', too:'RB', more:'RBR',
    most:'RBS', then:'RB', now:'RB', here:'RB', there:'RB', when:'WRB',
    where:'WRB', how:'WRB', why:'WRB',
    // 疑問詞 / 關係詞
    who:'WP', what:'WP', which:'WDT', whom:'WP',
    // 數字詞
    one:'CD', two:'CD', three:'CD', first:'JJ', second:'JJ',
};

function levenshtein(a, b) {
    const m = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let j = 1; j <= a.length; j++) {
        let prev = j;
        for (let i = 1; i <= b.length; i++) {
            const val = a[j - 1] === b[i - 1] ? m[i - 1] : Math.min(m[i - 1], m[i], prev) + 1;
            m[i - 1] = prev;
            prev = val;
        }
        m[b.length] = prev;
    }
    return m[b.length];
}

// L2-V: 句型重組 — 點選詞塊依序還原例句
let l2OriginalTokens = [];
let l2AnswerTokens = [];
let l2PoolTokens = [];
let l2Sortable = null;

registerQuestionModule(2, {
    activate(wordData) {
        document.getElementById('p-sentence-row').style.display = 'none';
        document.getElementById('p-etymology-row').style.display = 'none';
        showAudioButtons(false, false);
        document.getElementById('p-word').style.visibility = 'hidden';
        document.getElementById('action-l2').style.display = 'flex';
        document.getElementById('next-word-btn').style.display = 'none';
        document.getElementById('l2-feedback').textContent = '';
        document.getElementById('l2-feedback').className = '';
        document.getElementById('l2-actions').style.display = 'flex';
        document.getElementById('l2-countdown').style.display = 'none';
        updateProgressDots('l2-dots', wordData.successes || 0);

        l2OriginalTokens = (wordData.sentence || '').split(/\s+/).filter(t => t);
        l2AnswerTokens = [];
        l2PoolTokens = [...l2OriginalTokens].sort(() => 0.5 - Math.random());
        while (l2PoolTokens.length > 1 && l2PoolTokens.join(' ') === l2OriginalTokens.join(' ')) {
            l2PoolTokens.sort(() => 0.5 - Math.random());
        }

        renderL2Pool();
        renderL2Answer();
        speakSequence([wordData.word, wordData.sentence]);
    },
    deactivate() {
        cancelAutoAdvance('l2-countdown');
        document.getElementById('p-word').style.visibility = 'visible';
        document.getElementById('action-l2').style.display = 'none';
    }
});

function renderL2Pool() {
    const pool = document.getElementById('l2-word-pool');
    pool.innerHTML = '';
    const wordMap = buildWordPosMap();
    l2PoolTokens.forEach((token, i) => {
        const btn = document.createElement('button');
        btn.className = 'l2-word-chip';
        btn.textContent = token;
        const clean = token.toLowerCase().replace(/[^a-z]/g, '');
        const pos = wordMap.get(clean) || COMMON_WORD_POS[clean] || '';
        if (pos) btn.style.backgroundColor = getPosColor(pos);
        btn.onclick = () => l2PoolToAnswer(i);
        pool.appendChild(btn);
    });
}

function renderL2Answer() {
    const area = document.getElementById('l2-answer-area');
    if (l2Sortable) { l2Sortable.destroy(); l2Sortable = null; }
    area.innerHTML = '';
    area.style.borderStyle = l2AnswerTokens.length > 0 ? 'solid' : 'dashed';
    const wordMap = buildWordPosMap();
    l2AnswerTokens.forEach((token, i) => {
        const btn = document.createElement('button');
        btn.className = 'l2-word-chip placed';
        btn.textContent = token;
        btn.dataset.idx = i;
        const clean = token.toLowerCase().replace(/[^a-z]/g, '');
        const pos = wordMap.get(clean) || COMMON_WORD_POS[clean] || '';
        if (pos) btn.style.backgroundColor = getPosColor(pos);
        btn.onclick = () => l2AnswerToPool(i);
        area.appendChild(btn);
    });
    initL2Sortable();
}

function initL2Sortable() {
    const area = document.getElementById('l2-answer-area');
    if (!area || typeof Sortable === 'undefined') return;
    l2Sortable = Sortable.create(area, {
        animation: 150,
        onEnd: () => {
            const newTokens = [];
            Array.from(area.children).forEach((chip, i) => {
                const oldIdx = parseInt(chip.dataset.idx);
                if (!isNaN(oldIdx) && l2AnswerTokens[oldIdx] !== undefined) {
                    newTokens.push(l2AnswerTokens[oldIdx]);
                }
                chip.dataset.idx = i;
                chip.onclick = () => l2AnswerToPool(i);
            });
            if (newTokens.length === l2AnswerTokens.length) l2AnswerTokens = newTokens;
        }
    });
}

function l2PoolToAnswer(poolIndex) {
    const token = l2PoolTokens.splice(poolIndex, 1)[0];
    l2AnswerTokens.push(token);
    renderL2Pool();
    renderL2Answer();
}

function l2AnswerToPool(answerIndex) {
    const token = l2AnswerTokens.splice(answerIndex, 1)[0];
    l2PoolTokens.push(token);
    renderL2Pool();
    renderL2Answer();
}

function submitL2() {
    if (l2AnswerTokens.length < l2OriginalTokens.length) {
        const fb = document.getElementById('l2-feedback');
        fb.textContent = '請排入所有單字';
        fb.className = 'feedback-wrong';
        return;
    }
    currentWordData.attempts++;
    const fb = document.getElementById('l2-feedback');
    if (l2AnswerTokens.join(' ') === l2OriginalTokens.join(' ')) {
        currentWordData.successes++;
        updateProgressDots('l2-dots', currentWordData.successes);
        fb.textContent = '正確！';
        fb.className = 'feedback-correct';
        document.getElementById('l2-actions').style.display = 'none';
        startAutoAdvance('l2-countdown');
    } else {
        fb.textContent = '順序不對，再試看看';
        fb.className = 'feedback-wrong';
        if (currentWordData.attempts >= 5) {
            document.getElementById('l2-actions').style.display = 'none';
            startAutoAdvance('l2-countdown');
        }
    }
    updatePracticeProgress(currentWordData.successes, currentWordData.attempts);
}

// === L2-A: 聽寫填空 + 手寫辨識 ===
const L3_DPR = window.devicePixelRatio || 1;
let l3Canvas = null, l3Ctx = null;
let l3Strokes = [], l3IsDrawing = false, l3CurrentStroke = null;
let l3Recognizer = null;
let l3Drawing = null;
let l3TesseractWorker = null;
let l3OcrDebounceTimer = null;
let l3OcrRunning = false;

// 初始化手寫辨識：優先 Chrome HWR API（Chrome 99-127），不支援時以 Tesseract.js OCR 備援
(async function initHWR() {
    const getStatus = () => document.getElementById('l3-hwr-status');

    if ('createHandwritingRecognizer' in navigator) {
        try {
            l3Recognizer = await navigator.createHandwritingRecognizer({ languages: ['en'] });
            const el = getStatus();
            if (el) el.textContent = '手寫辨識已啟用';
            return;
        } catch(e) {}
    }

    // Tesseract.js OCR fallback — 動態載入，避免增加初始頁面體積
    const el = getStatus();
    if (el) el.textContent = 'OCR 載入中...';
    try {
        await new Promise((resolve, reject) => {
            if (window.Tesseract) { resolve(); return; }
            const s = document.createElement('script');
            s.src = 'https://unpkg.com/tesseract.js@4/dist/tesseract.min.js';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
        l3TesseractWorker = await Tesseract.createWorker('eng', 1, {
            logger: m => {
                if (m.status === 'loading tesseract core' || m.status === 'initializing tesseract') {
                    const s = getStatus();
                    if (s) s.textContent = `OCR 載入中 ${Math.round((m.progress || 0) * 100)}%`;
                }
            }
        });
        const el2 = getStatus();
        if (el2) el2.textContent = 'OCR 手寫辨識已就緒（停筆後自動辨識）';
    } catch(e) {
        const el2 = getStatus();
        if (el2) el2.textContent = '手寫辨識不可用，請直接使用鍵盤輸入';
    }
})();

function initL3Canvas() {
    l3Canvas = document.getElementById('l3-canvas');
    if (!l3Canvas || l3Canvas._l3init) return;
    l3Canvas._l3init = true;
    l3Ctx = l3Canvas.getContext('2d');

    l3Canvas.addEventListener('pointerdown', e => {
        l3Canvas.setPointerCapture(e.pointerId);
        l3IsDrawing = true;
        const r = l3Canvas.getBoundingClientRect();
        l3CurrentStroke = [{ x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp }];
    });
    l3Canvas.addEventListener('pointermove', e => {
        if (!l3IsDrawing) return;
        const r = l3Canvas.getBoundingClientRect();
        l3CurrentStroke.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp });
        redrawL3Canvas();
    });

    function endL3() {
        if (l3IsDrawing && l3CurrentStroke && l3CurrentStroke.length) {
            l3Strokes.push(l3CurrentStroke);
            if (l3Drawing) {
                try {
                    const stroke = new HandwritingStroke();
                    l3CurrentStroke.forEach(pt => stroke.addPoint({ x: pt.x, y: pt.y, t: pt.t }));
                    l3Drawing.addStroke(stroke);
                    l3Drawing.getPrediction().then(preds => {
                        if (preds && preds.length > 0 && preds[0].text) {
                            document.getElementById('l3-input').value = preds[0].text;
                        }
                    }).catch(() => {});
                } catch(e) {}
            }
            if (l3TesseractWorker) {
                clearTimeout(l3OcrDebounceTimer);
                l3OcrDebounceTimer = setTimeout(runTesseractOCR, 800);
            }
            l3CurrentStroke = null;
            redrawL3Canvas();
        }
        l3IsDrawing = false;
    }
    l3Canvas.addEventListener('pointerup', endL3);
    l3Canvas.addEventListener('pointercancel', endL3);
    l3Canvas.addEventListener('pointerleave', endL3);
}

function resizeL3Canvas() {
    if (!l3Canvas || !l3Ctx) return;
    const rect = l3Canvas.getBoundingClientRect();
    if (!rect.width) return;
    l3Canvas.width = rect.width * L3_DPR;
    l3Canvas.height = rect.height * L3_DPR;
    l3Ctx.setTransform(L3_DPR, 0, 0, L3_DPR, 0, 0);
    redrawL3Canvas();
}

function redrawL3Canvas() {
    if (!l3Ctx || !l3Canvas) return;
    const w = l3Canvas.width / L3_DPR;
    const h = l3Canvas.height / L3_DPR;
    l3Ctx.clearRect(0, 0, w, h);

    l3Ctx.save();
    l3Ctx.strokeStyle = '#007aff';
    l3Ctx.lineWidth = 3;
    l3Ctx.lineJoin = 'round';
    l3Ctx.lineCap = 'round';
    const drawS = s => {
        if (!s || s.length < 2) return;
        l3Ctx.beginPath();
        l3Ctx.moveTo(s[0].x, s[0].y);
        for (let i = 1; i < s.length; i++) l3Ctx.lineTo(s[i].x, s[i].y);
        l3Ctx.stroke();
    };
    l3Strokes.forEach(drawS);
    if (l3CurrentStroke) drawS(l3CurrentStroke);
    l3Ctx.restore();
}

function clearL3Canvas() {
    clearTimeout(l3OcrDebounceTimer);
    l3OcrDebounceTimer = null;
    l3Strokes = [];
    l3CurrentStroke = null;
    if (l3Drawing) {
        try { if (typeof l3Drawing.clear === 'function') l3Drawing.clear(); } catch(e) {}
        if (l3Recognizer) {
            try { l3Drawing = l3Recognizer.startDrawing({ hints: { recognitionType: 'text' } }); } catch(e) {}
        }
    }
    document.getElementById('l3-input').value = '';
    redrawL3Canvas();
}

async function runTesseractOCR() {
    if (!l3TesseractWorker || !l3Canvas || !l3Strokes.length || l3OcrRunning) return;
    l3OcrRunning = true;
    const statusEl = document.getElementById('l3-hwr-status');
    if (statusEl) statusEl.textContent = '辨識中...';
    // 建立黑字白底臨時 canvas，提高 OCR 辨識率
    const tmp = document.createElement('canvas');
    tmp.width = l3Canvas.width;
    tmp.height = l3Canvas.height;
    const ctx = tmp.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.save();
    ctx.scale(L3_DPR, L3_DPR);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    l3Strokes.forEach(s => {
        if (!s || s.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(s[0].x, s[0].y);
        for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y);
        ctx.stroke();
    });
    ctx.restore();
    try {
        const { data: { text } } = await l3TesseractWorker.recognize(tmp);
        const cleaned = text.trim().replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ');
        if (cleaned) document.getElementById('l3-input').value = cleaned;
        if (statusEl) statusEl.textContent = 'OCR 手寫辨識已就緒（停筆後自動辨識）';
    } catch(e) {
        if (statusEl) statusEl.textContent = 'OCR 辨識失敗，請使用鍵盤輸入';
    }
    l3OcrRunning = false;
}

// L2-A: 聽後重組 (REDESIGN-3) — 聽例句，依記憶從詞塊池重組語序
registerQuestionModule(2, {
    requiresListening: true,
    activate(wordData) {
        document.getElementById('p-sentence-row').style.display = 'none';
        document.getElementById('p-etymology-row').style.display = 'none';
        showAudioButtons(true, false);
        document.getElementById('p-word').style.visibility = 'hidden';
        document.getElementById('action-l2').style.display = 'flex';
        document.getElementById('next-word-btn').style.display = 'none';
        document.getElementById('l2-feedback').textContent = '';
        document.getElementById('l2-feedback').className = '';
        document.getElementById('l2-actions').style.display = 'flex';
        document.getElementById('l2-countdown').style.display = 'none';
        updateProgressDots('l2-dots', wordData.successes || 0);

        l2OriginalTokens = (wordData.sentence || '').split(/\s+/).filter(t => t);
        l2AnswerTokens = [];
        l2PoolTokens = [...l2OriginalTokens].sort(() => 0.5 - Math.random());
        while (l2PoolTokens.length > 1 && l2PoolTokens.join(' ') === l2OriginalTokens.join(' ')) {
            l2PoolTokens.sort(() => 0.5 - Math.random());
        }
        renderL2Pool();
        renderL2Answer();
        speakText(wordData.sentence);
    },
    deactivate() {
        cancelAutoAdvance('l2-countdown');
        document.getElementById('p-word').style.visibility = 'visible';
        document.getElementById('action-l2').style.display = 'none';
    }
});

// L2-S: 覆誦整句
let l2sRecognition = null;
let l2sListening = false;
let l2sMediaRecorder = null;
let l2sAudioChunks = [];
let l2sLastAudioUrl = null;

registerQuestionModule(2, {
    requiresSpeaking: true,
    activate(wordData) {
        document.getElementById('p-sentence-row').style.display = 'none';
        document.getElementById('p-etymology-row').style.display = 'none';
        showAudioButtons(false, false);
        document.getElementById('p-word').style.visibility = 'visible';
        document.getElementById('action-l2s').style.display = 'flex';
        document.getElementById('next-word-btn').style.display = 'none';
        document.getElementById('l2s-countdown').style.display = 'none';
        document.getElementById('l2s-feedback').textContent = '請點擊麥克風發音';
        document.getElementById('l2s-feedback').className = '';
        document.getElementById('l2s-result-actions').style.display = 'none';
        document.getElementById('l2s-replay-btn').style.display = 'none';
        l2sLastAudioUrl = null;
        document.getElementById('l2s-sentence').textContent = wordData.sentence || '';
        updateProgressDots('l2s-dots', wordData.successes || 0);
        speakText(wordData.sentence);
    },
    deactivate() {
        cancelAutoAdvance('l2s-countdown');
        if (l2sRecognition) { try { l2sRecognition.abort(); } catch(e) {} l2sRecognition = null; }
        l2sListening = false;
        if (l2sMediaRecorder && l2sMediaRecorder.state === 'recording') { try { l2sMediaRecorder.stop(); } catch(e) {} }
        const micBtn = document.getElementById('l2s-mic-btn');
        if (micBtn) micBtn.classList.remove('listening');
        document.getElementById('p-sentence-row').style.display = '';
        document.getElementById('p-etymology-row').style.display = '';
        document.getElementById('action-l2s').style.display = 'none';
    }
});

function l2sToggleMic() {
    if (l2sListening) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert('抱歉，您的瀏覽器不支援語音辨識功能。');
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        l2sAudioChunks = [];
        l2sMediaRecorder = new MediaRecorder(stream);
        l2sMediaRecorder.ondataavailable = e => { if (e.data.size > 0) l2sAudioChunks.push(e.data); };
        l2sMediaRecorder.onstop = () => {
            const blob = new Blob(l2sAudioChunks, { type: 'audio/webm' });
            l2sLastAudioUrl = URL.createObjectURL(blob);
            document.getElementById('l2s-replay-btn').style.display = '';
            stream.getTracks().forEach(t => t.stop());
        };
        l2sMediaRecorder.start();
    }).catch(() => {});
    l2sRecognition = new SR();
    l2sRecognition.lang = 'en-US';
    l2sRecognition.interimResults = false;
    l2sRecognition.onstart = () => {
        l2sListening = true;
        document.getElementById('l2s-mic-btn').classList.add('listening');
        document.getElementById('l2s-feedback').textContent = '聆聽中...';
        document.getElementById('l2s-feedback').className = '';
    };
    l2sRecognition.onresult = (event) => {
        currentWordData.attempts++;
        const transcript = event.results[0][0].transcript;
        const spoken = transcript.toLowerCase().replace(/[^\w\s]/g, '');
        const target = currentWordData.word.toLowerCase().replace(/[^\w]/g, '');
        const fb = document.getElementById('l2s-feedback');
        if (spoken.includes(target)) {
            currentWordData.successes++;
            updateProgressDots('l2s-dots', currentWordData.successes);
            fb.textContent = `正確！辨識到：${transcript}`;
            fb.className = 'feedback-correct';
            document.getElementById('l2s-result-actions').style.display = 'none';
            startAutoAdvance('l2s-countdown');
        } else {
            fb.textContent = `辨識到：${transcript}`;
            fb.className = 'feedback-wrong';
            if (currentWordData.attempts >= 5) {
                startAutoAdvance('l2s-countdown');
            } else {
                document.getElementById('l2s-result-actions').style.display = 'flex';
            }
        }
        updatePracticeProgress(currentWordData.successes, currentWordData.attempts);
    };
    l2sRecognition.onerror = () => {
        document.getElementById('l2s-feedback').textContent = '未接收到語音，請重試';
        document.getElementById('l2s-feedback').className = 'feedback-wrong';
    };
    l2sRecognition.onend = () => {
        l2sListening = false;
        document.getElementById('l2s-mic-btn').classList.remove('listening');
        if (l2sMediaRecorder && l2sMediaRecorder.state === 'recording') { try { l2sMediaRecorder.stop(); } catch(e) {} }
    };
    l2sRecognition.start();
}

function l2sPlayReplay() {
    if (l2sLastAudioUrl) new Audio(l2sLastAudioUrl).play();
}

function l2sRetry() {
    document.getElementById('l2s-result-actions').style.display = 'none';
    document.getElementById('l2s-feedback').textContent = '請點擊麥克風發音';
    document.getElementById('l2s-feedback').className = '';
    l2sToggleMic();
}

// L3-A: 聽寫填空（補模組註冊）
registerQuestionModule(3, {
    activate(wordData) {
        document.getElementById('p-sentence-row').style.display = 'none';
        document.getElementById('p-etymology-row').style.display = 'none';
        showAudioButtons(false, false);
        document.getElementById('p-word').style.visibility = 'hidden';
        document.getElementById('action-l3').style.display = 'flex';
        document.getElementById('next-word-btn').style.display = 'none';
        document.getElementById('l3-feedback').textContent = '';
        document.getElementById('l3-feedback').className = '';
        document.getElementById('l3-actions').style.display = 'flex';
        document.getElementById('l3-countdown').style.display = 'none';
        document.getElementById('l3-input').value = '';
        updateProgressDots('l3-dots', wordData.successes || 0);
        const sentence = wordData.sentence || '';
        const escaped = wordData.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const gapHtml = escapeHtml(sentence).replace(
            new RegExp(`(?<![\\w])${escaped}(?![\\w])`, 'gi'),
            '<span class="l3-blank">___</span>'
        );
        document.getElementById('l3-gap-sentence').innerHTML = gapHtml || escapeHtml(sentence);
        initL3Canvas();
        resizeL3Canvas();
        l3Strokes = [];
        redrawL3Canvas();
        speakText(sentence);
    },
    deactivate() {
        cancelAutoAdvance('l3-countdown');
        document.getElementById('p-word').style.visibility = 'visible';
        document.getElementById('p-sentence-row').style.display = '';
        document.getElementById('p-etymology-row').style.display = '';
        document.getElementById('action-l3').style.display = 'none';
    }
});

function submitL3() {
    const input = document.getElementById('l3-input');
    const typed = input.value.trim().toLowerCase().replace(/[^\w]/g, '');
    const target = currentWordData.word.toLowerCase().replace(/[^\w]/g, '');
    if (!typed) return;
    currentWordData.attempts++;
    const fb = document.getElementById('l3-feedback');
    const dist = levenshtein(typed, target);
    const isClose = dist === 1 && target.length > 3;
    if (dist === 0) {
        currentWordData.successes++;
        updateProgressDots('l3-dots', currentWordData.successes);
        fb.textContent = '正確！';
        fb.className = 'feedback-correct';
        document.getElementById('l3-actions').style.display = 'none';
        startAutoAdvance('l3-countdown');
    } else if (isClose) {
        currentWordData.successes++;
        updateProgressDots('l3-dots', currentWordData.successes);
        const sim = Math.round(((target.length - dist) / target.length) * 100);
        fb.textContent = `接近正確（辨識：${typed}，相似度 ${sim}%）`;
        fb.className = 'feedback-correct';
        document.getElementById('l3-actions').style.display = 'none';
        startAutoAdvance('l3-countdown');
    } else {
        fb.textContent = `錯誤，正確拼寫：${currentWordData.word}`;
        fb.className = 'feedback-wrong';
        input.value = '';
        if (currentWordData.attempts >= 5) {
            document.getElementById('l3-actions').style.display = 'none';
            startAutoAdvance('l3-countdown');
        }
    }
    updatePracticeProgress(currentWordData.successes, currentWordData.attempts);
}

// === L3-V: POS 造句 ===
let l3vTokens = [];
let l3vSortable = null;

registerQuestionModule(3, {
    activate(wordData) {
        showAudioButtons(false, false);
        document.getElementById('p-word').style.visibility = 'visible';
        document.getElementById('action-l3v').style.display = 'flex';
        document.getElementById('next-word-btn').style.display = 'none';
        document.getElementById('l3v-feedback').textContent = '';
        document.getElementById('l3v-feedback').className = '';
        document.getElementById('l3v-actions').style.display = 'flex';
        document.getElementById('l3v-countdown').style.display = 'none';
        document.getElementById('l3v-input').value = '';
        l3vTokens = [];
        updateProgressDots('l3v-dots', wordData.successes || 0);
        renderL3VSentence();
        updateL3VWalsHints();
        speakText(wordData.word);
    },
    deactivate() {
        cancelAutoAdvance('l3v-countdown');
        document.getElementById('p-word').style.visibility = 'visible';
        document.getElementById('action-l3v').style.display = 'none';
    }
});

function getWordMeta(raw) {
    const wordMap = buildWordPosMap();
    const lower = raw.toLowerCase();
    const pos = wordMap.get(lower) || COMMON_WORD_POS[lower] || '';
    let morph = '';
    for (const ds of datasets) {
        const w = ds.words.find(w => w.word.toLowerCase() === lower);
        if (w) { morph = w.morphological || ''; break; }
    }
    if (!morph) for (const item of storageData) {
        if (item.word.toLowerCase() === lower) { morph = item.morphological || ''; break; }
    }
    if (!morph) for (const [, item] of grid.entries()) {
        if (item.word.toLowerCase() === lower) { morph = item.morphological || ''; break; }
    }
    return { word: raw, pos, morphological: morph };
}

function l3vAddWord() {
    const input = document.getElementById('l3v-input');
    const raw = input.value.trim();
    if (!raw) return;
    l3vTokens.push(getWordMeta(raw));
    input.value = '';
    renderL3VSentence();
    updateL3VWalsHints();
    input.focus();
}

function l3vRemoveWord(idx) {
    l3vTokens.splice(idx, 1);
    renderL3VSentence();
    updateL3VWalsHints();
}

let l3vHintsCollapsed = false;

function toggleL3VHints() {
    l3vHintsCollapsed = !l3vHintsCollapsed;
    const hints = document.getElementById('l3v-wals-hints');
    const btn = document.getElementById('l3v-hints-toggle-btn');
    if (hints) hints.classList.toggle('collapsed', l3vHintsCollapsed);
    if (btn) btn.textContent = l3vHintsCollapsed ? '▶ WALS 規則提示' : '▼ WALS 規則提示';
}

function renderL3VSentence() {
    const area = document.getElementById('l3v-sentence');
    if (!area) return;
    if (l3vSortable) { l3vSortable.destroy(); l3vSortable = null; }
    if (!l3vTokens.length) {
        area.innerHTML = '<span style="color:#c7c7cc; font-size:14px;">點擊「加入」放入單字...</span>';
        return;
    }
    area.innerHTML = '';
    l3vTokens.forEach((t, i) => {
        const chip = document.createElement('span');
        chip.className = 'l3v-word-chip';
        chip.textContent = t.word + ' ×';
        chip.dataset.idx = i;
        chip.style.backgroundColor = t.pos ? getPosColor(t.pos) : '#e5e5ea';
        chip.onclick = () => l3vRemoveWord(i);
        area.appendChild(chip);
    });
    initL3VSortable();
}

function initL3VSortable() {
    const area = document.getElementById('l3v-sentence');
    if (!area || typeof Sortable === 'undefined' || !l3vTokens.length) return;
    l3vSortable = Sortable.create(area, {
        animation: 150,
        onEnd: () => {
            const newTokens = [];
            Array.from(area.children).forEach((chip, i) => {
                const oldIdx = parseInt(chip.dataset.idx);
                if (!isNaN(oldIdx) && l3vTokens[oldIdx]) {
                    newTokens.push(l3vTokens[oldIdx]);
                }
                chip.dataset.idx = i;
                chip.onclick = () => l3vRemoveWord(i);
            });
            if (newTokens.length === l3vTokens.length) l3vTokens = newTokens;
            updateL3VWalsHints();
        }
    });
}

function updateL3VWalsHints() {
    const container = document.getElementById('l3v-wals-hints');
    if (!container) return;
    const unlocked = rulesA1.filter(r => isRuleUnlocked(r.id));
    if (!unlocked.length) {
        container.innerHTML = '<span style="color:#c7c7cc; font-size:13px;">解鎖 WALS 規則後，此處將顯示語法提示。</span>';
        return;
    }
    container.innerHTML = unlocked.map(rule => {
        const ok = l3vTokens.length > 0 && checkWalsRule(rule.id, l3vTokens);
        return `<div class="l3v-hint-item ${ok ? 'l3v-hint-satisfied' : 'l3v-hint-unsatisfied'}">${ok ? '✓' : '○'} WALS ${rule.id} ${rule.name}</div>`;
    }).join('');
}

function submitL3V() {
    if (!l3vTokens.length) {
        const fb = document.getElementById('l3v-feedback');
        fb.textContent = '請先加入單字';
        fb.className = 'feedback-wrong';
        return;
    }
    const targetLower = currentWordData.word.toLowerCase();
    if (!l3vTokens.some(t => t.word.toLowerCase() === targetLower)) {
        const fb = document.getElementById('l3v-feedback');
        fb.textContent = `句子必須包含目標單字：${currentWordData.word}`;
        fb.className = 'feedback-wrong';
        return;
    }
    if (l3vTokens.length < 2) {
        const fb = document.getElementById('l3v-feedback');
        fb.textContent = '請至少加入 2 個單字';
        fb.className = 'feedback-wrong';
        return;
    }
    currentWordData.attempts++;
    const fb = document.getElementById('l3v-feedback');
    const unlockedIds = rulesA1.filter(r => isRuleUnlocked(r.id)).map(r => r.id);
    const satisfiedIds = unlockedIds.filter(id => checkWalsRule(id, l3vTokens));
    if (satisfiedIds.length > 0 || unlockedIds.length === 0) {
        currentWordData.successes++;
        updateProgressDots('l3v-dots', currentWordData.successes);
        let score = 0;
        satisfiedIds.forEach(id => {
            score += (activeRuleIds && activeRuleIds.includes(id)) ? 2 : 1;
            ruleHitCounts[id] = (ruleHitCounts[id] || 0) + 1;
        });
        const combo = getComboBonus(satisfiedIds);
        score += combo;
        if (score > 0) {
            const comboLabel = combo > 0 ? ` (含組合加成 +${combo})` : '';
            fb.textContent = `語法得分 +${score}${comboLabel}`;
            updateTokens(score);
        } else {
            fb.textContent = '良好！';
        }
        fb.className = 'feedback-correct';
        document.getElementById('l3v-actions').style.display = 'none';
        startAutoAdvance('l3v-countdown');
    } else {
        fb.textContent = '試試看加入更多符合已解鎖規則的單字';
        fb.className = 'feedback-wrong';
        if (currentWordData.attempts >= 5) {
            document.getElementById('l3v-actions').style.display = 'none';
            startAutoAdvance('l3v-countdown');
        }
    }
    updatePracticeProgress(currentWordData.successes, currentWordData.attempts);
}

document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (document.getElementById('action-l3v').style.display !== 'none') {
        l3vAddWord();
    } else if (document.getElementById('action-l4').style.display !== 'none') {
        l4vAddWord();
    } else if (document.getElementById('action-l5').style.display !== 'none') {
        l5vAddWord();
    }
});

// === L4: 限制造句 (REDESIGN-4) ===
let l4vTokens = [];
let l4vSortable = null;

function calcL4Required() {
    const unlocked = rulesA1.filter(r => isRuleUnlocked(r.id));
    return Math.max(1, Math.ceil(unlocked.length / 2));
}

registerQuestionModule(4, {
    activate(wordData) {
        showAudioButtons(false, false);
        document.getElementById('p-word').style.visibility = 'visible';
        document.getElementById('action-l4').style.display = 'flex';
        document.getElementById('next-word-btn').style.display = 'none';
        document.getElementById('l4-feedback').textContent = '';
        document.getElementById('l4-feedback').className = '';
        document.getElementById('l4-actions').style.display = 'flex';
        document.getElementById('l4-countdown').style.display = 'none';
        document.getElementById('l4-input').value = '';
        l4vTokens = [];
        document.getElementById('l4-req-count').textContent = calcL4Required();
        updateProgressDots('l4-dots', wordData.successes || 0);
        renderL4VSentence();
        updateL4VWalsHints();
        speakText(wordData.word);
    },
    deactivate() {
        cancelAutoAdvance('l4-countdown');
        document.getElementById('action-l4').style.display = 'none';
    }
});

function l4vAddWord() {
    const input = document.getElementById('l4-input');
    const raw = input.value.trim();
    if (!raw) return;
    l4vTokens.push(getWordMeta(raw));
    input.value = '';
    renderL4VSentence();
    updateL4VWalsHints();
    input.focus();
}

function l4vRemoveWord(idx) {
    l4vTokens.splice(idx, 1);
    renderL4VSentence();
    updateL4VWalsHints();
}

function renderL4VSentence() {
    const area = document.getElementById('l4-sentence');
    if (!area) return;
    if (l4vSortable) { l4vSortable.destroy(); l4vSortable = null; }
    if (!l4vTokens.length) {
        area.innerHTML = '<span style="color:#c7c7cc; font-size:14px;">點擊「加入」放入單字...</span>';
        return;
    }
    area.innerHTML = '';
    l4vTokens.forEach((t, i) => {
        const chip = document.createElement('span');
        chip.className = 'l3v-word-chip';
        chip.textContent = t.word + ' ×';
        chip.dataset.idx = i;
        chip.style.backgroundColor = t.pos ? getPosColor(t.pos) : '#e5e5ea';
        chip.onclick = () => l4vRemoveWord(i);
        area.appendChild(chip);
    });
    initL4VSortable();
}

function initL4VSortable() {
    const area = document.getElementById('l4-sentence');
    if (!area || typeof Sortable === 'undefined' || !l4vTokens.length) return;
    l4vSortable = Sortable.create(area, {
        animation: 150,
        onEnd: () => {
            const newTokens = [];
            Array.from(area.children).forEach((chip, i) => {
                const oldIdx = parseInt(chip.dataset.idx);
                if (!isNaN(oldIdx) && l4vTokens[oldIdx]) {
                    newTokens.push(l4vTokens[oldIdx]);
                }
                chip.dataset.idx = i;
                chip.onclick = () => l4vRemoveWord(i);
            });
            if (newTokens.length === l4vTokens.length) l4vTokens = newTokens;
            updateL4VWalsHints();
        }
    });
}

function updateL4VWalsHints() {
    const container = document.getElementById('l4v-wals-hints');
    if (!container) return;
    const unlocked = rulesA1.filter(r => isRuleUnlocked(r.id));
    if (!unlocked.length) {
        container.innerHTML = '<span style="color:#c7c7cc; font-size:13px;">解鎖 WALS 規則後才能進行此題型。</span>';
        return;
    }
    const req = calcL4Required();
    const rows = unlocked.map(rule => {
        const ok = l4vTokens.length > 0 && checkWalsRule(rule.id, l4vTokens);
        return `<div class="l3v-hint-item ${ok ? 'l3v-hint-satisfied' : 'l3v-hint-unsatisfied'}">${ok ? '✓' : '○'} WALS ${rule.id} ${rule.name}</div>`;
    }).join('');
    container.innerHTML = rows + `<div style="font-size:12px; color:var(--text-secondary); margin-top:4px; text-align:center;">需滿足 ${req} 條規則才過關</div>`;
}

function submitL4V() {
    if (!l4vTokens.length) {
        const fb = document.getElementById('l4-feedback');
        fb.textContent = '請先加入單字';
        fb.className = 'feedback-wrong';
        return;
    }
    const targetLower = currentWordData.word.toLowerCase();
    if (!l4vTokens.some(t => t.word.toLowerCase() === targetLower)) {
        const fb = document.getElementById('l4-feedback');
        fb.textContent = `句子必須包含目標單字：${currentWordData.word}`;
        fb.className = 'feedback-wrong';
        return;
    }
    if (l4vTokens.length < 2) {
        const fb = document.getElementById('l4-feedback');
        fb.textContent = '請至少加入 2 個單字';
        fb.className = 'feedback-wrong';
        return;
    }
    const unlockedIds = rulesA1.filter(r => isRuleUnlocked(r.id)).map(r => r.id);
    const satisfiedIds = unlockedIds.filter(id => checkWalsRule(id, l4vTokens));
    const noRules = unlockedIds.length === 0;
    const hasActiveRule = satisfiedIds.some(id => activeRuleIds && activeRuleIds.includes(id));
    const fb = document.getElementById('l4-feedback');
    if (hasActiveRule || noRules) {
        currentWordData.attempts++;
        currentWordData.successes++;
        updateProgressDots('l4-dots', currentWordData.successes);
        let score = 0;
        satisfiedIds.forEach(id => {
            score += (activeRuleIds && activeRuleIds.includes(id)) ? 2 : 1;
            ruleHitCounts[id] = (ruleHitCounts[id] || 0) + 1;
        });
        const combo = getComboBonus(satisfiedIds);
        score += combo;
        const comboLabel = combo > 0 ? ` (含組合加成 +${combo})` : '';
        fb.textContent = noRules ? '良好！（尚未解鎖規則）' : `語法得分 +${score}${comboLabel}`;
        fb.className = 'feedback-correct';
        if (score > 0) updateTokens(score);
        updatePracticeProgress(currentWordData.successes, currentWordData.attempts);
        document.getElementById('l4-actions').style.display = 'none';
        startAutoAdvance('l4-countdown');
    } else {
        const activeNames = (activeRuleIds || []).map(id => { const r = rulesA1.find(x => x.id === id); return r ? r.name : id; }).join('、');
        fb.textContent = activeNames ? `需滿足主動規則：${activeNames}` : '需滿足至少一條已解鎖規則';
        fb.className = 'feedback-wrong';
    }
}

// === L5: 情境造句 (REDESIGN-5) ===
let l5vTokens = [];
let l5vSortable = null;

function calcContextBonus(contextSentence, userTokens) {
    const contextWords = (contextSentence || '').split(/\s+/).filter(t => t);
    const userWords = new Set(userTokens.map(t => t.word.toLowerCase()));
    let bonus = 0;
    contextWords.forEach(t => {
        const lower = t.toLowerCase().replace(/[^a-z]/g, '');
        if (lower && !COMMON_WORD_POS[lower] && userWords.has(lower)) bonus++;
    });
    return Math.min(bonus, 3);
}

registerQuestionModule(5, {
    activate(wordData) {
        showAudioButtons(false, false);
        document.getElementById('p-word').style.visibility = 'visible';
        document.getElementById('p-sentence-row').style.display = 'none';
        document.getElementById('action-l5').style.display = 'flex';
        document.getElementById('next-word-btn').style.display = 'none';
        document.getElementById('l5-feedback').textContent = '';
        document.getElementById('l5-feedback').className = '';
        document.getElementById('l5-actions').style.display = 'flex';
        document.getElementById('l5-countdown').style.display = 'none';
        document.getElementById('l5-input').value = '';
        l5vTokens = [];
        document.getElementById('l5-context').textContent = wordData.sentence || '';
        updateProgressDots('l5-dots', wordData.successes || 0);
        renderL5VSentence();
        updateL5VWalsHints();
        speakText(wordData.word);
    },
    deactivate() {
        cancelAutoAdvance('l5-countdown');
        document.getElementById('p-sentence-row').style.display = '';
        document.getElementById('action-l5').style.display = 'none';
    }
});

function l5vAddWord() {
    const input = document.getElementById('l5-input');
    const raw = input.value.trim();
    if (!raw) return;
    l5vTokens.push(getWordMeta(raw));
    input.value = '';
    renderL5VSentence();
    updateL5VWalsHints();
    input.focus();
}

function l5vRemoveWord(idx) {
    l5vTokens.splice(idx, 1);
    renderL5VSentence();
    updateL5VWalsHints();
}

function renderL5VSentence() {
    const area = document.getElementById('l5-sentence');
    if (!area) return;
    if (l5vSortable) { l5vSortable.destroy(); l5vSortable = null; }
    if (!l5vTokens.length) {
        area.innerHTML = '<span style="color:#c7c7cc; font-size:14px;">點擊「加入」放入單字...</span>';
        return;
    }
    area.innerHTML = '';
    l5vTokens.forEach((t, i) => {
        const chip = document.createElement('span');
        chip.className = 'l3v-word-chip';
        chip.textContent = t.word + ' ×';
        chip.dataset.idx = i;
        chip.style.backgroundColor = t.pos ? getPosColor(t.pos) : '#e5e5ea';
        chip.onclick = () => l5vRemoveWord(i);
        area.appendChild(chip);
    });
    initL5VSortable();
}

function initL5VSortable() {
    const area = document.getElementById('l5-sentence');
    if (!area || typeof Sortable === 'undefined' || !l5vTokens.length) return;
    l5vSortable = Sortable.create(area, {
        animation: 150,
        onEnd: () => {
            const newTokens = [];
            Array.from(area.children).forEach((chip, i) => {
                const oldIdx = parseInt(chip.dataset.idx);
                if (!isNaN(oldIdx) && l5vTokens[oldIdx]) {
                    newTokens.push(l5vTokens[oldIdx]);
                }
                chip.dataset.idx = i;
                chip.onclick = () => l5vRemoveWord(i);
            });
            if (newTokens.length === l5vTokens.length) l5vTokens = newTokens;
            updateL5VWalsHints();
        }
    });
}

function updateL5VWalsHints() {
    const container = document.getElementById('l5v-wals-hints');
    if (!container) return;
    const unlocked = rulesA1.filter(r => isRuleUnlocked(r.id));
    if (!unlocked.length) {
        container.innerHTML = '<span style="color:#c7c7cc; font-size:13px;">解鎖 WALS 規則後，此處將顯示語法提示。</span>';
        return;
    }
    container.innerHTML = unlocked.map(rule => {
        const ok = l5vTokens.length > 0 && checkWalsRule(rule.id, l5vTokens);
        return `<div class="l3v-hint-item ${ok ? 'l3v-hint-satisfied' : 'l3v-hint-unsatisfied'}">${ok ? '✓' : '○'} WALS ${rule.id} ${rule.name}</div>`;
    }).join('');
}

function submitL5V() {
    if (!l5vTokens.length) {
        const fb = document.getElementById('l5-feedback');
        fb.textContent = '請先加入單字';
        fb.className = 'feedback-wrong';
        return;
    }
    const targetLower = currentWordData.word.toLowerCase();
    if (!l5vTokens.some(t => t.word.toLowerCase() === targetLower)) {
        const fb = document.getElementById('l5-feedback');
        fb.textContent = `句子必須包含目標單字：${currentWordData.word}`;
        fb.className = 'feedback-wrong';
        return;
    }
    if (l5vTokens.length < 2) {
        const fb = document.getElementById('l5-feedback');
        fb.textContent = '請至少加入 2 個單字';
        fb.className = 'feedback-wrong';
        return;
    }
    currentWordData.attempts++;
    const fb = document.getElementById('l5-feedback');
    const unlockedIds = rulesA1.filter(r => isRuleUnlocked(r.id)).map(r => r.id);
    const satisfiedIds = unlockedIds.filter(id => checkWalsRule(id, l5vTokens));
    const contextBonus = calcContextBonus(currentWordData.sentence || '', l5vTokens);
    if (satisfiedIds.length > 0 || unlockedIds.length === 0) {
        currentWordData.successes++;
        updateProgressDots('l5-dots', currentWordData.successes);
        let score = 0;
        satisfiedIds.forEach(id => {
            score += (activeRuleIds && activeRuleIds.includes(id)) ? 2 : 1;
            ruleHitCounts[id] = (ruleHitCounts[id] || 0) + 1;
        });
        const combo = getComboBonus(satisfiedIds);
        score += combo;
        const total = score + contextBonus;
        let msg = score > 0 ? `語法得分 +${score}` : '良好！';
        if (combo > 0) msg += ` (組合 +${combo})`;
        if (contextBonus > 0) msg += ` 情境加成 +${contextBonus}`;
        fb.textContent = msg;
        fb.className = 'feedback-correct';
        if (total > 0) updateTokens(total);
        document.getElementById('l5-actions').style.display = 'none';
        startAutoAdvance('l5-countdown');
    } else {
        fb.textContent = '試試看加入更多符合已解鎖規則的單字';
        fb.className = 'feedback-wrong';
        if (currentWordData.attempts >= 5) {
            document.getElementById('l5-actions').style.display = 'none';
            startAutoAdvance('l5-countdown');
        }
    }
    updatePracticeProgress(currentWordData.successes, currentWordData.attempts);
}
