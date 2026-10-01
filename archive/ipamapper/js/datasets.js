const VALID_POS_PREFIXES = ['noun', 'pronoun', 'verb', 'auxiliary', 'adjective', 'adverb', 'article', 'numeral', 'negation', 'preposition', 'conjunction', 'interjection', 'particle'];

function isValidPos(pos) {
    if (!pos) return false;
    const lower = pos.toLowerCase();
    return VALID_POS_PREFIXES.some(p => lower === p || lower.startsWith(p + '.'));
}

function getActiveDataset() {
    return datasets.find(d => d.id === activeDatasetId);
}

function initDatasets() {
    const defaultDs = { id: 'default', name: '預設單字庫 Lesson 1', words: defaultWords };
    datasets.push(defaultDs);
    activeDatasetId = 'default';
    usedIndices['default'] = 0;

    for (let i = 0; i < 5; i++) {
        if (usedIndices['default'] < defaultDs.words.length) {
            storageData.push({
                ...defaultDs.words[usedIndices['default']],
                level: 1,
                levelUpdatedAt: Date.now()
            });
            usedIndices['default']++;
        }
    }
    renderDatasets();
    updateStreakUI();
    saveCurrentData();
}

function renderDatasets() {
    const container = document.getElementById('dataset-list');
    container.innerHTML = '';
    datasets.forEach(ds => {
        const div = document.createElement('div');
        div.className = 'dataset-item';
        const isChecked = ds.id === activeDatasetId ? 'checked' : '';
        div.innerHTML = `
            <label>
                <input type="radio" name="activeDsRadio" value="${ds.id}" ${isChecked}>
                ${ds.name} <span style="color:#8e8e93; font-weight:normal; font-size:12px;">(${ds.words.length} 字)</span>
            </label>
            ${ds.id !== 'default' ? `<button class="action-btn btn-delete" onclick="deleteDataset('${ds.id}')">刪除</button>` : ''}
        `;
        div.querySelector('input').addEventListener('change', (e) => {
            if (e.target.checked) {
                activeDatasetId = ds.id;
                if (usedIndices[ds.id] === undefined) usedIndices[ds.id] = 0;
                saveCurrentData();
                showToast(`已切換至單字庫: ${ds.name}`);
            }
        });
        container.appendChild(div);
    });
}

window.deleteDataset = function (id) {
    if (confirm('確定要刪除此單字庫嗎？地圖上的單字不受影響。')) {
        datasets = datasets.filter(d => d.id !== id);
        delete usedIndices[id];
        if (activeDatasetId === id) activeDatasetId = 'default';
        saveCurrentData();
        renderDatasets();
    }
};

function parseCSVLine(text) {
    let ret = [], inQuote = false, value = '';
    for (let i = 0; i < text.length; i++) {
        let char = text[i];
        if (inQuote) {
            if (char === '"') {
                if (text[i + 1] === '"') { value += '"'; i++; } else { inQuote = false; }
            } else { value += char; }
        } else {
            if (char === '"') { inQuote = true; }
            else if (char === ',') { ret.push(value.trim()); value = ''; }
            else { value += char; }
        }
    }
    ret.push(value.trim());
    return ret;
}

const csvUpload = document.getElementById('csvUpload');
let pendingCSVText = '';
let pendingFileName = '';
csvUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        pendingFileName = file.name;
        document.getElementById('csv-filename').textContent = `已選取: ${file.name}`;
        const reader = new FileReader();
        reader.onload = (evt) => { pendingCSVText = evt.target.result; };
        reader.readAsText(file);
    }
});

function importCSVText(text, filename) {
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length < 2) { showToast('CSV 格式錯誤'); return; }

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    const wordIdx = headers.findIndex(h => h === 'word');
    const phoneticIdx = headers.findIndex(h => h === 'phonetic');
    const posIdx = headers.findIndex(h => h === 'pos');
    const morphIdx = headers.findIndex(h => h.includes('morphological'));
    const sentIdx = headers.findIndex(h => h.includes('sentence'));
    const etymIdx = headers.findIndex(h => h.includes('etymology'));

    if (wordIdx === -1) { showToast('缺少 Word 欄位'); return; }
    if (posIdx === -1) { showToast('缺少 POS 欄位，請確認 CSV 標頭含有 "POS" 欄位'); return; }

    const newWords = [];
    const invalidPosWords = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length > wordIdx && cols[wordIdx]) {
            const posVal = posIdx !== -1 ? cols[posIdx] : '';
            if (!isValidPos(posVal)) invalidPosWords.push(`${cols[wordIdx]}(${posVal || '空白'})`);
            newWords.push({
                word: cols[wordIdx],
                phonetic: phoneticIdx !== -1 ? cols[phoneticIdx] : '',
                pos: posVal || 'noun',
                morphological: morphIdx !== -1 ? cols[morphIdx] : '',
                sentence: sentIdx !== -1 ? cols[sentIdx] : '',
                etymology: etymIdx !== -1 ? cols[etymIdx] : ''
            });
        }
    }
    if (invalidPosWords.length > 0) {
        showToast(`警告：${invalidPosWords.length} 筆 POS 不符規範：${invalidPosWords.slice(0, 3).join('、')}${invalidPosWords.length > 3 ? '...' : ''}`);
    }

    if (newWords.length > 0) {
        const dsId = 'ds_' + Date.now();
        datasets.push({ id: dsId, name: filename, words: newWords });
        activeDatasetId = dsId;
        usedIndices[dsId] = 0;
        saveCurrentData();
        renderDatasets();
        showToast(`成功匯入 ${newWords.length} 個單字！`);
    }
}

document.getElementById('importCsvBtn').addEventListener('click', () => {
    if (!currentSaveId) return showToast('請先新增並選擇一個存檔');
    if (!pendingCSVText) return showToast('請先選擇 CSV 檔案');
    importCSVText(pendingCSVText, pendingFileName);
    pendingCSVText = ''; csvUpload.value = '';
    document.getElementById('csv-filename').textContent = '尚未選擇檔案';
});

async function loadLesson1CSV() {
    if (!currentSaveId) return showToast('請先建立並選擇存檔');
    if (datasets.find(d => d.name === 'Lesson1.csv')) return showToast('預設題庫已載入');
    try {
        const resp = await fetch('./Lesson1.csv');
        if (!resp.ok) throw new Error('not found');
        const text = await resp.text();
        importCSVText(text, 'Lesson1.csv');
    } catch (e) {
        showToast('載入失敗，請確認 Lesson1.csv 存在於相同目錄');
    }
}
