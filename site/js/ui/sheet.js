// 底部面板與提示訊息
const sheet = document.getElementById('sheet');
const body = sheet.querySelector('.body');
let current = {}, hideT;

// opts：{ locked, onClose }
export function openSheet(html, opts = {}, mount) {
  clearTimeout(hideT);
  current = opts;
  body.innerHTML = html;
  sheet.hidden = false;
  sheet.offsetHeight;
  sheet.classList.add('open');
  body.parentElement.scrollTop = 0;
  mount?.(body);
}
export const sheetOpen = () => sheet.classList.contains('open');
export function closeSheet() {
  if (sheet.hidden) return;
  sheet.classList.remove('open');
  const c = current;
  current = {};
  c.onClose?.();
  hideT = setTimeout(() => (sheet.hidden = true), 220);
}
sheet.querySelector('.backdrop').addEventListener('click', () => { if (!current.locked) closeSheet(); });

const toastEl = document.getElementById('toast');
let toastT;
export function toast(msg, ms = 1800) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove('show'), ms);
}

export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const stars = lv => `Lv${lv}`;
