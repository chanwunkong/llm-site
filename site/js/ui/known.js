// 「我會的語言」編輯面板：技能頁與發音頁共用
import { state, save, known } from '../engine/store.js';
import { LANGS } from '../data/wals.js';
import { esc, openSheet, closeSheet } from './sheet.js';

export const langName = id => LANGS.find(l => l.id === id)?.zh || id;

export function editKnown(targetWals, onDone) {
  const sel = new Set(known());
  const draw = body => {
    body.querySelector('#langs').innerHTML = LANGS.filter(l => l.id !== targetWals).map(l =>
      `<button class="btn ${sel.has(l.id) ? 'gold' : 'ghost'} sm" data-l="${l.id}">${esc(l.zh)}</button>`).join('');
    body.querySelectorAll('[data-l]').forEach(b => (b.onclick = () => { sel.has(b.dataset.l) ? sel.delete(b.dataset.l) : sel.add(b.dataset.l); draw(body); }));
  };
  openSheet(`<h2>我會的語言</h2>
    <p class="muted">可以多選。例如會中文、也學過英文，就兩個都選。目標語言和這些語言都不一樣的地方，會標成「難規則」或「難音」。</p>
    <div class="lang-grid" id="langs"></div>
    <button class="btn gold big" id="done" style="margin-top:14px">完成</button>`, {}, body => {
    draw(body);
    body.querySelector('#done').onclick = () => { state.known = [...sel]; save(); closeSheet(); onDone?.(); };
  });
}

export function knownRow(targetWals) {
  const ids = known().filter(id => id !== targetWals);
  return `<div class="known-row"><span class="muted">我會的語言：</span>
    ${ids.length ? ids.map(id => `<span class="chip">${esc(langName(id))}</span>`).join('') : '<span class="muted">尚未設定</span>'}
    <button class="btn ghost sm" data-edit-known>編輯</button></div>`;
}
