let passageSentences = [];
let passageUnknownSet = new Set();
let readingIndex = 0;
let readingBatchCount = 0;
let readingBatchUnknowns = new Set();

// English-only interim abbreviation list — prevents sentence splits on e.g. "Mr. Smith"
// TODO: replace with a multilingual sentence boundary detection approach
const ABBREVS = [
    'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr', 'St', 'Mt', 'Lt', 'Sgt', 'Cpl',
    'vs', 'etc', 'No', 'Fig', 'Dept', 'Est',
    'Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'
];

function parsePassage(text) {
    const PLACEHOLDER = '\x01';
    let safe = text;
    ABBREVS.forEach(a => {
        safe = safe.replace(new RegExp(`\\b${a}\\.`, 'g'), `${a}${PLACEHOLDER}`);
    });

    const sentences = safe
        .split(/[.!?]+\s+(?=[A-Z"'])/)
        .map(s => s.replace(new RegExp(PLACEHOLDER, 'g'), '.').trim())
        .filter(s => s.length > 2);
    if (!sentences.length) sentences.push(text.trim());

    const wordSet = new Set();
    sentences.forEach(s => {
        s.toLowerCase()
            .replace(/[^a-z\s']/g, ' ')
            .split(/\s+/)
            .map(w => w.replace(/^'+|'+$/g, ''))
            .filter(w => w.length > 1)
            .forEach(w => wordSet.add(w));
    });

    return { sentences, words: [...wordSet] };
}

function classifyPassageWords(words) {
    const knownSet = new Set();
    storageData.forEach(item => knownSet.add(item.word.toLowerCase().trim()));
    for (const [, item] of grid.entries()) knownSet.add(item.word.toLowerCase().trim());
    datasets.forEach(ds => ds.words.forEach(w => knownSet.add(w.word.toLowerCase().trim())));

    return {
        known: words.filter(w => knownSet.has(w)),
        unknown: words.filter(w => !knownSet.has(w))
    };
}

function savePassage() {
    if (!currentSaveId) return showToast('請先選擇存檔');
    const text = document.getElementById('passage-input').value.trim();
    if (!text) return showToast('請先貼入文章');

    passageText = text;
    const { sentences, words } = parsePassage(text);
    passageSentences = sentences;
    const { unknown } = classifyPassageWords(words);
    passageUnknownSet = new Set(unknown);

    saveCurrentData();
    showToast(`已儲存 ${sentences.length} 句，${unknown.length} 個陌生詞`);
}

function loadPassageFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const raw = e.target.result;
        let text;
        if (file.name.toLowerCase().endsWith('.csv')) {
            text = raw
                .split(/\r?\n/)
                .map(line => line.replace(/^"|"$/g, '').replace(/""/g, '"'))
                .filter(line => line.trim().length > 0)
                .join(' ');
        } else {
            text = raw;
        }
        document.getElementById('passage-input').value = text;
        document.getElementById('passage-file-input').value = '';
        savePassage();
    };
    reader.readAsText(file, 'UTF-8');
}

function makePassageChip(word) {
    const wrap = document.createElement('span');
    wrap.className = 'passage-word-wrap';
    const chip = document.createElement('span');
    chip.className = 'passage-word-chip passage-unknown';
    chip.textContent = word;
    const btn = document.createElement('button');
    btn.className = 'passage-add-btn';
    btn.textContent = '+';
    btn.onclick = () => addPassageWordToMap(word, () => wrap.remove());
    wrap.appendChild(chip);
    wrap.appendChild(btn);
    return wrap;
}

function addPassageWordToMap(word, onSuccess) {
    if (!currentSaveId) { showToast('請先選擇存檔'); return; }
    if (storageData.some(item => item.word.toLowerCase() === word.toLowerCase())) {
        showToast(`${word} 已在單字庫中`);
        passageUnknownSet.delete(word);
        onSuccess?.();
        return;
    }
    storageData.push({
        word,
        phonetic: '',
        pos: '',
        morphological: word,
        sentence: '',
        etymology: '',
        level: 1,
        levelUpdatedAt: Date.now()
    });
    passageUnknownSet.delete(word);
    updateStorageUI();
    saveCurrentData();
    showToast(`已加入：${word}`);
    onSuccess?.();
}

// === 朗讀模式 ===

function startReadingMode() {
    if (!currentSaveId) return showToast('請先選擇存檔');
    if (!passageSentences.length && passageText) {
        const { sentences, words } = parsePassage(passageText);
        passageSentences = sentences;
        const { unknown } = classifyPassageWords(words);
        passageUnknownSet = new Set(unknown);
    }
    if (!passageSentences.length) return showToast('請先在設定頁載入文章');

    readingIndex = 0;
    readingBatchCount = 0;
    readingBatchUnknowns = new Set();

    document.getElementById('view-vocabulary').classList.remove('active');
    document.getElementById('reading-view').classList.add('active');
    document.getElementById('rv-sentence-wrap').style.display = 'flex';
    document.getElementById('rv-controls').style.display = 'flex';
    document.getElementById('rv-interstitial').style.display = 'none';

    renderReadingSentence();
}

function renderReadingSentence() {
    if (readingIndex >= passageSentences.length) {
        if (readingBatchUnknowns.size > 0) {
            showReadingInterstitial([...readingBatchUnknowns]);
            readingBatchUnknowns = new Set();
        } else {
            endReadingMode();
            showToast('文章朗讀完畢');
        }
        return;
    }

    const sentence = passageSentences[readingIndex];
    document.getElementById('rv-progress').textContent =
        `${readingIndex + 1} / ${passageSentences.length}`;

    const html = sentence.split(/(\s+)/).map(token => {
        const clean = token.toLowerCase().replace(/[^a-z']/g, '');
        if (clean.length > 1 && passageUnknownSet.has(clean)) {
            return `<mark class="reading-unknown">${token}</mark>`;
        }
        return token;
    }).join('');
    document.getElementById('rv-sentence').innerHTML = html;
}

function readingSpeak() {
    if (readingIndex < passageSentences.length) speakText(passageSentences[readingIndex]);
}

function readingNext() {
    window.speechSynthesis.cancel();
    if (readingIndex < passageSentences.length) {
        passageSentences[readingIndex]
            .toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/)
            .map(w => w.replace(/^'+|'+$/g, ''))
            .filter(w => w.length > 1 && passageUnknownSet.has(w))
            .forEach(w => readingBatchUnknowns.add(w));
    }

    readingIndex++;
    readingBatchCount++;

    if (readingBatchCount >= 3 && readingBatchUnknowns.size > 0) {
        readingBatchCount = 0;
        showReadingInterstitial([...readingBatchUnknowns]);
        readingBatchUnknowns = new Set();
        return;
    }
    if (readingBatchCount >= 3) readingBatchCount = 0;

    renderReadingSentence();
}

function showReadingInterstitial(words) {
    document.getElementById('rv-sentence-wrap').style.display = 'none';
    document.getElementById('rv-controls').style.display = 'none';
    const interstitial = document.getElementById('rv-interstitial');
    interstitial.style.display = 'flex';
    const container = document.getElementById('rv-interstitial-words');
    container.innerHTML = '';
    words.forEach(w => container.appendChild(makePassageChip(w)));
}

function continueReading() {
    document.getElementById('rv-sentence-wrap').style.display = 'flex';
    document.getElementById('rv-controls').style.display = 'flex';
    document.getElementById('rv-interstitial').style.display = 'none';
    renderReadingSentence();
}

function endReadingMode() {
    window.speechSynthesis.cancel();
    document.getElementById('reading-view').classList.remove('active');
    document.getElementById('view-vocabulary').classList.add('active');
}
