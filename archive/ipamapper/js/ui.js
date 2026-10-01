function updateTokens(amount) {
    currentTokens += amount;
    globalTokenCount.textContent = currentTokens;
    renderGrammarRules();
    saveCurrentData();
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg; toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 1500);
}

function updateStreakUI() {
    if (!checkInHistory) checkInHistory = [];
    let streak = 0;
    const todayStr = new Date().toLocaleDateString('en-CA');
    let d = new Date();

    if (checkInHistory.includes(todayStr)) {
        streak = 1; d.setDate(d.getDate() - 1);
    } else {
        d.setDate(d.getDate() - 1);
        if (!checkInHistory.includes(d.toLocaleDateString('en-CA'))) {
            document.getElementById('streak-count').textContent = 0;
            return;
        }
    }

    while (true) {
        const dateStr = d.toLocaleDateString('en-CA');
        if (checkInHistory.includes(dateStr)) {
            streak++; d.setDate(d.getDate() - 1);
        } else { break; }
    }
    document.getElementById('streak-count').textContent = streak;
}

function recordCheckIn() {
    const todayStr = new Date().toLocaleDateString('en-CA');
    if (!checkInHistory.includes(todayStr)) {
        checkInHistory.push(todayStr);
        checkInHistory.sort();
        updateStreakUI();
        saveCurrentData();
    }
}

function openCalendarModal() {
    if (!currentSaveId) return showToast('請先建立存檔');
    document.getElementById('calendar-modal').classList.add('active');
    renderCalendar();
}

function closeCalendarModal() {
    document.getElementById('calendar-modal').classList.remove('active');
}

function renderCalendar() {
    const calGrid = document.getElementById('calendar-grid');
    const calMonth = document.getElementById('calendar-month');
    calGrid.innerHTML = '';

    const now = new Date();
    calMonth.textContent = now.getFullYear() + '年 ' + (now.getMonth() + 1) + '月';

    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const todayStr = now.toLocaleDateString('en-CA');

    const days = ['日', '一', '二', '三', '四', '五', '六'];
    days.forEach(d => {
        let el = document.createElement('div');
        el.className = 'cal-day-label'; el.textContent = d;
        calGrid.appendChild(el);
    });

    for (let i = 0; i < firstDay; i++) { calGrid.appendChild(document.createElement('div')); }

    for (let i = 1; i <= daysInMonth; i++) {
        let d = new Date(now.getFullYear(), now.getMonth(), i);
        let dStr = d.toLocaleDateString('en-CA');

        let el = document.createElement('div');
        el.className = 'cal-day';
        el.textContent = i;
        if (checkInHistory.includes(dStr)) el.classList.add('checked');
        if (dStr === todayStr) el.classList.add('today');

        calGrid.appendChild(el);
    }
}

function updateStorageUI() {
    const storageArea = document.getElementById('storage-area');
    storageArea.innerHTML = '';
    storageData.forEach(item => {
        const div = document.createElement('div');
        div.className = 'storage-item'; div.textContent = item.word;
        div.style.backgroundColor = getPosColor(item.pos);
        storageArea.appendChild(div);
    });
}
