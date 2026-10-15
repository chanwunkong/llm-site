// 冒險（最小可行模型）：通過了幾個基元、箱子裡有幾格、下一局的 5 個字、開始
import { L } from '../engine/store.js';
import * as M from '../engine/lv1.js';
import * as PR from '../engine/pronounce.js';
import { esc } from './sheet.js';
import { iconHtml } from './icon.js';

export function createHome(root, { getLang, onStart, onSettings }) {
  function render() {
    const lang = getLang(), lg = L();
    const done = lang.core.filter(p => M.passed(p.key)).length;
    const next = lang.core.filter(p => !M.passed(p.key)).slice(0, M.WORDS_PER_RUN);
    root.innerHTML = `<div class="home-body">
      <div class="hero-num"><b>${done}</b><span>/ ${lang.core.length} 個字已經通過</span></div>
      ${lg.backpack.length ? `<div class="panel"><b>箱子裡有 ${lg.backpack.length} 格</b><p class="muted">到「領土」把它們擺上去。</p></div>` : ''}
      ${!PR.configured() ? `<div class="panel"><b>需要發音評分服務</b><p class="muted">這一關要唸出來，由發音評分服務評分。請先在設定裡填入服務的網址和密碼。</p>
        <button class="btn gold sm" id="set">打開設定</button></div>` : ''}
      ${next.length ? `<h3>這一局的 ${next.length} 個字</h3>
        <div class="next-words">${next.map(p => `<div class="nw">${iconHtml(p.icon)}<span dir="auto">${esc(p.key)}</span></div>`).join('')}</div>
        <p class="muted">每個字輪流唸 3 次，取最高的兩次平均，${M.PASS} 分以上就通過。</p>
        <button class="btn gold big" id="go"${PR.configured() ? '' : ' disabled'}>開始</button>`
        : '<div class="panel"><b>65 個字全部通過了</b></div>'}
    </div>`;
    root.querySelector('#go')?.addEventListener('click', onStart);
    root.querySelector('#set')?.addEventListener('click', onSettings);
  }
  return { render, show: render, hide() {} };
}
