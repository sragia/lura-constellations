import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Arena } from './Arena.js';
import { Player } from './Player.js';
import { FollowCamera } from './Camera.js';
import { Constellation } from './Constellation.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = 'playing';
    this.survivalTime = 0;
    this.spawnTimer = 0;
    this.elapsed = 0;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050510);
    this.scene.fog = new THREE.Fog(0x050510, 40, 80);

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
    this.followCamera = new FollowCamera(this.camera);
    this.followCamera.attach(canvas);

    const ambient = new THREE.AmbientLight(0x4040a0, 0.5);
    this.scene.add(ambient);
    const dir = new THREE.DirectionalLight(0x8888ff, 0.8);
    dir.position.set(10, 20, 10);
    dir.castShadow = true;
    this.scene.add(dir);

    this.arena = new Arena(this.scene);
    this.player = new Player(this.scene);
    this.constellation = new Constellation(this.scene);

    this.timerEl = document.getElementById('timer');
    this.phaseHintEl = document.getElementById('phase-hint');
    this.gameOverEl = document.getElementById('game-over');
    this.finalScoreEl = document.getElementById('final-score');
    this.restartBtn = document.getElementById('restart-btn');

    this.restartBtn.addEventListener('click', () => this.restart());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') this.restart();
    });
    window.addEventListener('resize', () => this.onResize());
  }

  restart() {
    this.state = 'playing';
    this.survivalTime = 0;
    this.spawnTimer = 0;
    this.elapsed = 0;
    this.player.reset();
    this.followCamera.update(this.player.x, this.player.z);
    this.player.updateMesh(this.followCamera.planarForward);
    this.constellation.reset();
    this.constellation.spawn(this.player.x, this.player.z);
    this.gameOverEl.classList.add('hidden');
    this.updateHud();
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  updateHud() {
    this.timerEl.textContent = `${this.survivalTime.toFixed(1)}s`;
    if (this.constellation.isTelegraph()) {
      this.phaseHintEl.textContent = 'Stars incoming…';
      this.phaseHintEl.classList.remove('hidden');
    } else {
      this.phaseHintEl.classList.add('hidden');
    }
  }

  die() {
    this.state = 'dead';
    this.finalScoreEl.textContent = `Survived ${this.survivalTime.toFixed(1)}s`;
    this.gameOverEl.classList.remove('hidden');
  }

  update(dt) {
    if (this.state !== 'playing') return;

    this.elapsed += dt;
    this.survivalTime += dt;
    this.spawnTimer += dt;

    if (this.spawnTimer >= CONFIG.spawnInterval) {
      this.spawnTimer -= CONFIG.spawnInterval;
      if (!this.constellation.phase) {
        this.constellation.spawn(this.player.x, this.player.z);
      }
    }

    if (!this.constellation.phase && this.spawnTimer < 0.05) {
      this.constellation.spawn(this.player.x, this.player.z);
    }

    const { planarForward, planarRight } = this.followCamera;
    this.player.update(dt, this.arena, planarForward, planarRight);
    this.constellation.update(dt, this.elapsed);
    this.followCamera.update(this.player.x, this.player.z);

    if (this.constellation.checkCollision(this.player.x, this.player.z, this.player.radius)) {
      this.die();
    }

    this.updateHud();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
