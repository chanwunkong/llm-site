let practiceQueue = [];
let currentPracticeIndex = 0;
let activeRuleIds = [];
let isSlowSpeed = false;
let recognition = null;
let isListening = false;
let currentWordData = null;
let autoAdvanceTimer = null;
let practiceListeningDisabled = false;
let practiceSpeakingDisabled = false;

function disableListening() {
    practiceListeningDisabled = true;
    document.getElementById('disable-listening-btn').style.display = 'none';
    document.getElementById('listening-disabled-notice').style.display = 'inline';
    if (currentWordData) dispatchQuestion(currentWordData);
}

function disableSpeaking() {
    practiceSpeakingDisabled = true;
    document.getElementById('disable-speaking-btn').style.display = 'none';
    document.getElementById('speaking-disabled-notice').style.display = 'inline';
    if (currentWordData) dispatchQuestion(currentWordData);
}

function showAudioButtons(canListening, canSpeaking) {
    document.getElementById('disable-listening-btn').style.display =
        (canListening && !practiceListeningDisabled) ? '' : 'none';
    document.getElementById('disable-speaking-btn').style.display =
        (canSpeaking && !practiceSpeakingDisabled) ? '' : 'none';
}

function toggleSpeed() {
    isSlowSpeed = !isSlowSpeed;
    document.getElementById('speed-toggle').textContent = `語速: ${isSlowSpeed ? '慢速' : '正常'}`;
}

function speakText(text) {
    if (!text) return; window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = isSlowSpeed ? 0.6 : 1.0;
    if (voiceSettings.voiceURI) {
        const voice = window.speechSynthesis.getVoices().find(v => v.voiceURI === voiceSettings.voiceURI);
        if (voice) utterance.voice = voice;
    }
    utterance.lang = voiceSettings.lang || 'en-US';
    window.speechSynthesis.speak(utterance);
}

function speakSequence(texts) {
    window.speechSynthesis.cancel();
    texts.filter(t => t).forEach(text => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = isSlowSpeed ? 0.6 : 1.0;
        if (voiceSettings.voiceURI) {
            const voice = window.speechSynthesis.getVoices().find(v => v.voiceURI === voiceSettings.voiceURI);
            if (voice) utterance.voice = voice;
        }
        utterance.lang = voiceSettings.lang || 'en-US';
        window.speechSynthesis.speak(utterance);
    });
}

function fisherYatesShuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function shuffleAndTake(arr, n) {
    return fisherYatesShuffle([...arr]).slice(0, n);
}

function takeOldest(arr, n) {
    return arr.sort((a, b) => (a.levelUpdatedAt || 0) - (b.levelUpdatedAt || 0)).slice(0, n);
}

