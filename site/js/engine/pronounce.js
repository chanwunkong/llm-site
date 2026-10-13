// 發音評分服務（自行架設，見 services/pronounce/）：網址和存取密碼只存在這台裝置上，不寫進程式，也不送到其他地方。
// 錄音只送到使用者填的服務；遊戲本身不保存錄音。
const KEY = 'word-territory-pronounce';

export function config() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
export function setConfig(c) {
  try { c && c.url ? localStorage.setItem(KEY, JSON.stringify(c)) : localStorage.removeItem(KEY); } catch {}
  langs = null;
}
export const configured = () => !!config().url;
const base = () => config().url.replace(/\/+$/, '');
const auth = () => ({ Authorization: `Bearer ${config().token || ''}` });

// 檢查服務：回傳 {ok, authorized, languages, version} 或 {ok:false, msg}
let langs = null;
export async function health(c = config()) {
  try {
    const r = await fetch(`${c.url.replace(/\/+$/, '')}/v1/health`, { headers: { Authorization: `Bearer ${c.token || ''}` } });
    const j = await r.json();
    if (j.ok) langs = j.languages;
    return j;
  } catch {
    return { ok: false, msg: '連不上服務。請確認網址，以及手機是否連得到這台主機（例如有沒有開 Tailscale）' };
  }
}
// 這個語言能不能評分：good / no-tone 可以，其他不行
export async function supports(lang) {
  if (!configured()) return false;
  if (!langs) await health();
  return langs?.[lang] === 'good' || langs?.[lang] === 'no-tone';
}

const phoneCache = new Map();
export async function phonemize(text, lang) {
  const k = `${lang}|${text}`;
  if (phoneCache.has(k)) return phoneCache.get(k);
  const r = await fetch(`${base()}/v1/phonemize`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ text, lang }) });
  const j = await r.json();
  if (j.ok) phoneCache.set(k, j);
  return j;
}

export async function score(pcm, phones, target, lang) {
  const q = new URLSearchParams({ lang, phones: JSON.stringify(phones), target: String(target) });
  const r = await fetch(`${base()}/v1/score?${q}`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/octet-stream' }, body: pcm.buffer });
  return r.json();
}

// 朗讀：手機沒有這個語言的語音時，由服務用 eSpeak NG 產生（聲音比較機械）。回傳音檔 Blob，失敗回傳 null
export async function speakAudio(text, lang, rate = 1) {
  const q = new URLSearchParams({ lang, text, rate: String(rate) });
  try {
    const r = await fetch(`${base()}/v1/speak?${q}`, { headers: auth() });
    return r.ok ? await r.blob() : null;
  } catch { return null; }
}

// ---- 錄音：唸完自動停止 ----
// 關掉瀏覽器的降噪、回音消除與自動音量：它們會抹掉分辨 θ、f、s 的高頻細節。
// 前 0.3 秒量背景噪音；講話後安靜 0.7 秒就停。沒講話 4 秒、總長 5 秒也會停。
export async function record(onState = () => {}) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  const rec = new MediaRecorder(stream), chunks = [];
  rec.ondataavailable = e => chunks.push(e.data);
  const done = new Promise(res => (rec.onstop = res));
  rec.start();
  onState('listening');
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  await ac.resume();
  const an = ac.createAnalyser(); an.fftSize = 1024;
  ac.createMediaStreamSource(stream).connect(an);
  const buf = new Float32Array(an.fftSize), t0 = performance.now();
  let noise = 0, spoke = false, last = 0;
  await new Promise(stop => {
    const timer = setInterval(() => {
      an.getFloatTimeDomainData(buf);
      const rms = Math.sqrt(buf.reduce((s, x) => s + x * x, 0) / buf.length), now = performance.now() - t0;
      if (now < 300) { noise = Math.max(noise, rms); return; }
      if (rms > Math.max(noise * 3, 0.015)) { if (!spoke) onState('heard'); spoke = true; last = now; }
      if ((spoke && now - last > 700) || (!spoke && now > 4000) || now > 5000) { clearInterval(timer); stop(); }
    }, 30);
  });
  ac.close();
  rec.stop();
  await done;
  stream.getTracks().forEach(t => t.stop());
  onState('processing');
  return toPcm16k(new Blob(chunks, { type: rec.mimeType }));
}
async function toPcm16k(blob) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
  ctx.close();
  const off = new OfflineAudioContext(1, Math.ceil(buf.duration * 16000), 16000);
  const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start();
  return (await off.startRendering()).getChannelData(0);
}
