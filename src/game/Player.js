import * as THREE from 'three';
import { CONFIG } from '../config.js';

const KEYS = {
  w: 'forward',
  a: 'left',
  s: 'backward',
  d: 'right',
  ArrowUp: 'forward',
  ArrowLeft: 'left',
  ArrowDown: 'backward',
  ArrowRight: 'right',
};

export class Player {
  constructor(scene) {
    this.x = 0;
    this.z = 0;
    this.radius = CONFIG.playerRadius;
    this.speed = CONFIG.playerSpeed;
    this.keys = new Set();
    this._moveDir = new THREE.Vector3();

    const bodyGeo = new THREE.CapsuleGeometry(0.35, 0.5, 4, 8);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xc8a0ff,
      emissive: 0x402060,
      emissiveIntensity: 0.4,
    });
    this.mesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.mesh.position.y = 0.65;
    this.mesh.castShadow = true;

    const ringGeo = new THREE.RingGeometry(0.5, 0.65, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.05;

    const facingShape = new THREE.Shape();
    facingShape.moveTo(0, -0.55);
    facingShape.lineTo(-0.28, -0.12);
    facingShape.lineTo(0.28, -0.12);
    facingShape.closePath();
    const facingGeo = new THREE.ShapeGeometry(facingShape);
    const facingMat = new THREE.MeshBasicMaterial({
      color: 0x7ec8ff,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    this.facingIndicator = new THREE.Mesh(facingGeo, facingMat);
    this.facingIndicator.rotation.x = -Math.PI / 2;
    this.facingIndicator.position.y = 0.08;

    const noseGeo = new THREE.BoxGeometry(0.12, 0.12, 0.2);
    const noseMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x7ec8ff,
      emissiveIntensity: 0.6,
    });
    this.nose = new THREE.Mesh(noseGeo, noseMat);
    this.nose.position.set(0, 0.72, 0.38);

    this.group = new THREE.Group();
    this.group.add(this.mesh);
    this.group.add(this.ring);
    this.group.add(this.facingIndicator);
    this.group.add(this.nose);
    scene.add(this.group);

    window.addEventListener('keydown', (e) => {
      if (KEYS[e.key]) {
        this.keys.add(KEYS[e.key]);
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (KEYS[e.key]) this.keys.delete(KEYS[e.key]);
    });
  }

  reset() {
    this.x = 0;
    this.z = 0;
    this.keys.clear();
  }

  update(dt, arena, planarForward, planarRight) {
    let forward = 0;
    let strafe = 0;
    if (this.keys.has('forward')) forward += 1;
    if (this.keys.has('backward')) forward -= 1;
    if (this.keys.has('right')) strafe += 1;
    if (this.keys.has('left')) strafe -= 1;

    if (forward !== 0 || strafe !== 0) {
      this._moveDir
        .set(0, 0, 0)
        .addScaledVector(planarForward, forward)
        .addScaledVector(planarRight, strafe)
        .normalize();

      this.x += this._moveDir.x * this.speed * dt;
      this.z += this._moveDir.z * this.speed * dt;
      const clamped = arena.clampPosition(this.x, this.z);
      this.x = clamped.x;
      this.z = clamped.z;
    }

    this.updateMesh(planarForward);
  }

  updateMesh(planarForward) {
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = Math.atan2(planarForward.x, planarForward.z);
  }
}