document.getElementById('play-btn').addEventListener('click', () => {
    if (!currentSaveId) return showToast('請先至設定頁面新增或選擇存檔');
    if (storageData.length >= 5) return showToast('存放區已滿，請先將單字放入地圖');

    let l5 = [], l4 = [], l3 = [], l2 = [], l1 = [];
    const existingWords = new Set();

    storageData.forEach(item => existingWords.add(item.word.toLowerCase().trim()));

    // DUP-2: 將所有單字庫已消耗的詞加入 existingWords，防止跨單字庫重複出題
    datasets.forEach(ds => {
        const consumed = usedIndices[ds.id] || 0;
        for (let i = 0; i < Math.min(consumed, ds.words.length); i++) {
            existingWords.add(ds.words[i].word.toLowerCase().trim());
        }
    });

    for (let [key, item] of grid.entries()) {
        existingWords.add(item.word.toLowerCase().trim());
        let pItem = { ...item, source: 'map', key: key, attempts: 0, successes: 0 };

        if (item.level === 5) l5.push(pItem);
        else if (item.level === 4) l4.push(pItem);
        else if (item.level === 3) l3.push(pItem);
        else if (item.level === 2) l2.push(pItem);
        else if (item.level === 1) l1.push(pItem);
    }

    practiceQueue = [
        ...shuffleAndTake(l5, 5),
        ...takeOldest(l4, 5),
        ...takeOldest(l3, 5),
        ...takeOldest(l2, 5),
        ...takeOldest(l1, 5)
    ];

    let l0 = [];
    if (datasets.length > 0) {
        const activeDs = getActiveDataset();
        let currentIndex = usedIndices[activeDatasetId] || 0;
        const neededNewWords = Math.min(5, 5 - storageData.length);

        while (l0.length < neededNewWords && currentIndex < activeDs.words.length) {
            const newWordObj = activeDs.words[currentIndex];
            const normalizedWord = newWordObj.word.toLowerCase().trim();
            if (!existingWords.has(normalizedWord)) {
                l0.push({ ...newWordObj, level: 1, source: 'csv', attempts: 0, successes: 0 });
                existingWords.add(normalizedWord);
            }
            currentIndex++;
        }
        usedIndices[activeDatasetId] = currentIndex;
    }

    practiceQueue = [...practiceQueue, ...l0];

    if (practiceQueue.length === 0) {
        showToast('題庫已全數練習完畢且地圖皆已滿級！請匯入新題庫。');
        return;
    }

    currentPracticeIndex = 0;
    practiceListeningDisabled = false;
    practiceSpeakingDisabled = false;
    document.getElementById('listening-disabled-notice').style.display = 'none';
    document.getElementById('speaking-disabled-notice').style.display = 'none';

    if (unlockedRules.length >= 2) {
        showSkillDraft();
    } else {
        activeRuleIds = [...unlockedRules];
        document.getElementById('practice-modal').classList.add('active');
        renderPracticeWord();
    }
});

function showSkillDraft() {
    const pool = [...unlockedRules];
    // Shuffle and pick 3 candidates (or fewer if not enough)
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const candidates = pool.slice(0, Math.min(3, pool.length));
    const container = document.getElementById('skill-draft-options');
    container.innerHTML = '';
    candidates.forEach(id => {
        const rule = rulesA1.find(r => r.id === id);
        if (!rule) return;
        const btn = document.createElement('button');
        btn.className = 'skill-draft-btn';
        btn.dataset.ruleId = id;
        btn.textContent = `WALS ${id}  ${rule.name}`;
        btn.onclick = () => toggleSkillDraftBtn(btn);
        container.appendChild(btn);
    });
    document.getElementById('skill-draft-confirm').disabled = true;
    document.getElementById('skill-draft-modal').style.display = 'flex';
}

function toggleSkillDraftBtn(btn) {
    const selected = document.querySelectorAll('#skill-draft-options .skill-draft-btn.selected');
    if (btn.classList.contains('selected')) {
        btn.classList.remove('selected');
    } else if (selected.length < 2) {
        btn.classList.add('selected');
    }
    const count = document.querySelectorAll('#skill-draft-options .skill-draft-btn.selected').length;
    document.getElementById('skill-draft-confirm').disabled = count < 1;
}

function confirmSkillDraft() {
    activeRuleIds = [...document.querySelectorAll('#skill-draft-options .skill-draft-btn.selected')]
        .map(btn => Number(btn.dataset.ruleId));
    document.getElementById('skill-draft-modal').style.display = 'none';
    document.getElementById('practice-modal').classList.add('active');
    renderPracticeWord();
}

function resetWordCardFields() {
    document.getElementById('p-word').style.visibility = 'visible';
    document.getElementById('p-sentence-row').style.display = '';
    document.getElementById('p-etymology-row').style.display = '';
    document.getElementById('p-morph-row').style.display = '';
    showAudioButtons(false, false);
}

