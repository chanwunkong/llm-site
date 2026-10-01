const UNLOCK_COST = 10;

function getCurrentLang() { return (voiceSettings && voiceSettings.langCode) || 'en'; }

// rulesA1 is a computed reference — always reflects the active language
Object.defineProperty(window, 'rulesA1', { get() { return WALS_RULES[getCurrentLang()].rules; }, configurable: true });

function isRuleUnlocked(ruleId) { return unlockedRules.includes(ruleId); }

function unlockRule(ruleId, ruleName) {
    if (isRuleUnlocked(ruleId)) return;
    if (!currentSaveId) return showToast('請先建立並選擇存檔');

    if (currentTokens >= UNLOCK_COST) {
        unlockedRules.push(ruleId);
        updateTokens(-UNLOCK_COST);
        showToast(`解鎖成功：${ruleName}`);
    } else {
        showToast('代幣不足');
    }
}

function checkWalsRule(ruleId, tokens) {
    return WALS_RULES[getCurrentLang()].check(ruleId, tokens);
}


function showRuleDetail(rule) {
    document.getElementById('rd-wals-id').textContent = `WALS ${rule.id}`;
    document.getElementById('rd-name').textContent = rule.name;
    document.getElementById('rd-desc').textContent = (WALS_RULES[getCurrentLang()].descriptions || {})[rule.id] || '';
    const tagsEl = document.getElementById('rd-pos-tags');
    tagsEl.innerHTML = '';
    if (rule.posTypes && rule.posTypes.length) {
        rule.posTypes.forEach(p => {
            const tag = document.createElement('span');
            tag.className = 'rule-detail-pos-tag';
            tag.textContent = p;
            tagsEl.appendChild(tag);
        });
        document.getElementById('rd-pos-section').style.display = 'flex';
    } else {
        document.getElementById('rd-pos-section').style.display = 'none';
    }
    const modal = document.getElementById('rule-detail-modal');
    modal.style.display = 'flex';
}

function closeRuleDetail() {
    document.getElementById('rule-detail-modal').style.display = 'none';
}

function renderGrammarRules() {
    const container = document.getElementById('rule-list'); container.innerHTML = '';
    rulesA1.forEach(rule => {
        const unlocked = isRuleUnlocked(rule.id), canAfford = currentTokens >= UNLOCK_COST;
        const card = document.createElement('div'); card.className = `rule-card ${unlocked ? '' : 'locked'}`;
        const hits = ruleHitCounts[rule.id] || 0;
        const hitsHtml = unlocked && hits > 0 ? `<div class="rule-hits">已觸發 ${hits} 次</div>` : '';
        card.innerHTML = `<div class="rule-info"><div class="rule-id">WALS ${rule.id}</div><div class="rule-name">${rule.name}</div>${hitsHtml}</div>`;
        const btnDiv = document.createElement('button');
        if (unlocked) { btnDiv.className = 'action-btn btn-view'; btnDiv.textContent = '查看'; btnDiv.onclick = () => showRuleDetail(rule); }
        else { btnDiv.className = canAfford ? 'action-btn btn-unlock' : 'action-btn btn-disabled'; btnDiv.textContent = `解鎖 (${UNLOCK_COST})`; btnDiv.onclick = () => canAfford ? unlockRule(rule.id, rule.name) : showToast('代幣不足'); }
        card.appendChild(btnDiv); container.appendChild(card);
    });
}
