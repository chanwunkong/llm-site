const HEX_SIZE = 65;
let camera = { x: 0, y: 0, zoom: 1 };
const sqrt3 = Math.sqrt(3);

function axialToPixel(q, r) {
    return { x: HEX_SIZE * sqrt3 * (q + r / 2), y: HEX_SIZE * 3 / 2 * r };
}

function pixelToAxial(px, py) {
    const q = (sqrt3 / 3 * px - 1 / 3 * py) / HEX_SIZE;
    const r = (2 / 3 * py) / HEX_SIZE;
    const s = -q - r;
    let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
    const qD = Math.abs(rq - q), rD = Math.abs(rr - r), sD = Math.abs(rs - s);
    if (qD > rD && qD > sD) rq = -rr - rs; else if (rD > sD) rr = -rq - rs;
    return { q: rq, r: rr };
}

const neighborDirs = [
    { q: 1, r: 0 }, { q: 0, r: 1 }, { q: -1, r: 1 },
    { q: -1, r: 0 }, { q: 0, r: -1 }, { q: 1, r: -1 }
];

function getLevel(q, r) {
    const key = `${q},${r}`;
    return grid.has(key) ? grid.get(key).level : 0;
}

function hasAdjacent(q, r) {
    for (let dir of neighborDirs) if (grid.has(`${q + dir.q},${r + dir.r}`)) return true;
    return false;
}

function isConnectedAfterRemoval(q, r) {
    if (grid.size <= 1) return true;
    const targetKey = `${q},${r}`;
    let startNode = null;
    for (let key of grid.keys()) if (key !== targetKey) { startNode = key; break; }
    if (!startNode) return true;

    const visited = new Set(), queue = [startNode];
    visited.add(startNode);
    while (queue.length > 0) {
        const [cq, cr] = queue.shift().split(',').map(Number);
        for (let dir of neighborDirs) {
            const nKey = `${cq + dir.q},${cr + dir.r}`;
            if (nKey !== targetKey && grid.has(nKey) && !visited.has(nKey)) {
                visited.add(nKey); queue.push(nKey);
            }
        }
    }
    return visited.size === grid.size - 1;
}

const canvas = document.getElementById('hex-canvas');
const ctx = canvas.getContext('2d');
let width, height;

function resizeCanvas() {
    if (!document.getElementById('view-vocabulary').classList.contains('active')) return;
    width = canvas.parentElement.clientWidth; height = canvas.parentElement.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr; canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    if (camera.x === 0 && camera.y === 0) { camera.x = width / 2; camera.y = height / 2; }
    drawCanvas();
}

function drawHexPath(x, y, radius) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (i * 60 - 30) * Math.PI / 180;
        ctx[i === 0 ? 'moveTo' : 'lineTo'](x + radius * Math.cos(angle), y + radius * Math.sin(angle));
    }
    ctx.closePath();
}

const contourStyles = [
    { width: 0, stroke: 'transparent' },
    { width: 0, stroke: 'transparent' },
    { width: 2, stroke: '#b3b3b3' },
    { width: 3, stroke: '#808080' },
    { width: 4, stroke: '#4d4d4d' },
    { width: 5, stroke: '#d4af37' }
];