function renderPracticeWord() {
    if (practiceQueue.length === 0) return endPractice();

    let found = false;
    for (let i = 0; i < practiceQueue.length; i++) {
        let idx = (currentPracticeIndex + i) % practiceQueue.length;
        if (practiceQueue[idx].successes < 3 && practiceQueue[idx].attempts < 5) {
            currentPracticeIndex = idx; found = true; break;
        }
    }

    if (!found) return endPractice();

    currentWordData = practiceQueue[currentPracticeIndex];

    document.getElementById('practice-word-card').style.backgroundColor = getPosColor(currentWordData.pos);
    updatePracticeProgress(currentWordData.successes, currentWordData.attempts);
    document.getElementById('p-word').textContent = currentWordData.word;
    document.getElementById('p-phonetic').textContent = currentWordData.phonetic;
    document.getElementById('p-pos').textContent = currentWordData.pos || 'N/A';
    document.getElementById('p-morph').textContent = currentWordData.morphological;
    document.getElementById('p-sentence').innerHTML = renderHighlightedSentence(currentWordData.sentence);
    document.getElementById('p-etymology').textContent = currentWordData.etymology;

    resetWordCardFields();
    dispatchQuestion(currentWordData);
}

function skipWord() {
    if (!currentWordData) return;
    currentWordData.attempts = 5;
    showToast(`已跳過：${currentWordData.word}`);
    moveToNextWord();
}

// ===== L1-A 詞塊填空 =====
let l1aSelectedChip = null;

function l1aSelectChip(btn, selected) {
    if (btn.disabled) return;
    document.querySelectorAll('.l1a-chip-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    l1aSelectedChip = selected;
    document.getElementById('l1a-submit-btn').disabled = false;
}

function l1aSubmit() {
    if (!l1aSelectedChip) return;
    const correct = currentWordData.word.toLowerCase();
    const fb = document.getElementById('l1a-feedback');
    document.querySelectorAll('.l1a-chip-btn').forEach(b => { b.disabled = true; });
    document.getElementById('l1a-submit-btn').disabled = true;
    if (l1aSelectedChip === correct) {
        currentWordData.successes++;
        currentWordData.attempts++;
        updateProgressDots('l1a-dots', currentWordData.successes);
        updatePracticeProgress(currentWordData.successes, currentWordData.attempts);
        document.getElementById('l1a-blank-sentence').textContent = currentWordData.sentence || '';
        fb.textContent = '正確！';
        fb.className = 'feedback-correct';
        speakText(currentWordData.sentence);
        setTimeout(() => startAutoAdvance('l1a-countdown'), 800);
    } else {
        currentWordData.attempts = 5;
        updatePracticeProgress(currentWordData.successes, currentWordData.attempts);
        fb.textContent = `錯誤，正確為：${currentWordData.word}`;
        fb.className = 'feedback-wrong';
        setTimeout(() => startAutoAdvance('l1a-countdown'), 1200);
    }
}

// ===== L1-S 唸出單字 =====
let l1sRecognition = null;
let l1sListening = false;
let l1sMediaRecorder = null;
let l1sAudioChunks = [];
let l1sLastAudioUrl = null;

function l1sToggleMic() {
    if (l1sListening) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert('抱歉，您的瀏覽器不支援語音辨識功能。');

    // 啟動 MediaRecorder 同步錄製（靜默失敗不影響主流程）
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            l1sAudioChunks = [];
            l1sMediaRecorder = new MediaRecorder(stream);
            l1sMediaRecorder.ondataavailable = e => { if (e.data.size > 0) l1sAudioChunks.push(e.data); };
            l1sMediaRecorder.onstop = () => {
                stream.getTracks().forEach(t => t.stop());
                const blob = new Blob(l1sAudioChunks, { type: 'audio/webm' });
                if (l1sLastAudioUrl) URL.revokeObjectURL(l1sLastAudioUrl);
                l1sLastAudioUrl = URL.createObjectURL(blob);
                const btn = document.getElementById('l1s-replay-btn');
                if (btn) btn.style.display = '';
            };
            l1sMediaRecorder.start();
        }).catch(() => {});
    }

    l1sRecognition = new SR();
    l1sRecognition.lang = 'en-US';
    l1sRecognition.interimResults = false;
    l1sRecognition.onstart = () => {
        l1sListening = true;
        document.getElementById('l1s-mic-btn').classList.add('listening');
        document.getElementById('l1s-feedback').textContent = '聆聽中...';
        document.getElementById('l1s-feedback').className = '';
    };
    l1sRecognition.onresult = (event) => {
        currentWordData.attempts++;
        const transcript = event.results[0][0].transcript;
        const spoken = transcript.toLowerCase().replace(/[^\w\s]/g, '');
        const target = currentWordData.word.toLowerCase().replace(/[^\w]/g, '');
        const fb = document.getElementById('l1s-feedback');
        if (spoken.includes(target)) {
            currentWordData.successes++;
            updateProgressDots('l1s-dots', currentWordData.successes);
            fb.textContent = `正確！辨識到：${transcript}`;
            fb.className = 'feedback-correct';
            document.getElementById('l1s-result-actions').style.display = 'none';
            startAutoAdvance('l1s-countdown');
        } else {
            fb.textContent = `辨識到：${transcript}`;
            fb.className = 'feedback-wrong';
            if (currentWordData.attempts >= 5) {
                startAutoAdvance('l1s-countdown');
            } else {
                document.getElementById('l1s-result-actions').style.display = 'flex';
            }
        }
        updatePracticeProgress(currentWordData.successes, currentWordData.attempts);
    };
    l1sRecognition.onerror = () => {
        document.getElementById('l1s-feedback').textContent = '未接收到語音，請重試';
        document.getElementById('l1s-feedback').className = 'feedback-wrong';
    };
    l1sRecognition.onend = () => {
        l1sListening = false;
        document.getElementById('l1s-mic-btn').classList.remove('listening');
        if (l1sMediaRecorder && l1sMediaRecorder.state === 'recording') l1sMediaRecorder.stop();
    };
    l1sRecognition.start();
}

