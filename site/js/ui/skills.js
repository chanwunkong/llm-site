// 技能：用金幣永久解鎖 WALS 規則，解鎖後才會出現在局中的三選一
import { L, save, RULES } from '../engine/store.js';
import { WALS } from '../engine/run.js';
import { sfx } from '../audio.js';
import { esc, toast } from './sheet.js';

export function createSkills(root, { onChange }) {
  function render() {
    const lg = L();
    root.innerHTML = `<div class="skills-page">
      <h2>✨ WALS 技能</h2>
      <p class="muted">每條 WALS（世界語言結構地圖集）規則都是一項技能。用金幣解鎖後，冒險中升級時才有機會選到。
      選到之後，只要空格裡用到這條規則、而且答對，這題分數 +50%，多條可以疊加。規則不會改變題目，只會加分。</p>
      ${WALS.map(r => {
        const on = lg.unlocked.includes(r.id);
        return `<div class="rule${on ? ' on' : ''}"><div class="ic">${r.icon}</div>
          <div><b>${esc(r.name)}</b><small>WALS ${r.id}・${esc(r.desc)}</small></div>
          ${on ? '<span class="own">已解鎖</span>' : `<button class="btn gold sm" data-id="${r.id}" ${lg.gold < RULES.walsCost ? 'disabled' : ''}>🪙 ${RULES.walsCost}</button>`}
        </div>`;
      }).join('')}
      <p class="muted">規則是否用到，是依每個字的通用詞性（UD）自動判斷，所有語言都一樣。</p>
    </div>`;
    root.querySelectorAll('[data-id]').forEach(b => (b.onclick = () => {
      if (lg.gold < RULES.walsCost) return toast('金幣不足');
      lg.gold -= RULES.walsCost;
      lg.unlocked.push(b.dataset.id);
      save();
      sfx('level');
      toast(`解鎖 WALS ${b.dataset.id}`);
      render();
      onChange?.();
    }));
  }
  return { show: render, hide() {}, render };
}
