// 介面用的幾何圖形（包浩斯風格）：取代介面上的表情符號。學習內容的圖示（單字的 emoji）不在此列。
const C = { red: '#D7262E', blue: '#1F4FA3', yellow: '#F2C12E', ink: '#111111', white: '#FFFFFF' };
const svg = (body, size = 18, vb = 24) => `<svg class="glyph" width="${size}" height="${size}" viewBox="0 0 ${vb} ${vb}" aria-hidden="true">${body}</svg>`;

export const G = {
  circle: (c = 'yellow', s) => svg(`<circle cx="12" cy="12" r="10" fill="${C[c]}"/>`, s),
  square: (c = 'blue', s) => svg(`<rect x="3" y="3" width="18" height="18" fill="${C[c]}"/>`, s),
  triangle: (c = 'red', s) => svg(`<polygon points="12,2 22,21 2,21" fill="${C[c]}"/>`, s),
  half: (c = 'ink', s) => svg(`<path d="M2 14 A10 10 0 0 1 22 14 Z" fill="${C[c]}"/>`, s),
  hex: (c = 'blue', s) => svg(`<polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="${C[c]}"/>`, s),
  // 喇叭（播放聲音）
  speaker: (s = 16) => svg(`<polygon points="3,9 8,9 13,4 13,20 8,15 3,15" fill="${C.ink}"/><path d="M16 8.5 A5 5 0 0 1 16 15.5" stroke="${C.ink}" stroke-width="2" fill="none"/><path d="M18.5 6 A8.5 8.5 0 0 1 18.5 18" stroke="${C.ink}" stroke-width="2" fill="none"/>`, s),
  mic: (s = 18) => svg(`<rect x="8" y="2" width="8" height="13" rx="4" fill="${C.white}"/><path d="M5 11 A7 7 0 0 0 19 11" stroke="${C.white}" stroke-width="2" fill="none"/><rect x="11" y="18" width="2" height="4" fill="${C.white}"/>`, s),
  close: (s = 16) => svg(`<path d="M4 4 L20 20 M20 4 L4 20" stroke="${C.ink}" stroke-width="3"/>`, s),
  gear: (s = 18) => svg(`<circle cx="12" cy="12" r="6" fill="none" stroke="${C.ink}" stroke-width="3"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5M4.2 4.2l3.5 3.5M16.3 16.3l3.5 3.5M4.2 19.8l3.5-3.5M16.3 7.7l3.5-3.5" stroke="${C.ink}" stroke-width="2.5"/>`, s),
  eye: (s = 16) => svg(`<path d="M2 12 Q12 3 22 12 Q12 21 2 12 Z" fill="none" stroke="${C.ink}" stroke-width="2"/><circle cx="12" cy="12" r="3.5" fill="${C.ink}"/>`, s),
};

// 基本形狀用 CSS 畫：kind = circle | square | triangle | hex | half；color = red | blue | yellow | ink
export const shape = (kind, color) => `<i class="shape ${kind} ${color}"></i>`;

// 等級：五個小方塊，已達到的塗滿
export const levelBlocks = lv => `<span class="lvblocks">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= lv ? 'on' : ''}"></i>`).join('')}</span>`;