function l1sPlayReplay() {
    if (l1sLastAudioUrl) new Audio(l1sLastAudioUrl).play();
}

function l1sRetry() {
    document.getElementById('l1s-result-actions').style.display = 'none';
    document.getElementById('l1s-feedback').textContent = '請點擊麥克風發音';
    document.getElementById('l1s-feedback').className = '';
    l1sToggleMic();
}

function startAutoAdvance(countdownId) {
    if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
    const countdown = document.getElementById(countdownId);
    const bar = countdown.querySelector('.countdown-bar');
    countdown.style.display = 'flex';
    bar.style.transition = 'none';
    bar.style.width = '100%';
    bar.offsetWidth;
    bar.style.transition = 'width 1.5s linear';
    bar.style.width = '0%';
    autoAdvanceTimer = setTimeout(() => { moveToNextWord(); }, 1500);
}

function cancelAutoAdvance(countdownId) {
    if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
    if (!countdownId) return;
    const countdown = document.getElementById(countdownId);
    if (countdown) countdown.style.display = 'none';
}

function updatePracticeProgress(successes, attempts) {
    const el = document.getElementById('practice-progress');
    if (!el) return;
    let html = '';
    for (let i = 0; i < 3; i++)
        html += `<span class="pp-dot${i < successes ? ' filled' : ''}"></span>`;
    html += '<span class="pp-sep">·</span>';
    const remaining = Math.max(0, 5 - attempts);
    for (let i = 0; i < 5; i++)
        html += `<span class="pp-heart${i < remaining ? ' filled' : ''}">♥</span>`;
    el.innerHTML = html;
}

function updateProgressDots(containerId, successes) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('span');
        dot.className = 'l1-dot' + (i < successes ? ' filled' : '');
        container.appendChild(dot);
    }
}

function moveToNextWord() { currentPracticeIndex = (currentPracticeIndex + 1) % practiceQueue.length; renderPracticeWord(); }

