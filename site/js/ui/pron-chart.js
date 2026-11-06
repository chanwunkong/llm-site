// 發音回饋圖表：在 IPA 子音表或母音四邊形上標出目標音與學習者唸出的音
import { PLACES, MANNERS, HEIGHTS, position } from '../engine/ipa-chart.js';
import { ZH } from '../data/known-zh.js';

const PL = Object.fromEntries(PLACES), MN = Object.fromEntries(MANNERS), HT = Object.fromEntries(HEIGHTS);
const H_KEYS = HEIGHTS.map(([k]) => k);
const BK = { front: '前', central: '央', back: '後' };
let seq = 0;

// 單音的中文語音學描述（∅ 代表漏音）
export function describe(ph) {
  if (ph === '∅') return '漏掉了';
  const x = position(ph);
  if (x.kind === 'consonant') return `${x.voiced ? '濁' : '清'}${PL[x.place]}${MN[x.manner]}`;
  if (x.kind === 'vowel') return `${HT[x.height]}${BK[x.back]}${x.round ? '圓唇' : ''}母音${ph.includes('ː') ? '・長' : ''}`;
  return '';
}

const zh = ph => ZH[ph] || ZH[ph.replace('ː', '')] || '';

// 含注音近似對照的標籤，如 /f/（清唇齒擦音，像中文的「ㄈ」）
export const label = ph => {
  const z = zh(ph);
  return `/${ph}/（${describe(ph)}${z ? `，像中文的「${z}」` : ''}）`;
};

// 比較目標母音 a 與實際母音 b 的舌位與圓唇差異
export function direction(a, b) {
  const dh = H_KEYS.indexOf(b.height) - H_KEYS.indexOf(a.height);
  const B = ['front', 'central', 'back'], db = B.indexOf(b.back) - B.indexOf(a.back);
  const out = [];
  if (dh) out.push(dh > 0 ? '舌頭太低' : '舌頭太高');
  if (db) out.push(db > 0 ? '太後面' : '太前面');
  if (a.round !== b.round) out.push(b.round ? '嘴唇太圓' : '嘴唇不夠圓');
  return out.join('、') || '位置相同，差在長短或音質';
}

const legend = () => '<div class="pc-legend"><span><i style="background:var(--good)"></i>目標音</span><span><i style="background:var(--bad)"></i>你的音</span><span><i style="background:var(--muted)"></i>其他可能</span></div>';

