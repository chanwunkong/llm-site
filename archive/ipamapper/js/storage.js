async function saveGlobalMetadata() {
    const metadata = { saves: appSaves, currentSaveId: currentSaveId };
    if (auth.currentUser) {
        try {
            await db.collection('users').doc(auth.currentUser.uid).collection('hexagonApp').doc('metadata').set(metadata);
        } catch(e) { console.error(e); }
    } else {
        localStorage.setItem('hex_metadata', JSON.stringify(metadata));
    }
}

async function saveCurrentData() {
    if (!currentSaveId) return;
    const data = exportGameData();
    if (auth.currentUser) {
        try {
            await db.collection('users').doc(auth.currentUser.uid).collection('hexagonApp').doc(currentSaveId).set(data);
            syncStatus.textContent = `最後同步時間: ${new Date().toLocaleTimeString()}`;
        } catch (e) {
            console.error("Sync error:", e);
            syncStatus.textContent = "同步失敗，請檢查網路";
        }
    } else {
        localStorage.setItem(`hex_save_${currentSaveId}`, JSON.stringify(data));
    }
}

async function loadMetadata() {
    if (auth.currentUser) {
        try {
            const doc = await db.collection('users').doc(auth.currentUser.uid).collection('hexagonApp').doc('metadata').get();
            if (doc.exists) {
                const data = doc.data();
                appSaves = data.saves || [];
                currentSaveId = data.currentSaveId || null;
            } else {
                appSaves = []; currentSaveId = null;
            }
        } catch (e) { console.error("Load metadata error:", e); }
    } else {
        const meta = JSON.parse(localStorage.getItem('hex_metadata') || 'null');
        if (meta) {
            appSaves = meta.saves || [];
            currentSaveId = meta.currentSaveId || null;
        } else {
            appSaves = []; currentSaveId = null;
        }
    }

    renderSaveSlots();
    if (currentSaveId) {
        await loadSpecificSave(currentSaveId);
    } else {
        resetBoardData();
    }
}

async function loadSpecificSave(id) {
    if (auth.currentUser) {
        try {
            const doc = await db.collection('users').doc(auth.currentUser.uid).collection('hexagonApp').doc(id).get();
            if (doc.exists) {
                importGameData(doc.data());
                showToast("已載入雲端存檔");
            } else {
                initDatasets();
                await saveCurrentData();
            }
        } catch (e) { console.error("Load save error:", e); }
    } else {
        const data = JSON.parse(localStorage.getItem(`hex_save_${id}`) || 'null');
        if (data) {
            importGameData(data);
            showToast("已載入本機存檔");
        } else {
            initDatasets();
            saveCurrentData();
        }
    }
}

function exportGameData() {
    const gridArray = [];
    for (let [key, item] of grid.entries()) {
        const [q, r] = key.split(',').map(Number);
        gridArray.push({ ...item, q, r });
    }
    return {
        tokens: currentTokens,
        grid: gridArray,
        storage: storageData,
        datasets: datasets,
        activeDatasetId: activeDatasetId,
        usedIndices: usedIndices,
        checkInHistory: checkInHistory,
        unlockedRules: unlockedRules,
        ruleHitCounts: ruleHitCounts,
        voiceSettings: voiceSettings,
        passageText: passageText
    };
}

function importGameData(data) {
    currentTokens = data.tokens !== undefined ? data.tokens : 100;
    datasets = (data.datasets && data.datasets.length > 0) ? data.datasets : [];
    if (data.activeDatasetId) activeDatasetId = data.activeDatasetId;
    if (data.usedIndices) usedIndices = data.usedIndices;
    checkInHistory = data.checkInHistory || [];
    unlockedRules = data.unlockedRules || [];
    ruleHitCounts = data.ruleHitCounts || {};
    voiceSettings = data.voiceSettings || { voiceURI: '', lang: 'en-US', langCode: 'en' };
    if (!voiceSettings.langCode) voiceSettings.langCode = 'en';
    passageText = data.passageText || '';
    const ta = document.getElementById('passage-input');
    if (ta) ta.value = passageText;

    storageData.length = 0;
    if (data.storage) data.storage.forEach(item => storageData.push(item));

    grid.clear();
    if (data.grid) {
        data.grid.forEach(item => { grid.set(`${item.q},${item.r}`, item); });
    }

    if (datasets.length === 0) {
        initDatasets();
    } else {
        renderDatasets();
        updateStreakUI();
    }

    globalTokenCount.textContent = currentTokens;
    renderGrammarRules();
    updateStorageUI();
    drawCanvas();
    applyVoiceSettings();
}
