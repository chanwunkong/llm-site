// 聲音：朗讀（語音合成）、空格提示音、語音辨識、音效。全部依語言設定檔的 BCP-47 代碼運作。
import { state } from './engine/store.js';
import * as PR from './engine/pronounce.js';

let voiceLang = 'en-US';
export const setVoiceLang = l => { voiceLang = l; };
export const canSpeak = 'speechSynthesis' in window;
const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canListen = !!Rec;

const sameLang = v => v.lang.replace('_', '-').toLowerCase().startsWith(voiceLang.slice(0, 2).toLowerCase());
function pickVoice(variety) {
  const vs = speechSynthesis.getVoices();
  // 高變異度：從這個語言的所有語音中隨機挑一個（男聲、女聲、不同口音）
  if (variety) { const all = vs.filter(sameLang); if (all.length) return all[(Math.random() * all.length) | 0]; }
  return vs.find(v => v.lang === voiceLang) || vs.find(sameLang);
}
export const voiceCount = () => (canSpeak ? speechSynthesis.getVoices().filter(sameLang).length : 0);

// 手機沒有這個語言的語音（例如 iPhone 沒有吉爾吉斯語）時，改請發音服務用 eSpeak NG 產生聲音。
// 語音清單可能還沒載入：最多等 1 秒（voiceschanged），再判斷有沒有這個語言的語音。
let voicesReady = null;
function voices() {
  if (!canSpeak) return Promise.resolve([]);
  const now = speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  voicesReady ||= new Promise(r => {
    speechSynthesis.addEventListener?.('voiceschanged', () => r(speechSynthesis.getVoices()), { once: true });
    setTimeout(() => r(speechSynthesis.getVoices()), 1000);
  });
  return voicesReady;
}
const hasVoice = async () => (await voices()).some(sameLang);
const langId = () => voiceLang.slice(0, 2).toLowerCase();

// 播放錄音檔共用一個 <audio>：iPhone 只允許「使用者點過之後」播放，第一次點畫面時先用一段無聲音檔解鎖
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
const audioEl = typeof Audio !== 'undefined' ? new Audio() : null;
if (audioEl) addEventListener('pointerdown', () => { audioEl.src = SILENT; audioEl.play().catch(() => {}); }, { once: true });
function playUrl(url) {
  return new Promise(resolve => {
    if (!audioEl) return resolve();
    const done = () => { audioEl.onended = audioEl.onerror = null; resolve(); };
    audioEl.onended = audioEl.onerror = done;
    audioEl.src = url;
    audioEl.play().catch(done);
  });
}
const spoken = new Map();   // 同一句話只向服務要一次
async function serviceSpeak(text, rate) {
  const key = `${langId()}|${rate}|${text}`;
  if (!spoken.has(key)) {
    const blob = await PR.speakAudio(text, langId(), rate);
    if (!blob) return;
    spoken.set(key, URL.createObjectURL(blob));
  }
  await playUrl(spoken.get(key));
}

const alive = new Set();
export async function speak(text, { rate = 0.9, variety = false, voice = null } = {}) {
  if (state.sound && text && PR.configured() && !(await hasVoice())) return serviceSpeak(text, rate).catch(() => {});
  return new Promise(resolve => {
    if (!canSpeak || !state.sound || !text) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voiceLang;
    u.rate = rate;
    const v = voice || pickVoice(variety);
    if (v) u.voice = v;
    alive.add(u);
    const done = () => { alive.delete(u); clearTimeout(t); resolve(); };
    const t = setTimeout(done, 1500 + text.length * 180 / rate);
    u.onend = u.onerror = done;
    speechSynthesis.speak(u);
  });
}
// 錄音檔（單音）：用 <audio> 播放，手機靜音模式下也聽得到。依序播放多個檔案，中間停一下
let playSeq = 0;
export async function playFiles(urls, gap = 250) {
  if (!state.sound) return;
  const my = ++playSeq;
  for (const [i, url] of urls.entries()) {
    if (i) await new Promise(r => setTimeout(r, gap));
    if (my !== playSeq) return;   // 中途又按了別的
    await playUrl(url);
  }
}
export function stopSpeech() { if (canSpeak) speechSynthesis.cancel(); audioEl?.pause(); }

let ac;
function ctx() {
  ac ||= new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function tone(f1, f2, dur, type = 'sine', vol = 0.12) {
  try {
    const c = ctx(), t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur);
  } catch {}
}

// 句子中的空格：前半句 → 提示音 → 後半句
export async function speakGap(before, after, rate = 0.9, variety = false) {
  stopSpeech();
  const voice = canSpeak ? pickVoice(variety) : null;
  if (before) await speak(before, { rate, voice });
  if (state.sound) { tone(880, 880, 0.18, 'triangle', 0.1); await new Promise(r => setTimeout(r, 380)); }
  if (after) await speak(after, { rate, voice });
}

const SFX = {
  good: () => { tone(660, 990, 0.1, 'triangle'); setTimeout(() => tone(990, 1320, 0.12, 'triangle'), 90); },
  bad: () => tone(240, 120, 0.25, 'sawtooth', 0.05),
  tap: () => tone(520, 620, 0.05, 'sine', 0.08),
  level: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, f * 1.01, 0.18, 'triangle', 0.1), i * 90)),
  coin: () => tone(880, 1760, 0.12, 'sine', 0.1),
  place: () => tone(300, 520, 0.12, 'triangle', 0.12),
};
export function sfx(kind) { if (state.sound) SFX[kind]?.(); }

// 語音辨識：回傳候選句子（可能是空陣列）
export function listen() {
  return new Promise((resolve, reject) => {
    if (!Rec) return reject(new Error('unsupported'));
    const r = new Rec();
    r.lang = voiceLang;
    r.interimResults = false;
    r.maxAlternatives = 5;
    const out = [];
    r.onresult = e => { for (const res of e.results) for (const alt of res) out.push(alt.transcript); };
    r.onerror = e => (e.error === 'no-speech' ? resolve([]) : reject(e));
    r.onend = () => resolve(out);
    r.start();
  });
}
