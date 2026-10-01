const questionModules = {};

function registerQuestionModule(level, module) {
    if (!questionModules[level]) questionModules[level] = [];
    questionModules[level].push(module);
}

let activeDispatchModule = null;

function dispatchQuestion(wordData) {
    if (activeDispatchModule) activeDispatchModule.deactivate();
    const level = wordData.level || 1;
    let pool = questionModules[level] || questionModules[1] || [];
    let filtered = [...pool];
    if (practiceListeningDisabled) filtered = filtered.filter(m => !m.requiresListening);
    if (practiceSpeakingDisabled) filtered = filtered.filter(m => !m.requiresSpeaking);
    if (filtered.length) pool = filtered;
    if (!pool.length) return;
    activeDispatchModule = pool[Math.floor(Math.random() * pool.length)];
    activeDispatchModule.activate(wordData);
}

function deactivateCurrentQuestion() {
    if (activeDispatchModule) {
        activeDispatchModule.deactivate();
        activeDispatchModule = null;
    }
}
