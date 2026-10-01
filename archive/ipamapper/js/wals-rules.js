// Shared POS-check helpers
function _hasPos(tokens, prefix) {
    return tokens.some(t => t.pos === prefix || (t.pos && t.pos.startsWith(prefix + '.')));
}
function _adjBeforeN(tokens) {
    for (let i = 0; i < tokens.length - 1; i++) {
        if (!tokens[i].pos) continue;
        if (tokens[i].pos === 'adjective' || tokens[i].pos.startsWith('adjective.')) {
            for (let j = i + 1; j < tokens.length; j++) {
                if (tokens[j].pos === 'noun' || (tokens[j].pos && tokens[j].pos.startsWith('noun.'))) return true;
            }
        }
    }
    return false;
}
function _nBeforeAdj(tokens) {
    for (let i = 0; i < tokens.length - 1; i++) {
        if (!tokens[i].pos) continue;
        if (tokens[i].pos === 'noun' || tokens[i].pos.startsWith('noun.')) {
            for (let j = i + 1; j < tokens.length; j++) {
                if (tokens[j].pos === 'adjective' || (tokens[j].pos && tokens[j].pos.startsWith('adjective.'))) return true;
            }
        }
    }
    return false;
}
function _demBeforeN(tokens) {
    for (let i = 0; i < tokens.length - 1; i++) {
        if (tokens[i].pos !== 'pronoun.demonstrative') continue;
        for (let j = i + 1; j < tokens.length; j++) {
            if (tokens[j].pos === 'noun' || (tokens[j].pos && tokens[j].pos.startsWith('noun.'))) return true;
        }
    }
    return false;
}
function _numBeforeN(tokens) {
    for (let i = 0; i < tokens.length - 1; i++) {
        if (!tokens[i].pos) continue;
        if (tokens[i].pos === 'numeral' || tokens[i].pos.startsWith('numeral.') ||
            tokens[i].pos === 'classifier' || tokens[i].pos.startsWith('classifier.')) {
            for (let j = i + 1; j < tokens.length; j++) {
                if (tokens[j].pos === 'noun' || (tokens[j].pos && tokens[j].pos.startsWith('noun.'))) return true;
            }
        }
    }
    return false;
}
function _svoCheck(tokens) {
    let sIdx = -1, vIdx = -1, oIdx = -1;
    for (let i = 0; i < tokens.length; i++) {
        const p = tokens[i].pos;
        if (!p) continue;
        if (sIdx === -1 && (p.startsWith('pronoun.personal') || p === 'noun' || p.startsWith('noun.'))) { sIdx = i; }
        else if (sIdx !== -1 && vIdx === -1 && (p === 'verb' || p.startsWith('verb.') || p === 'auxiliary' || p.startsWith('auxiliary.'))) { vIdx = i; }
        else if (vIdx !== -1 && oIdx === -1 && (p === 'noun' || p.startsWith('noun.') || p.startsWith('pronoun.'))) { oIdx = i; }
    }
    return sIdx !== -1 && vIdx !== -1 && oIdx !== -1;
}
function _sovCheck(tokens) {
    let sIdx = -1, oIdx = -1, vIdx = -1;
    for (let i = 0; i < tokens.length; i++) {
        const p = tokens[i].pos;
        if (!p) continue;
        if (sIdx === -1 && (p.startsWith('pronoun.personal') || p === 'noun' || p.startsWith('noun.'))) { sIdx = i; }
        else if (sIdx !== -1 && oIdx === -1 && (p === 'noun' || p.startsWith('noun.') || p.startsWith('pronoun.'))) { oIdx = i; }
        else if (oIdx !== -1 && vIdx === -1 && (p === 'verb' || p.startsWith('verb.'))) { vIdx = i; }
    }
    return sIdx !== -1 && oIdx !== -1 && vIdx !== -1;
}
function _morphCheck(tokens) {
    return tokens.some(t => t.morphological && t.morphological.includes('/'));
}

