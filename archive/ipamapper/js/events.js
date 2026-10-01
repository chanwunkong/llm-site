let isDragging = false, dragMoved = false, initialPinchDist = null, initialZoom = 1;
let startPos = { x: 0, y: 0 }, lastPos = { x: 0, y: 0 };
let selectedHexKey = null;

function getPinchDist(e) { return Math.sqrt(Math.pow(e.touches[0].clientX - e.touches[1].clientX, 2) + Math.pow(e.touches[0].clientY - e.touches[1].clientY, 2)); }
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); if (e.touches.length === 1) { isDragging = true; dragMoved = false; startPos = { x: e.touches[0].clientX, y: e.touches[0].clientY }; lastPos = { x: e.touches[0].clientX, y: e.touches[0].clientY }; } else if (e.touches.length === 2) { isDragging = false; initialPinchDist = getPinchDist(e); initialZoom = camera.zoom; } }, { passive: false });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); if (isDragging && e.touches.length === 1) { const dx = e.touches[0].clientX - lastPos.x, dy = e.touches[0].clientY - lastPos.y; if (Math.abs(e.touches[0].clientX - startPos.x) > 5 || Math.abs(e.touches[0].clientY - startPos.y) > 5) dragMoved = true; camera.x += dx; camera.y += dy; lastPos = { x: e.touches[0].clientX, y: e.touches[0].clientY }; drawCanvas(); } else if (e.touches.length === 2 && initialPinchDist) { camera.zoom = Math.min(Math.max(initialZoom * (getPinchDist(e) / initialPinchDist), 0.5), 3); drawCanvas(); } }, { passive: false });
canvas.addEventListener('touchend', (e) => { e.preventDefault(); if (isDragging && !dragMoved && e.changedTouches.length === 1) handleCanvasClick(e.changedTouches[0].clientX, e.changedTouches[0].clientY); isDragging = false; initialPinchDist = null; });
canvas.addEventListener('mousedown', (e) => { isDragging = true; dragMoved = false; startPos = { x: e.clientX, y: e.clientY }; lastPos = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('mousemove', (e) => { if (!isDragging) return; const dx = e.clientX - lastPos.x, dy = e.clientY - lastPos.y; if (Math.abs(e.clientX - startPos.x) > 5 || Math.abs(e.clientY - startPos.y) > 5) dragMoved = true; camera.x += dx; camera.y += dy; lastPos = { x: e.clientX, y: e.clientY }; drawCanvas(); });
canvas.addEventListener('mouseup', (e) => { if (isDragging && !dragMoved) handleCanvasClick(e.clientX, e.clientY); isDragging = false; });
canvas.addEventListener('wheel', (e) => { e.preventDefault(); camera.zoom = Math.min(Math.max(camera.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.5), 3); drawCanvas(); }, { passive: false });

function handleCanvasClick(clientX, clientY) {
    if (!currentSaveId) return showToast('請先至設定頁面新增或選擇存檔');
    const rect = canvas.getBoundingClientRect();
    const axial = pixelToAxial((clientX - rect.left - camera.x) / camera.zoom, (clientY - rect.top - camera.y) / camera.zoom);
    const key = `${axial.q},${axial.r}`;

    if (grid.has(key)) {
        // 點擊既有方塊：朗讀並顯示互動面板
        selectedHexKey = key;
        speakText(grid.get(key).word);
        showHexWordPanel(grid.get(key));
    } else {
        // 點擊空地：放置單字
        closeHexWordPanel();
        if (storageData.length === 0) return showToast('無可用單字');
        if (grid.size > 0 && !hasAdjacent(axial.q, axial.r)) return showToast('必須放置於相鄰位置');
        const newItem = storageData.shift();
        newItem.levelUpdatedAt = Date.now();
        grid.set(key, newItem);
        updateStorageUI(); drawCanvas(); saveCurrentData();
    }
}

function showHexWordPanel(item) {
    document.getElementById('hwp-word').textContent = item.word;
    document.getElementById('hwp-phonetic').textContent = item.phonetic || '';
    document.getElementById('hwp-pos').textContent = item.pos || '';
    document.getElementById('hwp-level').textContent = `Lv.${item.level}`;
    document.getElementById('hex-word-panel').classList.add('active');
}

function closeHexWordPanel() {
    selectedHexKey = null;
    document.getElementById('hex-word-panel').classList.remove('active');
}

function retrieveCurrentHexWord() {
    if (!selectedHexKey || !grid.has(selectedHexKey)) return closeHexWordPanel();
    const [q, r] = selectedHexKey.split(',').map(Number);
    if (!isConnectedAfterRemoval(q, r)) return showToast('移除此方塊會造成斷裂');
    if (storageData.length >= 5) return showToast('存放區已滿，無法收回單字');
    storageData.push(grid.get(selectedHexKey));
    grid.delete(selectedHexKey);
    closeHexWordPanel();
    updateStorageUI(); drawCanvas(); saveCurrentData();
}

document.querySelectorAll('.nav-tab[data-target]').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        tab.classList.add('active'); document.getElementById(tab.dataset.target).classList.add('active');
        if (tab.dataset.target === 'view-vocabulary') resizeCanvas();
    });
});

window.addEventListener('resize', resizeCanvas);
