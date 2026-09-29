// 共用的 3D 畫布：只在所屬畫面顯示時才渲染，省電
import * as THREE from 'three';

export class Scene3D {
  constructor(container, { alpha = true, shadows = true } = {}) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.prepend(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();
    this.running = false;
    this.onFrame = null;
    new ResizeObserver(() => this.resize()).observe(container);
  }
  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h);
    this.onResize?.(w, h);
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.clock.getDelta();
    this.resize();
    this.renderer.setAnimationLoop(() => {
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.onFrame?.(dt, this.clock.elapsedTime);
      if (this.camera) this.renderer.render(this.scene, this.camera);
    });
  }
  stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }
  toScreen(v) {
    const p = v.clone().project(this.camera);
    return [((p.x + 1) / 2) * this.w, ((1 - p.y) / 2) * this.h, p.z];
  }
}