function drawCanvas() {
    ctx.clearRect(0, 0, width, height);
    ctx.save(); ctx.translate(camera.x, camera.y); ctx.scale(camera.zoom, camera.zoom);

    const viewRadius = Math.max(width, height) / camera.zoom / HEX_SIZE;
    const centerAxial = pixelToAxial(-camera.x / camera.zoom, -camera.y / camera.zoom);
    const range = Math.ceil(viewRadius);

    ctx.strokeStyle = '#ebebeb'; ctx.lineWidth = 1;
    for (let q = centerAxial.q - range; q <= centerAxial.q + range; q++) {
        for (let r = centerAxial.r - range; r <= centerAxial.r + range; r++) {
            const pos = axialToPixel(q, r);
            drawHexPath(pos.x, pos.y, HEX_SIZE); ctx.stroke();
        }
    }

    for (let [key, item] of grid.entries()) {
        const [q, r] = key.split(',').map(Number);
        const pos = axialToPixel(q, r);
        drawHexPath(pos.x, pos.y, HEX_SIZE);
        ctx.fillStyle = getPosColor(item.pos);
        ctx.fill();
    }

    for (let l = 2; l <= 5; l++) {
        let segments = [];
        const shift_mag = (l * 3 * 2 / sqrt3) / HEX_SIZE;

        for (let [key, item] of grid.entries()) {
            if (item.level < l) continue;
            const [q, r] = key.split(',').map(Number);
            const center = axialToPixel(q, r);
            const N = [];
            for (let i = 0; i < 6; i++) N[i] = getLevel(q + neighborDirs[i].q, r + neighborDirs[i].r) >= l;

            const P = [];
            for (let i = 0; i < 6; i++) {
                const angle = (i * 60 - 30) * Math.PI / 180;
                P[i] = { x: center.x + HEX_SIZE * Math.cos(angle), y: center.y + HEX_SIZE * Math.sin(angle) };
            }

            const V = [];
            for (let i = 0; i < 6; i++) {
                const prev = (i + 5) % 6, curr = i;
                if (N[prev] && N[curr]) V[i] = { x: P[i].x, y: P[i].y };
                else if (!N[prev] && !N[curr]) V[i] = { x: P[i].x + (center.x - P[i].x) * shift_mag, y: P[i].y + (center.y - P[i].y) * shift_mag };
                else {
                    const nDir = N[prev] ? curr : prev;
                    const n_center = axialToPixel(q + neighborDirs[nDir].q, r + neighborDirs[nDir].r);
                    V[i] = { x: P[i].x + (P[i].x - n_center.x) * shift_mag, y: P[i].y + (P[i].y - n_center.y) * shift_mag };
                }
            }
            for (let i = 0; i < 6; i++) if (!N[i]) segments.push({ start: V[i], end: V[(i + 1) % 6] });
        }

        const ptKey = (p) => Math.round(p.x * 10) + ',' + Math.round(p.y * 10);
        let unvisited = [...segments], loops = [];
        while (unvisited.length > 0) {
            let seg = unvisited.pop(), currentLoop = [seg.start], targetKey = ptKey(seg.end);
            while (true) {
                let nextIdx = unvisited.findIndex(s => ptKey(s.start) === targetKey);
                if (nextIdx === -1) break;
                let nextSeg = unvisited.splice(nextIdx, 1)[0];
                currentLoop.push(nextSeg.start); targetKey = ptKey(nextSeg.end);
                if (ptKey(nextSeg.end) === ptKey(currentLoop[0])) break;
            }
            loops.push(currentLoop);
        }

        if (loops.length > 0) {
            ctx.strokeStyle = contourStyles[l].stroke;
            ctx.lineWidth = contourStyles[l].width;
            ctx.beginPath();
            for (let loop of loops) {
                if (loop.length < 3) continue;
                const getMid = (p1, p2) => ({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 });
                let prevMid = getMid(loop[loop.length - 1], loop[0]);
                ctx.moveTo(prevMid.x, prevMid.y);
                for (let i = 0; i < loop.length; i++) {
                    let pt = loop[i], nextPt = loop[(i + 1) % loop.length], mid = getMid(pt, nextPt);
                    ctx.quadraticCurveTo(pt.x, pt.y, mid.x, mid.y);
                }
                ctx.closePath();
            }
            ctx.stroke();
        }
    }

    for (let [key, item] of grid.entries()) {
        const [q, r] = key.split(',').map(Number);
        const pos = axialToPixel(q, r);
        ctx.fillStyle = '#111111';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

        const words = item.word.split(' ');
        const maxWidth = HEX_SIZE * sqrt3 * 0.8;
        let fontSize = 20;
        ctx.font = `bold ${fontSize}px sans-serif`;
        while (fontSize > 8 && words.some(w => ctx.measureText(w).width > maxWidth)) {
            fontSize--;
            ctx.font = `bold ${fontSize}px sans-serif`;
        }
        const lineHeight = fontSize + 2;
        const totalHeight = words.length * lineHeight;

        words.forEach((line, i) => {
            const yOffset = pos.y - (totalHeight / 2) + (i * lineHeight) + (lineHeight / 2);
            ctx.fillText(line, pos.x, yOffset);
        });
    }
    ctx.restore();
}
