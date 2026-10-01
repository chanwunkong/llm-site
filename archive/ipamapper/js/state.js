let appSaves = [];
let currentSaveId = null;

let currentTokens = 0;
let datasets = [];
let activeDatasetId = '';
let usedIndices = {};
let checkInHistory = [];
let unlockedRules = []; // 文法解鎖狀態改為存檔綁定
let ruleHitCounts = {}; // 每條規則在練習中被滿足的累計次數
let voiceSettings = { voiceURI: '', lang: 'en-US', langCode: 'en' };
let passageText = '';

const storageData = [];
const grid = new Map();

const globalTokenCount = document.getElementById('global-token-count');

const defaultWords = [
    { word: "hello", phonetic: "/həˈloʊ/", pos: "interjection", morphological: "hello", sentence: "Hello, how are you?", etymology: "From 'holla' (shout or call)." },
    { word: "goodbye", phonetic: "/ˌɡʊdˈbaɪ/", pos: "interjection", morphological: "goodbye", sentence: "Goodbye, see you tomorrow.", etymology: "Short for 'God be with ye'." },
    { word: "hi", phonetic: "/haɪ/", pos: "interjection", morphological: "hi", sentence: "Hi, I am Tom.", etymology: "From 'hy' or 'hey'." },
    { word: "bye", phonetic: "/baɪ/", pos: "interjection", morphological: "bye", sentence: "Bye, have a good day.", etymology: "A short form of 'goodbye'." },
    { word: "good morning", phonetic: "/ɡʊd ˈmɔːrnɪŋ/", pos: "interjection", morphological: "good morning", sentence: "Good morning, mom.", etymology: "From 'good' and 'morning'." },
    { word: "please", phonetic: "/pliːz/", pos: "adverb", morphological: "please", sentence: "Please sit down.", etymology: "Short for 'if it please you'." }
];

function getPosColor(posString) {
    if (!posString) return '#f2f2f2';
    const p = posString.toLowerCase();
    const sw = prefix => p === prefix || p.startsWith(prefix + '.');
    if (sw('noun')) return '#e6f2ff';
    if (sw('pronoun')) return '#dce8ff';
    if (sw('verb') || sw('auxiliary')) return '#ffe6e6';
    if (sw('adjective')) return '#e6ffe6';
    if (sw('adverb')) return '#ffecd9';
    if (sw('article') || sw('numeral')) return '#f0e6ff';
    if (sw('negation')) return '#ffe6f0';
    if (sw('preposition') || sw('conjunction')) return '#e8f5e9';
    if (sw('particle') || sw('interjection')) return '#ffffe6';
    return '#f2f2f2';
}
