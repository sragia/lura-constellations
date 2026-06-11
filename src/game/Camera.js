import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class FollowCamera {
  constructor(camera) {
    this.camera = camera;
    this.target = new THREE.Vector3();
    this.lookAt = new THREE.Vector3();
    this._offset = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this.planarForward = new THREE.Vector3();
    this.planarRight = new THREE.Vector3();
    this._worldUp = new THREE.Vector3(0, 1, 0);

    const { x, y, z } = CONFIG.cameraOffset;
    this.distance = Math.sqrt(x * x + y * y + z * z);
    const horizDist = Math.sqrt(x * x + z * z);
    this.yaw = Math.atan2(x, z);
    this.pitch = Math.atan2(y, horizDist);

    this.isDragging = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
    this.domElement = null;

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);

    this._updatePlanarBasis();
  }

  attach(domElement) {
    if (this.domElement) this.detach();
    this.domElement = domElement;
    domElement.addEventListener('pointerdown', this._onPointerDown);
    domElement.addEventListener('contextmenu', this._onContextMenu);
  }

  detach() {
    if (!this.domElement) return;
    this.domElement.removeEventListener('pointerdown', this._onPointerDown);
    this.domElement.removeEventListener('contextmenu', this._onContextMenu);
    this._endDrag();
    this.domElement = null;
  }

  _onContextMenu(e) {
    e.preventDefault();
  }

  _onPointerDown(e) {
    if (e.button !== 0) return;
    this.isDragging = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.domElement.classList.add('dragging');
    this.domElement.setPointerCapture(e.pointerId);
    this.domElement.addEventListener('pointermove', this._onPointerMove);
    this.domElement.addEventListener('pointerup', this._onPointerUp);
    this.domElement.addEventListener('pointercancel', this._onPointerUp);
  }

  _onPointerMove(e) {
    if (!this.isDragging) return;

    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    this.yaw -= dx * CONFIG.cameraOrbitSensitivity;
    this.pitch -= dy * CONFIG.cameraOrbitSensitivity;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch,
      CONFIG.cameraPitchMin,
      CONFIG.cameraPitchMax
    );
    this._updatePlanarBasis();
  }

  _onPointerUp(e) {
    if (e.button !== 0 && e.type === 'pointerup') return;
    this._endDrag();
  }

  _endDrag() {
    if (!this.isDragging || !this.domElement) return;
    this.isDragging = false;
    this.domElement.classList.remove('dragging');
    this.domElement.removeEventListener('pointermove', this._onPointerMove);
    this.domElement.removeEventListener('pointerup', this._onPointerUp);
    this.domElement.removeEventListener('pointercancel', this._onPointerUp);
  }

  _computeOffset() {
    const horizDist = this.distance * Math.cos(this.pitch);
    this._offset.set(
      horizDist * Math.sin(this.yaw),
      this.distance * Math.sin(this.pitch),
      horizDist * Math.cos(this.yaw)
    );
    return this._offset;
  }

  _updatePlanarBasis() {
    const offset = this._computeOffset();
    this.planarForward.set(-offset.x, 0, -offset.z);
    if (this.planarForward.lengthSq() < 1e-6) {
      this.planarForward.set(0, 0, -1);
    } else {
      this.planarForward.normalize();
    }
    this.planarRight.crossVectors(this.planarForward, this._worldUp).normalize();
  }

  update(playerX, playerZ) {
    this._updatePlanarBasis();
    this.target.set(playerX, 0, playerZ);
    this._desired.copy(this.target).add(this._offset);
    this.camera.position.copy(this._desired);
    this.lookAt.set(playerX, 0.5, playerZ);
    this.camera.lookAt(this.lookAt);
  }
}
