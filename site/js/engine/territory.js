// 領土：方格座標 "x,y" -> 詞元。必須相連、不限大小。
import { L, save, RULES, level } from './store.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const key = (x, y) => `${x},${y}`;
export const parse = k => k.split(',').map(Number);

export const tiles = () => L().territory;
export const count = () => Object.keys(tiles()).length;

export function cellOf(lemma) {
  for (const [k, v] of Object.entries(tiles())) if (v === lemma) return k;
  return null;
}

function neighbors(k) {
  const [x, y] = parse(k);
  return DIRS.map(([dx, dy]) => key(x + dx, y + dy));
}

// 可以放下新格子的位置：空的、而且和領土相鄰（領土為空時只有原點）
export function placeable() {
  const t = tiles();
  if (!Object.keys(t).length) return [key(0, 0)];
  const out = new Set();
  for (const k of Object.keys(t)) for (const n of neighbors(k)) if (!t[n]) out.add(n);
  return [...out];
}

function connected(cells) {
  if (cells.length <= 1) return true;
  const set = new Set(cells), seen = new Set([cells[0]]), q = [cells[0]];
  while (q.length) for (const n of neighbors(q.pop())) if (set.has(n) && !seen.has(n)) { seen.add(n); q.push(n); }
  return seen.size === set.size;
}

export function canPickUp(k) {
  const rest = Object.keys(tiles()).filter(c => c !== k);
  return connected(rest);
}

export function place(lemma, k) {
  const lg = L();
  if (lg.territory[k] || !placeable().includes(k)) return false;
  const i = lg.backpack.indexOf(lemma);
  if (i < 0) return false;
  lg.backpack.splice(i, 1);
  lg.territory[k] = lemma;
  save();
  return true;
}

// 拿起已放好的詞元要付移動費
export function pickUp(k) {
  const lg = L();
  const lemma = lg.territory[k];
  if (!lemma) return { ok: false, reason: '這裡沒有格子' };
  if (lg.backpack.length >= RULES.backpackSize) return { ok: false, reason: '背包滿了' };
  if (lg.gold < RULES.moveCost) return { ok: false, reason: `金幣不足（需要 ${RULES.moveCost}）` };
  if (!canPickUp(k)) return { ok: false, reason: '拿起後領土會斷開' };
  delete lg.territory[k];
  lg.backpack.push(lemma);
  lg.gold -= RULES.moveCost;
  save();
  return { ok: true, lemma };
}

// 新詞元進背包；背包滿了就自動放在領土邊緣（離原點最近的可放位置）
export function receive(lemmas) {
  const lg = L(), auto = [];
  for (const lemma of lemmas) {
    if (cellOf(lemma) || lg.backpack.includes(lemma)) continue;
    if (lg.backpack.length < RULES.backpackSize) { lg.backpack.push(lemma); continue; }
    const k = placeable().sort((a, b) => dist0(a) - dist0(b))[0];
    lg.territory[k] = lemma;
    auto.push(lemma);
  }
  save();
  return auto;
}
const dist0 = k => { const [x, y] = parse(k); return Math.abs(x) + Math.abs(y); };

// 沿著領土實際存在的格子走，步數最少的走法
export function pathSteps(a, b) {
  const t = tiles(), from = cellOf(a), to = cellOf(b);
  if (!from || !to) return null;
  if (from === to) return 0;
  const seen = new Set([from]);
  let frontier = [from], steps = 0;
  while (frontier.length) {
    steps++;
    const next = [];
    for (const c of frontier) for (const n of neighbors(c)) {
      if (!t[n] || seen.has(n)) continue;
      if (n === to) return steps;
      seen.add(n);
      next.push(n);
    }
    frontier = next;
  }
  return null;
}

// 路徑加成：句中有格子的詞元依序兩兩相接，每對 = 20% ÷ 步數
export function pathBonus(lemmas) {
  const placed = [];
  for (const l of lemmas) if (cellOf(l) && placed.at(-1) !== l) placed.push(l);
  let bonus = 0;
  const pairs = [];
  for (let i = 0; i + 1 < placed.length; i++) {
    const s = pathSteps(placed[i], placed[i + 1]);
    if (s) { bonus += 0.2 / s; pairs.push([placed[i], placed[i + 1], s]); }
  }
  return { bonus, pairs };
}

// 語塊完成：詞元依序相鄰（方向不限）
export function chunkComplete(chunk) {
  const cells = chunk.lemmas.map(cellOf);
  if (cells.some(c => !c)) return false;
  for (let i = 0; i + 1 < cells.length; i++) if (!neighbors(cells[i]).includes(cells[i + 1])) return false;
  return true;
}

// 每局結算時的語塊產出：每個完成的語塊 = 各詞元等級總和 × 3
export function chunkProduction(chunks) {
  return chunks.filter(chunkComplete).map(c => ({ chunk: c, gold: c.lemmas.reduce((s, l) => s + level(l), 0) * 3 }));
}
