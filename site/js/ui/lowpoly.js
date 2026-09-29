// Low poly 模型與共用場景元素（《小王子》主題）
import * as THREE from 'three';

const cache = new Map();
export function mat(color, extra = {}) {
  const k = color + JSON.stringify(extra);
  if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0, ...extra }));
  return cache.get(k);
}
export function mesh(geo, color, extra, shadow = true) {
  const m = new THREE.Mesh(geo, mat(color, extra));
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}
export function jitter(geo, amt, ax = [1, 1, 1]) {
  const p = geo.attributes.position, seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${Math.round(p.getX(i) * 1000)}|${Math.round(p.getY(i) * 1000)}|${Math.round(p.getZ(i) * 1000)}`;
    let d = seen.get(k);
    if (!d) seen.set(k, (d = ax.map(a => (Math.random() - 0.5) * amt * a)));
    p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
  }
  geo.computeVertexNormals();
  return geo;
}
function put(parent, obj, x = 0, y = 0, z = 0) { obj.position.set(x, y, z); parent.add(obj); return obj; }

export function lights(scene, { ext = 8, center = new THREE.Vector3(), shadows = true } = {}) {
  scene.add(new THREE.HemisphereLight('#dfe6ff', '#3a3160', 1.5));
  const d = new THREE.DirectionalLight('#ffe7c2', 2.4);
  d.position.copy(center).add(new THREE.Vector3(5, 10, 6));
  d.target.position.copy(center);
  if (shadows) {
    d.castShadow = true;
    d.shadow.mapSize.set(1024, 1024);
    Object.assign(d.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 50 });
    d.shadow.camera.updateProjectionMatrix();
    d.shadow.bias = -0.001;
    d.shadow.normalBias = 0.02;
  }
  scene.add(d, d.target);
  return d;
}


// ---------- 領土格子：依等級改變外觀（簡潔：顏色 + 高度，4 級樹、5 級房子） ----------
const TOP = [null, '#d8c79a', '#b5d98a', '#86c663', '#5fae4f', '#4f9e45'];
const DIM_TOP = [null, '#8a8474', '#7d8a70', '#6c7d5f', '#5e7055', '#566a4e'];
export function tile(lv, dim = false) {
  const g = new THREE.Group();
  const h = 0.2 + lv * 0.08;
  put(g, mesh(new THREE.BoxGeometry(0.9, h, 0.9), dim ? '#5c6470' : '#8a93a6'), 0, -h / 2 - 0.04);
  put(g, mesh(new THREE.BoxGeometry(0.9, 0.08, 0.9), (dim ? DIM_TOP : TOP)[lv]), 0, 0);
  if (lv === 4) {
    put(g, mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.2, 5), '#7a5a3c'), 0.2, 0.14, -0.2);
    put(g, mesh(new THREE.ConeGeometry(0.2, 0.42, 6), dim ? '#4c6a45' : '#3f8f4a'), 0.2, 0.44, -0.2);
  }
  if (lv === 5) {
    put(g, mesh(new THREE.BoxGeometry(0.3, 0.22, 0.26), dim ? '#8f8778' : '#f3e3c3'), 0.15, 0.15, -0.15);
    put(g, mesh(new THREE.ConeGeometry(0.27, 0.2, 4), dim ? '#7a5a4a' : '#e07a3f'), 0.15, 0.36, -0.15).rotation.y = Math.PI / 4;
  }
  return g;
}