const WALS_RULES = {
    en: {
        rules: [
            { id: 81,  name: '核心語序',    posTypes: ['pronoun.personal', 'noun', 'verb', 'auxiliary'] },
            { id: 87,  name: '形容詞前置',  posTypes: ['adjective', 'noun'] },
            { id: 88,  name: '指示詞前置',  posTypes: ['pronoun.demonstrative', 'noun'] },
            { id: 89,  name: '數詞前置',    posTypes: ['numeral', 'noun'] },
            { id: 26,  name: '綴詞傾向',    posTypes: [] },
            { id: 33,  name: '複數標記',    posTypes: ['noun'] },
            { id: 37,  name: '定冠詞',      posTypes: ['article.definite'] },
            { id: 38,  name: '不定冠詞',    posTypes: ['article.indefinite'] },
            { id: 66,  name: '過去式',      posTypes: ['verb.past'] },
            { id: 67,  name: '未來式',      posTypes: ['auxiliary.future', 'verb.future'] },
            { id: 112, name: '否定詞',      posTypes: ['negation'] },
            { id: 116, name: '是非問句',    posTypes: ['auxiliary'] }
        ],
        descriptions: {
            81:  'SVO 語序：句子依主詞 → 動詞 → 受詞排列，涵蓋人稱代詞、名詞、動詞與助動詞。',
            87:  '形容詞位於名詞之前（ADJ + N），描述名詞性質。',
            88:  '指示詞位於名詞之前（DEM + N），如 this / that 後接名詞。',
            89:  '數詞位於名詞之前（NUM + N），如 two apples。',
            26:  '以詞綴（前綴或後綴）標記語法關係，如複數、時態、格位。',
            33:  '以詞綴標記名詞複數形式，形態欄需含斜線分隔的複數形。',
            37:  '使用定冠詞（article.definite），如英語的 the。',
            38:  '使用不定冠詞（article.indefinite），如英語的 a / an。',
            66:  '包含過去式動詞（verb.past），表達已發生的事件。',
            67:  '包含未來式助動詞或動詞（auxiliary.future / verb.future），表達將發生的事件。',
            112: '句中含否定詞（negation），用以表達否定意涵。',
            116: '是非問句以助動詞開頭（auxiliary 置於句首），如 Do / Is / Can 等起首。'
        },
        check(id, tokens) {
            switch (id) {
                case 37:  return _hasPos(tokens, 'article.definite');
                case 38:  return _hasPos(tokens, 'article.indefinite');
                case 66:  return _hasPos(tokens, 'verb.past');
                case 67:  return _hasPos(tokens, 'auxiliary.future') || _hasPos(tokens, 'verb.future');
                case 112: return _hasPos(tokens, 'negation');
                case 116: return tokens.length > 0 && (tokens[0].pos === 'auxiliary' || (tokens[0].pos && tokens[0].pos.startsWith('auxiliary.')));
                case 87:  return _adjBeforeN(tokens);
                case 88:  return _demBeforeN(tokens);
                case 89:  return _numBeforeN(tokens);
                case 81:  return _svoCheck(tokens);
                case 26:
                case 33:  return _morphCheck(tokens);
                default:  return false;
            }
        }
    },
    it: {
        rules: [
            { id: 81,  name: '核心語序 (SVO)', posTypes: ['pronoun.personal', 'noun', 'verb'] },
            { id: 87,  name: '名詞後置形容詞', posTypes: ['noun', 'adjective'] },
            { id: 33,  name: '複數標記',       posTypes: ['noun'] },
            { id: 37,  name: '定冠詞',         posTypes: ['article.definite'] },
            { id: 38,  name: '不定冠詞',       posTypes: ['article.indefinite'] },
            { id: 66,  name: '過去式',         posTypes: ['verb.past'] },
            { id: 67,  name: '未來式',         posTypes: ['verb.future'] },
            { id: 112, name: '否定詞 (non)',    posTypes: ['negation'] }
        ],
        descriptions: {
            81:  'SVO 語序：義大利語預設語序為主詞 → 動詞 → 受詞。',
            87:  '名詞後置形容詞（N + ADJ）：義大利語形容詞通常緊跟名詞之後，如 "una casa bella"。',
            33:  '複數標記：名詞以詞尾變化（-o/-a → -i/-e）標記複數。',
            37:  '定冠詞（il / la / l\' / i / le / gli）與名詞搭配。',
            38:  '不定冠詞（un / una / un\' / uno）與名詞搭配。',
            66:  '包含過去式動詞（passato prossimo）：助動詞 avere/essere + 過去分詞。',
            67:  '包含未來式動詞（futuro semplice）詞尾變化。',
            112: '否定詞 "non" 置於動詞之前。'
        },
        check(id, tokens) {
            switch (id) {
                case 37:  return _hasPos(tokens, 'article.definite');
                case 38:  return _hasPos(tokens, 'article.indefinite');
                case 66:  return _hasPos(tokens, 'verb.past');
                case 67:  return _hasPos(tokens, 'verb.future') || _hasPos(tokens, 'auxiliary.future');
                case 112: return _hasPos(tokens, 'negation');
                case 87:  return _nBeforeAdj(tokens);
                case 81:  return _svoCheck(tokens);
                case 33:  return _morphCheck(tokens);
                default:  return false;
            }
        }
    },
    ru: {
        rules: [
            { id: 81,  name: '核心語序 (SVO)', posTypes: ['pronoun.personal', 'noun', 'verb'] },
            { id: 87,  name: '形容詞前置',     posTypes: ['adjective', 'noun'] },
            { id: 26,  name: '格位詞綴',       posTypes: [] },
            { id: 33,  name: '複數標記',       posTypes: ['noun'] },
            { id: 66,  name: '過去式',         posTypes: ['verb.past'] },
            { id: 67,  name: '未來式',         posTypes: ['verb.future', 'auxiliary.future'] },
            { id: 112, name: '否定詞 (не)',     posTypes: ['negation'] }
        ],
        descriptions: {
            81:  'SVO 語序：俄語詞序靈活，但無標記語境下以 SVO 為基準。',
            87:  '形容詞前置（ADJ + N）：形容詞置於名詞之前，並與名詞的性、數、格一致。',
            26:  '格位詞綴：俄語以詞尾標記六種格（主格、生格、與格、賓格、工具格、前置格）。',
            33:  '複數標記：名詞以詞尾變化標記複數，並按性別分類。',
            66:  '包含過去式動詞（以 -л / -ла / -ло / -ли 結尾）。',
            67:  '包含未來式（быть + 不定式，或動詞完成體）。',
            112: '否定詞 "не" 置於動詞之前。'
        },
        check(id, tokens) {
            switch (id) {
                case 66:  return _hasPos(tokens, 'verb.past');
                case 67:  return _hasPos(tokens, 'verb.future') || _hasPos(tokens, 'auxiliary.future');
                case 112: return _hasPos(tokens, 'negation');
                case 87:  return _adjBeforeN(tokens);
                case 81:  return _svoCheck(tokens);
                case 26:
                case 33:  return _morphCheck(tokens);
                default:  return false;
            }
        }
    },
    zh: {
        rules: [
            { id: 81,  name: '核心語序 (SVO)', posTypes: ['pronoun.personal', 'noun', 'verb'] },
            { id: 87,  name: '修飾語前置',     posTypes: ['adjective', 'noun'] },
            { id: 112, name: '否定詞 (不/沒)',  posTypes: ['negation'] },
            { id: 66,  name: '完成貌 (了)',     posTypes: ['particle.aspect'] },
            { id: 26,  name: '時態助詞',       posTypes: ['particle'] },
            { id: 89,  name: '量詞結構',       posTypes: ['numeral', 'classifier', 'noun'] }
        ],
        descriptions: {
            81:  'SVO 語序：中文基本語序為主語 → 動詞 → 賓語。',
            87:  '修飾語前置（ADJ + N）：形容詞置於名詞之前，可加「的」連接。',
            112: '否定詞置於動詞前：「不」（習慣/意願否定）或「沒」（過去事件否定）。',
            66:  '完成貌助詞「了」：緊接動詞之後，標記動作完成。',
            26:  '時態助詞「了」「着」「過」標記動貌，取代詞形變化。',
            89:  '量詞結構：數詞 + 量詞 + 名詞，如「一本書」「三個人」。'
        },
        check(id, tokens) {
            switch (id) {
                case 81:  return _svoCheck(tokens);
                case 87:  return _adjBeforeN(tokens);
                case 112: return _hasPos(tokens, 'negation');
                case 66:  return _hasPos(tokens, 'particle.aspect');
                case 26:  return _hasPos(tokens, 'particle');
                case 89:  return _numBeforeN(tokens);
                default:  return false;
            }
        }
    },
    ja: {
        rules: [
            { id: 82,  name: '核心語序 (SOV)', posTypes: ['pronoun.personal', 'noun', 'verb'] },
            { id: 85,  name: '後置格助詞',     posTypes: ['particle.case'] },
            { id: 87,  name: '修飾語前置',     posTypes: ['adjective', 'noun'] },
            { id: 112, name: '否定詞',         posTypes: ['negation'] },
            { id: 66,  name: '過去式 (た形)',   posTypes: ['verb.past'] },
            { id: 116, name: '疑問助詞 (か)',   posTypes: ['particle.question'] }
        ],
        descriptions: {
            82:  'SOV 語序：日語語序為主語 → 受詞 → 動詞，動詞置於句尾。',
            85:  '後置格助詞：は/が（主語）、を（受詞）、に/で（場所/手段）置於名詞之後。',
            87:  '修飾語前置（ADJ + N）：形容詞與修飾語置於名詞之前。',
            112: '否定形：動詞否定以 ない（普通體）或 ません（敬體）構成。',
            66:  '過去式：動詞以 た（普通體）或 ました（敬體）標記過去。',
            116: '疑問助詞 か：置於句尾，將陳述句轉為問句。'
        },
        check(id, tokens) {
            switch (id) {
                case 82:  return _sovCheck(tokens);
                case 85:  return _hasPos(tokens, 'particle.case');
                case 87:  return _adjBeforeN(tokens);
                case 112: return _hasPos(tokens, 'negation');
                case 66:  return _hasPos(tokens, 'verb.past');
                case 116: return tokens.length > 0 && _hasPos(tokens, 'particle.question');
                default:  return false;
            }
        }
    }
};