// 目標音 + 候選音圖表；cands = [{ph, p}]，cands[0] 為學習者唸出的音，p 可省略
export function chartHtml(target, cands = []) {
  const you = cands.length ? cands[0].ph : null;
  const a = position(target);
  const hasP = cands.some(c => c.p !== undefined);
  const tCand = cands.find(c => c.ph === target);
  const shown = [{ ph: target, p: tCand ? tCand.p : (hasP ? 0 : undefined) }]
    .concat(cands.filter(c => c.ph !== target && (c.p === undefined || c.p >= 0.05))).slice(0, 5)
    .map(c => ({ ...c, pos: position(c.ph) }));
  const pct = p => p === undefined ? '' : `${Math.round(p * 100)}%`;
  const tagText = (isYou, p) => [isYou ? '你' : '', pct(p)].filter(Boolean).join(' ');

  if (a.kind === 'consonant') {
    const cs = shown.filter(c => c.pos.kind === 'consonant');
    const rows = MANNERS.filter(([m]) => cs.some(c => c.pos.manner === m));
    const cols = PLACES.filter(([pl]) => cs.some(c => c.pos.place === pl));
    const sym = c => {
      const isT = c.ph === target, isYou = c.ph === you;
      const cls = `pc-sym ${isT ? 'pc-t' : isYou ? 'pc-s' : 'pc-o'}${isYou ? ' pc-you' : ''}`;
      const op = !isT && !isYou && c.p !== undefined ? `opacity:${0.35 + c.p}` : '';
      return `<span class="pc-cellsym"><span class="${cls}" style="${op}">${c.ph}</span><span class="pc-tag">${tagText(isYou, c.p)}</span></span>`;
    };
    const cell = (m, pl, v) => cs.filter(c => c.pos.manner === m && c.pos.place === pl && c.pos.voiced === v).map(sym).join('');
    const others = shown.filter(c => c.pos.kind !== 'consonant' && c.ph !== target);
    return `<h4 class="pc-title">發音部位對照</h4><div class="pc-ipa-wrap"><table class="pc-ipa"><thead><tr><th></th>${cols.map(([, z]) => `<th colspan="2">${z}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(([m, z]) => `<tr><th>${z}</th>${cols.map(([pl]) => `<td>${cell(m, pl, false)}</td><td class="pc-r">${cell(m, pl, true)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="pc-note">每格左邊是清音，右邊是濁音${others.length ? `；不在表上：${others.map(c => c.p === undefined ? `/${c.ph}/` : `/${c.ph}/ ${pct(c.p)}`).join('、')}` : ''}</div>${legend()}`;
  }

  if (a.kind === 'vowel') {
    const vs = shown.filter(c => c.pos.kind === 'vowel');
    const W = 100, Hh = 77, xF = h => 10 + (h / 6) * 34, xB = 84, yOf = h => (7 + (h / 6) * 86) * Hh / 100;
    const xy = v => { const h = H_KEYS.indexOf(v.height); return [v.back === 'front' ? xF(h) : v.back === 'back' ? xB : (xF(h) + xB) / 2, yOf(h)]; };
    const pts = vs.map(c => ({ ...c, xy: xy(c.pos) }));
    const xs = pts.map(c => c.xy[0]), ys = pts.map(c => c.xy[1]);
    const spread = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const zoom = spread < 25;
    const k = zoom ? 0.45 : 1, mx = (Math.max(...xs) + Math.min(...xs)) / 2, my = (Math.max(...ys) + Math.min(...ys)) / 2;
    const view = zoom ? `${mx - 26} ${my - 18} 52 36` : `-14 -10 ${W + 22} ${Hh + 16}`;
    const trap = `${xF(0) - 7},0 ${xB + 9},0 ${xB + 9},${Hh} ${xF(6) - 7},${Hh}`;
    const mid = `pc-ah-${++seq}`;
    // 同位置的多個音（例如 i / iː）垂直錯開顯示
    const seen = {};
    const dot = c => {
      const isT = c.ph === target, isYou = c.ph === you, [x, y] = c.xy, key = `${x},${y}`;
      const n = (seen[key] = (seen[key] || 0) + 1) - 1, dy = n * 9 * k;
      const color = isT ? 'var(--good)' : isYou ? 'var(--bad)' : 'var(--muted)';
      const fill = isYou ? color : 'var(--white)';
      const op = isT || isYou ? 1 : 0.4 + (c.p ?? 0.3);
      return `<circle cx="${x}" cy="${y + dy}" r="${5.5 * k}" fill="${fill}" stroke="${color}" stroke-width="${1.2 * k}" opacity="${op}"/>
        <text x="${x}" y="${y + dy + 2.4 * k}" text-anchor="middle" font-size="${7 * k}" font-weight="700" fill="${isYou ? 'var(--white)' : color}" font-family="Charis SIL,Doulos SIL,serif">${c.ph}</text>
        <text x="${x + 7.5 * k}" y="${y + dy + 2 * k}" font-size="${4.6 * k}" fill="var(--ink)">${tagText(isYou, c.p)}</text>`;
    };
    const t = pts.find(c => c.ph === target), y = pts.find(c => c.ph === you);
    const arrow = t && y && t !== y ? `<line x1="${t.xy[0]}" y1="${t.xy[1]}" x2="${y.xy[0]}" y2="${y.xy[1]}" stroke="var(--bad)" stroke-width="${0.8 * k}" marker-end="url(#${mid})"/>` : '';
    const axes = zoom ? '' : [['前', xF(0)], ['央', (xF(0) + xB) / 2], ['後', xB]].map(([s, x]) => `<text x="${x}" y="-4" text-anchor="middle" font-size="4.5" fill="var(--muted)">${s}</text>`).join('')
      + [['高', 0], ['半高', 2], ['半低', 4], ['低', 6]].map(([s, h]) => `<text x="-2" y="${yOf(h) + 1.5}" text-anchor="end" font-size="4.5" fill="var(--muted)">${s}</text>`).join('');
    const ends = pts.filter(c => c.ph !== target && c.ph !== you);
    return `<h4 class="pc-title">舌頭位置對照（母音）${zoom ? '<small style="font-weight:400;color:var(--muted)">・已放大</small>' : ''}</h4>
      <svg class="pc-vq${zoom ? ' pc-zoom' : ''}" viewBox="${view}">
      <defs><marker id="${mid}" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--bad)"/></marker></defs>
      <polygon points="${trap}" fill="var(--soft)"/>${axes}${arrow}${[...ends, t, y].filter(Boolean).filter((c, i, arr) => arr.indexOf(c) === i).map(dot).join('')}
    </svg>${t && y && t !== y ? `<div class="pc-note">箭頭：從目標音指向你的音（${direction(t.pos, y.pos)}）</div>` : ''}${legend()}`;
  }

  return '';
}
