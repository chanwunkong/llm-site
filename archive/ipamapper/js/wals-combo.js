const WALS_COMBOS = {
    en: [
        { rules: [81, 87],  bonus: 3, name: 'SVO + 形容詞修飾' },
        { rules: [81, 38],  bonus: 3, name: 'SVO + 不定冠詞' },
        { rules: [66, 112], bonus: 3, name: '過去否定' },
        { rules: [67, 116], bonus: 3, name: '未來疑問' },
        { rules: [87, 89],  bonus: 3, name: '形容詞 + 數詞複合名詞組' }
    ],
    it: [
        { rules: [81, 37],  bonus: 3, name: 'SVO + 定冠詞' },
        { rules: [81, 87],  bonus: 3, name: 'SVO + 名詞後置形容詞' },
        { rules: [66, 112], bonus: 3, name: '過去否定' }
    ],
    ru: [
        { rules: [81, 87],  bonus: 3, name: 'SVO + 形容詞一致' },
        { rules: [26, 66],  bonus: 3, name: '格位 + 過去式' },
        { rules: [66, 112], bonus: 3, name: '過去否定' }
    ],
    zh: [
        { rules: [81, 66],  bonus: 3, name: 'SVO + 完成貌' },
        { rules: [81, 112], bonus: 3, name: 'SVO + 否定' },
        { rules: [87, 89],  bonus: 3, name: '形容詞修飾 + 量詞' }
    ],
    ja: [
        { rules: [82, 85],  bonus: 3, name: 'SOV + 格助詞' },
        { rules: [82, 66],  bonus: 3, name: 'SOV + 過去式' },
        { rules: [85, 112], bonus: 3, name: '格助詞 + 否定' }
    ]
};

function getComboBonus(satisfiedIds) {
    const lang = (voiceSettings && voiceSettings.langCode) || 'en';
    const combos = WALS_COMBOS[lang] || [];
    let bonus = 0;
    combos.forEach(combo => {
        if (combo.rules.every(r => satisfiedIds.includes(r))) bonus += combo.bonus;
    });
    return bonus;
}

function getComboName(satisfiedIds) {
    const lang = (voiceSettings && voiceSettings.langCode) || 'en';
    const combos = WALS_COMBOS[lang] || [];
    const hit = combos.find(c => c.rules.every(r => satisfiedIds.includes(r)));
    return hit ? hit.name : null;
}
