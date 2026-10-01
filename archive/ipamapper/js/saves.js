function renderSaveSlots() {
    const container = document.getElementById('save-slot-list');
    container.innerHTML = '';

    if (appSaves.length === 0) {
        container.innerHTML = '<div style="font-size:14px; color:var(--text-secondary);">尚無存檔，請在上方新增存檔以開始練習。</div>';
        return;
    }

    appSaves.forEach(save => {
        const div = document.createElement('div');
        div.className = 'dataset-item';
        const isChecked = save.id === currentSaveId ? 'checked' : '';
        div.innerHTML = `
            <label>
                <input type="radio" name="activeSaveRadio" value="${save.id}" ${isChecked}>
                ${save.name}
            </label>
            <button class="action-btn btn-delete" onclick="deleteSave('${save.id}')">刪除</button>
        `;
        div.querySelector('input').addEventListener('change', (e) => {
            if (e.target.checked && currentSaveId !== save.id) {
                switchSave(save.id);
            }
        });
        container.appendChild(div);
    });
}

document.getElementById('add-save-btn').addEventListener('click', async () => {
    const input = document.getElementById('new-save-input');
    const name = input.value.trim();
    if (!name) return showToast('請輸入存檔名稱');

    const newSaveId = 'save_' + Date.now();
    appSaves.push({ id: newSaveId, name: name });
    input.value = '';

    if (appSaves.length === 1) {
        await switchSave(newSaveId);
    } else {
        renderSaveSlots();
        await saveGlobalMetadata();
    }
    showToast(`已新增存檔：${name}`);
});

async function switchSave(targetSaveId) {
    if (currentSaveId) {
        await saveCurrentData();
    }

    currentSaveId = targetSaveId;
    renderSaveSlots();
    await saveGlobalMetadata();

    resetBoardData();
    await loadSpecificSave(targetSaveId);
    showToast('存檔已切換');
}

window.deleteSave = async function (id) {
    if (confirm('確定要刪除此存檔嗎？所有進度將無法恢復。')) {
        appSaves = appSaves.filter(s => s.id !== id);

        if (currentSaveId === id) {
            currentSaveId = null;
            resetBoardData();
        }
        renderSaveSlots();
        await saveGlobalMetadata();

        if (auth.currentUser) {
            db.collection('users').doc(auth.currentUser.uid).collection('hexagonApp').doc(id).delete();
        } else {
            localStorage.removeItem(`hex_save_${id}`);
        }
    }
};

function resetBoardData() {
    grid.clear();
    storageData.length = 0;
    datasets = [];
    activeDatasetId = '';
    usedIndices = {};
    currentTokens = 0;
    checkInHistory = [];
    unlockedRules = [];
    ruleHitCounts = {};
    voiceSettings = { voiceURI: '', lang: 'en-US', langCode: 'en' };
    passageText = '';

    applyVoiceSettings();
    updateStorageUI();
    drawCanvas();
    globalTokenCount.textContent = currentTokens;
    document.getElementById('dataset-list').innerHTML = '';
    renderGrammarRules();
}