function endPractice() {
    deactivateCurrentQuestion();
    let tokensEarned = 0; let passedCount = 0;

    practiceQueue.forEach(item => {
        if (item.successes >= 3) {
            passedCount++; tokensEarned += 5;
            if (item.source === 'map') {
                const mapItem = grid.get(item.key);
                if (mapItem.level < 5) mapItem.level += 1;
                mapItem.levelUpdatedAt = Date.now();
                grid.set(item.key, mapItem);
            } else if (item.source === 'csv') {
                storageData.push({
                    word: item.word, level: item.level, pos: item.pos,
                    phonetic: item.phonetic, morphological: item.morphological,
                    sentence: item.sentence, etymology: item.etymology,
                    levelUpdatedAt: Date.now()
                });
            }
        } else if (item.attempts >= 5) {
            if (item.source === 'map') {
                const mapItem = grid.get(item.key);
                if (mapItem.level === 5) {
                    mapItem.level = 4;
                    mapItem.levelUpdatedAt = Date.now();
                    grid.set(item.key, mapItem);
                }
            } else if (item.source === 'csv') {
                const activeDs = getActiveDataset();
                if (!activeDs.words.find(w => w.word.toLowerCase() === item.word.toLowerCase())) {
                    activeDs.words.push({
                        word: item.word, phonetic: item.phonetic, pos: item.pos,
                        morphological: item.morphological, sentence: item.sentence, etymology: item.etymology
                    });
                }
            }
        }
    });

    if (tokensEarned > 0) updateTokens(tokensEarned);
    recordCheckIn();

    document.getElementById('practice-modal').classList.remove('active');
    updateStorageUI(); drawCanvas(); saveCurrentData();
    showToast(`練習結束！共 ${passedCount} 題過關，獲得 ${tokensEarned} 代幣`);
}

function generateL1AOptions(word) {
    const vowels = 'aeiou';
    const consonants = 'bcdfghjklmnpqrstvwxyz';
    const lower = word.toLowerCase();
    const distractors = new Set();
    let attempts = 0;
    while (distractors.size < 3 && attempts < 100) {
        attempts++;
        const letters = lower.split('');
        const eligible = letters.map((c, i) => (/[a-z]/.test(c) ? i : -1)).filter(i => i >= 0);
        if (!eligible.length) break;
        const idx = eligible[Math.floor(Math.random() * eligible.length)];
        const ch = letters[idx];
        const pool = (vowels.includes(ch) ? vowels : consonants).split('').filter(c => c !== ch);
        const replacement = pool[Math.floor(Math.random() * pool.length)];
        const distractor = letters.map((c, i) => (i === idx ? replacement : c)).join('');
        if (distractor !== lower) distractors.add(distractor);
    }
    return fisherYatesShuffle([lower, ...[...distractors].slice(0, 3)]);
}

function closeDebugModal() {
    document.getElementById('debug-modal').style.display = 'none';
}

function startDebugPractice(level, moduleIdx) {
    const baseWord = storageData.length > 0 ? storageData[0] : defaultWords[0];
    const testWord = { ...baseWord, level, source: 'debug', attempts: 0, successes: 0 };
    practiceQueue = [testWord];
    currentPracticeIndex = 0;
    practiceListeningDisabled = false;
    practiceSpeakingDisabled = false;
    document.getElementById('listening-disabled-notice').style.display = 'none';
    document.getElementById('speaking-disabled-notice').style.display = 'none';
    document.getElementById('practice-modal').classList.add('active');

    currentWordData = testWord;
    document.getElementById('practice-word-card').style.backgroundColor = getPosColor(testWord.pos);
    document.getElementById('practice-progress').textContent = `[DEV] L${level}-mod${moduleIdx} | ${testWord.word}`;
    document.getElementById('p-word').textContent = testWord.word;
    document.getElementById('p-phonetic').textContent = testWord.phonetic || '';
    document.getElementById('p-pos').textContent = testWord.pos || 'N/A';
    document.getElementById('p-morph').textContent = testWord.morphological || '';
    document.getElementById('p-sentence').innerHTML = renderHighlightedSentence(testWord.sentence);
    document.getElementById('p-etymology').textContent = testWord.etymology || '';

    if (activeDispatchModule) activeDispatchModule.deactivate();
    const pool = questionModules[level];
    if (pool && moduleIdx < pool.length) {
        activeDispatchModule = pool[moduleIdx];
        activeDispatchModule.activate(testWord);
    } else {
        showToast(`找不到模組 L${level}[${moduleIdx}]`);
    }
    closeDebugModal();
}

