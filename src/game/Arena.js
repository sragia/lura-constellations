import * as THREE from 'three';
import { CONFIG } from '../config.js';

function createFloorTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const cx = size / 2;
  const cy = size / 2;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
  grad.addColorStop(0, '#1a1230');
  grad.addColorStop(0.5, '#0e0a1a');
  grad.addColorStop(1, '#06040e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(120, 80, 180, 0.25)';
  ctx.lineWidth = 2;
  for (let r = 40; r < size / 2; r += 36) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(200, 160, 80, 0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * size / 2, cy + Math.sin(angle) * size / 2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export class Arena {
  constructor(scene) {
    this.radius = CONFIG.arenaRadius;
    const texture = createFloorTexture();

    const floorGeo = new THREE.CircleGeometry(this.radius, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.85,
      metalness: 0.15,
    });
    this.mesh = new THREE.Mesh(floorGeo, floorMat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);

    const ringGeo = new THREE.RingGeometry(this.radius - 0.3, this.radius, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x4433aa,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.02;
    scene.add(this.ring);
  }

  clampPosition(x, z) {
    const dist = Math.sqrt(x * x + z * z);
    if (dist <= this.radius - CONFIG.playerRadius) return { x, z };
    const scale = (this.radius - CONFIG.playerRadius) / dist;
    return { x: x * scale, z: z * scale };
  }
}
