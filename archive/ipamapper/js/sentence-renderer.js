function buildWordPosMap() {
    const map = new Map();
    const add = (word, pos) => {
        if (word && pos) map.set(word.toLowerCase().trim(), pos);
    };
    datasets.forEach(ds => ds.words.forEach(w => add(w.word, w.pos)));
    storageData.forEach(item => add(item.word, item.pos));
    for (let [, item] of grid.entries()) add(item.word, item.pos);
    return map;
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderHighlightedSentence(sentence) {
    if (!sentence) return '';
    const map = buildWordPosMap();
    if (map.size === 0) return escapeHtml(sentence);

    const sortedKeys = [...map.keys()].sort((a, b) => b.length - a.length);
    const lower = sentence.toLowerCase();
    let result = '';
    let i = 0;

    while (i < sentence.length) {
        let matched = false;
        if (i === 0 || !/\w/.test(sentence[i - 1])) {
            for (const key of sortedKeys) {
                const keyLen = key.length;
                if (i + keyLen > sentence.length) continue;
                if (lower.slice(i, i + keyLen) !== key) continue;
                const afterChar = sentence[i + keyLen];
                if (afterChar && /\w/.test(afterChar)) continue;
                const color = getPosColor(map.get(key));
                const original = sentence.slice(i, i + keyLen);
                result += `<span style="background-color:${color}; border-radius:4px; padding:0 3px;">${escapeHtml(original)}</span>`;
                i += keyLen;
                matched = true;
                break;
            }
        }
        if (!matched) {
            result += escapeHtml(sentence[i]);
            i++;
        }
    }
    return result;
}
