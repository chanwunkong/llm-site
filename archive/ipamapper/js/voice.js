const LANG_OPTIONS = [
    { code: 'en', label: '英', locale: 'en', name: 'English' },
    { code: 'it', label: '義', locale: 'it', name: 'Italiano' },
    { code: 'ru', label: '俄', locale: 'ru', name: 'Русский' },
    { code: 'zh', label: '中', locale: 'zh', name: '中文' },
    { code: 'ja', label: '日', locale: 'ja', name: '日本語' }
];

function setLang(code) {
    if (!currentSaveId) return showToast('請先建立並選擇存檔');
    const opt = LANG_OPTIONS.find(o => o.code === code);
    if (!opt) return;
    voiceSettings.langCode = code;
    voiceSettings.lang = opt.locale + '-' + opt.locale.toUpperCase();
    // Pick first matching TTS voice for the selected language
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find(v => v.lang.startsWith(opt.locale));
    if (match) voiceSettings.voiceURI = match.voiceURI;
    populateVoiceList();
    updateLangToggleUI();
    saveCurrentData();
    renderGrammarRules();
    showToast(`語言切換為 ${opt.name}`);
}

function updateLangToggleUI() {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('lang-btn-active', btn.dataset.lang === voiceSettings.langCode);
    });
}

function populateVoiceList() {
    const select = document.getElementById('voice-select');
    if (!select) return;
    const currentURI = voiceSettings.voiceURI;
    const langCode = voiceSettings.langCode || 'en';
    const opt = LANG_OPTIONS.find(o => o.code === langCode);
    const locale = opt ? opt.locale : 'en';
    select.innerHTML = '<option value="">預設語音</option>';
    window.speechSynthesis.getVoices()
        .filter(v => v.lang.startsWith(locale))
        .forEach(v => {
            const o = document.createElement('option');
            o.value = v.voiceURI;
            o.textContent = `${v.name} (${v.lang})`;
            o.dataset.lang = v.lang;
            if (v.voiceURI === currentURI) o.selected = true;
            select.appendChild(o);
        });
}

function applyVoiceSettings() {
    populateVoiceList();
    updateLangToggleUI();
}

window.speechSynthesis.onvoiceschanged = populateVoiceList;

document.getElementById('voice-select').addEventListener('change', () => {
    if (!currentSaveId) return showToast('請先建立並選擇存檔');
    const select = document.getElementById('voice-select');
    const selectedOpt = select.options[select.selectedIndex];
    voiceSettings.voiceURI = selectedOpt.value;
    voiceSettings.lang = selectedOpt.dataset.lang || voiceSettings.lang;
    saveCurrentData();
    showToast('語音設定已儲存');
});