// L1-A: 詞塊填空
registerQuestionModule(1, {
    requiresListening: true,
    activate(wordData) {
        document.getElementById('p-sentence-row').style.display = 'none';
        document.getElementById('p-etymology-row').style.display = 'none';
        showAudioButtons(false, false);
        document.getElementById('p-word').style.visibility = 'hidden';
        document.getElementById('action-l1a').style.display = 'flex';
        document.getElementById('next-word-btn').style.display = 'none';
        document.getElementById('l1a-countdown').style.display = 'none';
        document.getElementById('l1a-feedback').textContent = '';
        document.getElementById('l1a-feedback').className = '';
        document.getElementById('l1a-submit-btn').disabled = true;
        l1aSelectedChip = null;
        updateProgressDots('l1a-dots', wordData.successes || 0);

        const sentence = wordData.sentence || '';
        const escapedWord = wordData.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const blankHtml = escapeHtml(sentence).replace(
            new RegExp(`(?<![\\w])${escapedWord}(?![\\w])`, 'gi'),
            '<span class="l1a-blank">___</span>'
        );
        document.getElementById('l1a-blank-sentence').innerHTML = blankHtml || escapeHtml(sentence);

        const chips = generateL1AOptions(wordData.word);
        const container = document.getElementById('l1a-chips');
        container.innerHTML = '';
        chips.forEach(w => {
            const btn = document.createElement('button');
            btn.className = 'l1a-option-btn l1a-chip-btn';
            btn.textContent = w;
            btn.dataset.word = w;
            btn.onclick = () => l1aSelectChip(btn, w);
            container.appendChild(btn);
        });

        speakText(sentence);
    },
    deactivate() {
        cancelAutoAdvance('l1a-countdown');
        document.getElementById('p-word').style.visibility = 'visible';
        document.getElementById('action-l1a').style.display = 'none';
    }
});

// L1-S: 唸出單字
registerQuestionModule(1, {
    requiresSpeaking: true,
    activate(wordData) {
        showAudioButtons(false, false);
        document.getElementById('p-word').style.visibility = 'visible';
        document.getElementById('p-sentence-row').style.display = 'none';
        document.getElementById('p-etymology-row').style.display = 'none';
        document.getElementById('action-l1s').style.display = 'flex';
        document.getElementById('next-word-btn').style.display = 'none';
        document.getElementById('l1s-countdown').style.display = 'none';
        document.getElementById('l1s-feedback').textContent = '請點擊麥克風發音';
        document.getElementById('l1s-feedback').className = '';
        document.getElementById('l1s-result-actions').style.display = 'none';
        document.getElementById('l1s-replay-btn').style.display = 'none';
        document.getElementById('l1s-phonetic').textContent = wordData.phonetic || '';
        l1sLastAudioUrl = null;
        updateProgressDots('l1s-dots', wordData.successes || 0);
        speakText(wordData.word);
    },
    deactivate() {
        cancelAutoAdvance('l1s-countdown');
        if (l1sRecognition) { try { l1sRecognition.abort(); } catch(e) {} l1sRecognition = null; }
        if (l1sMediaRecorder && l1sMediaRecorder.state === 'recording') {
            try { l1sMediaRecorder.stop(); } catch(e) {}
        }
        l1sListening = false;
        const micBtn = document.getElementById('l1s-mic-btn');
        if (micBtn) micBtn.classList.remove('listening');
        document.getElementById('p-sentence-row').style.display = '';
        document.getElementById('p-etymology-row').style.display = '';
        document.getElementById('action-l1s').style.display = 'none';
    }
});
