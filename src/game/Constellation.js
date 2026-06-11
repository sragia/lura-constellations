import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { circleCircleHit, pointSegmentHit } from '../utils/collision.js';

const PHASE = {
  TELEGRAPH: 'telegraph',
  ACTIVE: 'active',
  CLEAR: 'clear',
};

function dist(x1, z1, x2, z2) {
  const dx = x1 - x2;
  const dz = z1 - z2;
  return Math.sqrt(dx * dx + dz * dz);
}

function orient(ax, az, bx, bz, cx, cz) {
  return (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
}

function segmentsCross(ax, az, bx, bz, cx, cz, dx, dz) {
  const o1 = orient(ax, az, bx, bz, cx, cz);
  const o2 = orient(ax, az, bx, bz, dx, dz);
  const o3 = orient(cx, cz, dx, dz, ax, az);
  const o4 = orient(cx, cz, dx, dz, bx, bz);
  if (o1 === 0 && o2 === 0 && o3 === 0 && o4 === 0) return false;
  return o1 * o2 < 0 && o3 * o4 < 0;
}

function edgesCross(stars, a, b, c, d) {
  if (a === c || a === d || b === c || b === d) return false;
  const sa = stars[a];
  const sb = stars[b];
  const sc = stars[c];
  const sd = stars[d];
  return segmentsCross(sa.x, sa.z, sb.x, sb.z, sc.x, sc.z, sd.x, sd.z);
}

function wouldCross(stars, edges, a, b) {
  for (const [c, d] of edges) {
    if (edgesCross(stars, a, b, c, d)) return true;
  }
  return false;
}

function wouldNewEdgeCross(stars, edges, parentIdx, x, z) {
  const ax = stars[parentIdx].x;
  const az = stars[parentIdx].z;
  for (const [c, d] of edges) {
    if (c === parentIdx || d === parentIdx) continue;
    const sc = stars[c];
    const sd = stars[d];
    if (segmentsCross(ax, az, x, z, sc.x, sc.z, sd.x, sd.z)) return true;
  }
  return false;
}

function hasCrossingEdges(stars, edges) {
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      if (edgesCross(stars, edges[i][0], edges[i][1], edges[j][0], edges[j][1])) {
        return true;
      }
    }
  }
  return false;
}

function isValidConstellation(stars, edges) {
  return stars.length > 0 && !hasCrossingEdges(stars, edges);
}

function hasSpacingFromOthers(stars, x, z, spacing, ignoreIdx = -1) {
  const minSq = spacing * spacing;
  for (let i = 0; i < stars.length; i++) {
    if (i === ignoreIdx) continue;
    const dx = x - stars[i].x;
    const dz = z - stars[i].z;
    if (dx * dx + dz * dz < minSq) return false;
  }
  return true;
}

function fitClusterToArena(stars, centerX, centerZ, arenaRadius) {
  const margin = CONFIG.starRadius + 0.5;
  const maxR = arenaRadius - margin;
  let shrink = 1;

  for (const s of stars) {
    const d = Math.sqrt(s.x * s.x + s.z * s.z);
    if (d > maxR) shrink = Math.min(shrink, maxR / d);
  }

  if (shrink >= 1) return stars;
  return stars.map((s) => ({
    x: centerX + (s.x - centerX) * shrink,
    z: centerZ + (s.z - centerZ) * shrink,
  }));
}

function placeNearParent(parent, stars, edges, playerX, playerZ, parentIdx, relax = 0) {
  const {
    linkDistanceMin,
    linkDistanceMax,
    minStarSpacing,
    spawnClusterRadius,
  } = CONFIG;
  const clusterRSq = spawnClusterRadius * spawnClusterRadius;
  const spacing = Math.max(2.5, minStarSpacing - relax);

  for (let attempt = 0; attempt < 160; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const d = linkDistanceMin + Math.random() * (linkDistanceMax - linkDistanceMin);
    const x = parent.x + Math.cos(angle) * d;
    const z = parent.z + Math.sin(angle) * d;

    const dx = x - playerX;
    const dz = z - playerZ;
    if (dx * dx + dz * dz > clusterRSq) continue;

    if (!hasSpacingFromOthers(stars, x, z, spacing, parentIdx)) continue;
    if (wouldNewEdgeCross(stars, edges, parentIdx, x, z)) continue;

    return { x, z };
  }
  return null;
}

function placeFromAnyParent(stars, edges, playerX, playerZ, preferredIdx) {
  const indices = stars.map((_, i) => i);
  indices.sort((a, b) => {
    if (a === preferredIdx) return -1;
    if (b === preferredIdx) return 1;
    return Math.random() - 0.5;
  });

  for (const relax of [0, 0.5, 1]) {
    for (const parentIdx of indices) {
      const pos = placeNearParent(
        stars[parentIdx],
        stars,
        edges,
        playerX,
        playerZ,
        parentIdx,
        relax
      );
      if (pos) return { pos, parentIdx };
    }
  }
  return null;
}

function pickStarCount() {
  const range = CONFIG.starCountMax - CONFIG.starCountMin + 1;
  return CONFIG.starCountMin + Math.floor(Math.random() * range);
}

function getDegree(edges, n) {
  const degree = new Array(n).fill(0);
  for (const [a, b] of edges) {
    degree[a]++;
    degree[b]++;
  }
  return degree;
}

function tryExtraLinks(stars, edges) {
  const n = stars.length;
  const degree = getDegree(edges, n);
  const linked = new Set(edges.map(([a, b]) => (a < b ? `${a}-${b}` : `${b}-${a}`)));

  for (let i = 0; i < n; i++) {
    if (Math.random() > CONFIG.extraLinkChance) continue;
    if (degree[i] >= CONFIG.maxStarDegree) continue;

    const neighbors = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const d = dist(stars[i].x, stars[i].z, stars[j].x, stars[j].z);
      if (d > CONFIG.linkDistanceMax) continue;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (linked.has(key)) continue;
      neighbors.push({ j, d });
    }
    neighbors.sort((a, b) => a.d - b.d);
    if (neighbors.length === 0) continue;

    const { j } = neighbors[0];
    if (degree[j] >= CONFIG.maxStarDegree) continue;
    if (wouldCross(stars, edges, i, j)) continue;

    edges.push([i, j]);
    linked.add(i < j ? `${i}-${j}` : `${j}-${i}`);
    degree[i]++;
    degree[j]++;
  }
}

function growSequentially(px, pz, count, arenaRadius, mode) {
  const stars = [];
  const edges = [];

  if (mode === 'starOnPlayer') {
    stars.push({ x: px, z: pz });
  } else if (mode === 'beamThrough') {
    const angle = Math.random() * Math.PI * 2;
    const half =
      CONFIG.linkDistanceMin * 0.5 +
      Math.random() * (CONFIG.linkDistanceMax - CONFIG.linkDistanceMin) * 0.5;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    stars.push({ x: px - cos * half, z: pz - sin * half });
    stars.push({ x: px + cos * half, z: pz + sin * half });
    edges.push([0, 1]);
  } else {
    const angle = Math.random() * Math.PI * 2;
    const r = CONFIG.minStarSpacing + Math.random() * 1.5;
    stars.push({ x: px + Math.cos(angle) * r, z: pz + Math.sin(angle) * r });
  }

  while (stars.length < count) {
    const stepCount =
      CONFIG.starsPerStepMin +
      Math.floor(
        Math.random() * (CONFIG.starsPerStepMax - CONFIG.starsPerStepMin + 1)
      );

    const lookback = Math.min(3, stars.length);
    let parentIdx = stars.length - 1 - Math.floor(Math.random() * lookback);
    let placedInStep = false;

    for (let s = 0; s < stepCount && stars.length < count; s++) {
      const placed = placeFromAnyParent(stars, edges, px, pz, parentIdx);
      if (!placed) break;

      const newIdx = stars.length;
      stars.push(placed.pos);
      edges.push([placed.parentIdx, newIdx]);
      parentIdx = newIdx;
      placedInStep = true;
    }

    if (!placedInStep) break;
  }

  let fails = 0;
  while (stars.length < count && fails < 120) {
    const preferredIdx =
      stars.length - 1 - Math.floor(Math.random() * Math.min(5, stars.length));
    const placed = placeFromAnyParent(stars, edges, px, pz, preferredIdx);
    if (!placed) {
      fails++;
      continue;
    }
    fails = 0;
    const newIdx = stars.length;
    stars.push(placed.pos);
    edges.push([placed.parentIdx, newIdx]);
  }

  tryExtraLinks(stars, edges);
  const fitted = fitClusterToArena(stars, px, pz, arenaRadius);
  return { stars: fitted, edges };
}

function isBetterConstellation(next, prev) {
  if (!prev) return true;
  const nextValid = isValidConstellation(next.stars, next.edges);
  const prevValid = isValidConstellation(prev.stars, prev.edges);
  if (nextValid !== prevValid) return nextValid;
  return next.stars.length > prev.stars.length;
}

function growSequentiallyWithRetries(px, pz, count, arenaRadius, mode) {
  let best = null;
  for (let attempt = 0; attempt < 24; attempt++) {
    const result = growSequentially(px, pz, count, arenaRadius, mode);
    if (result.stars.length >= count && isValidConstellation(result.stars, result.edges)) {
      return result;
    }
    if (isBetterConstellation(result, best)) best = result;
  }
  return best;
}

function wouldHitPlayer(px, pz, stars, edges) {
  const pr = CONFIG.playerRadius;
  for (const star of stars) {
    if (circleCircleHit(px, pz, pr, star.x, star.z, CONFIG.starRadius)) return true;
  }
  for (const [a, b] of edges) {
    const sa = stars[a];
    const sb = stars[b];
    if (
      pointSegmentHit(
        px,
        pz,
        sa.x,
        sa.z,
        sb.x,
        sb.z,
        CONFIG.beamHalfWidth + pr
      )
    ) {
      return true;
    }
  }
  return false;
}

function generateConstellation(px, pz, arenaRadius) {
  const count = pickStarCount();
  const mustThreat = Math.random() < CONFIG.playerThreatChance;
  let fallback = null;

  for (let attempt = 0; attempt < 40; attempt++) {
    const mode = mustThreat
      ? Math.random() < 0.5
        ? 'starOnPlayer'
        : 'beamThrough'
      : 'safe';
    const result = growSequentiallyWithRetries(px, pz, count, arenaRadius, mode);

    if (isBetterConstellation(result, fallback)) fallback = result;

    if (result.stars.length < CONFIG.starCountMin) continue;
    if (!isValidConstellation(result.stars, result.edges)) continue;
    if (!mustThreat && wouldHitPlayer(px, pz, result.stars, result.edges)) continue;

    return result;
  }

  return fallback ?? growSequentiallyWithRetries(px, pz, count, arenaRadius, 'safe');
}

function createSparkleTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.2, 'rgba(120,220,255,0.9)');
  grad.addColorStop(0.5, 'rgba(60,160,255,0.3)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(200,240,255,0.9)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * size * 0.42, cy + Math.sin(angle) * size * 0.42);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function createBeamMesh(ax, az, bx, bz) {
  const start = new THREE.Vector3(ax, 0.15, az);
  const end = new THREE.Vector3(bx, 0.15, bz);
  const dir = new THREE.Vector3().subVectors(end, start);
  const length = dir.length();
  const geo = new THREE.CylinderGeometry(
    CONFIG.beamHalfWidth,
    CONFIG.beamHalfWidth,
    length,
    8,
    1,
    true
  );
  const mat = new THREE.MeshStandardMaterial({
    color: 0x44ddff,
    emissive: 0x22aaff,
    emissiveIntensity: 1.2,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize()
  );
  return mesh;
}

export class Constellation {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.sparkleTex = createSparkleTexture();
    this.reset();
  }

  reset() {
    this.phase = null;
    this.phaseTime = 0;
    this.stars = [];
    this.edges = [];
    this.starMeshes = [];
    this.beamMeshes = [];
    this.particles = [];
    this.clusterCenterX = 0;
    this.clusterCenterZ = 0;
    this.clusterBoundaryRadius = 0;
    this.clear();
  }

  clear() {
    while (this.group.children.length) {
      const child = this.group.children[0];
      this.group.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    }
    this.starMeshes = [];
    this.beamMeshes = [];
    this.particles = [];
  }

  spawn(centerX, centerZ) {
    this.clear();
    const result = generateConstellation(centerX, centerZ, CONFIG.arenaRadius);
    this.stars = result.stars;
    this.edges = result.edges;
    this.clusterCenterX = centerX;
    this.clusterCenterZ = centerZ;
    this.clusterBoundaryRadius = this._computeBoundaryRadius();
    this.phase = PHASE.TELEGRAPH;
    this.phaseTime = 0;
    this.buildBoundaryVisual();
    this.buildTelegraphVisuals();
  }

  _computeBoundaryRadius() {
    let maxDist = 0;
    for (const star of this.stars) {
      maxDist = Math.max(
        maxDist,
        dist(star.x, star.z, this.clusterCenterX, this.clusterCenterZ)
      );
    }
    return Math.max(
      maxDist + CONFIG.clusterBoundaryPadding,
      CONFIG.spawnClusterRadius * 0.75
    );
  }

  buildBoundaryVisual() {
    const r = this.clusterBoundaryRadius;
    const cx = this.clusterCenterX;
    const cz = this.clusterCenterZ;

    const ringGeo = new THREE.RingGeometry(r - 0.2, r, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x991028,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    this.boundaryRing = new THREE.Mesh(ringGeo, ringMat);
    this.boundaryRing.rotation.x = -Math.PI / 2;
    this.boundaryRing.position.set(cx, 0.03, cz);

    this.group.add(this.boundaryRing);
  }

  buildTelegraphVisuals() {
    for (const star of this.stars) {
      const ringGeo = new THREE.RingGeometry(
        CONFIG.starRadius * 0.7,
        CONFIG.starRadius,
        32
      );
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x2244aa,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(star.x, 0.04, star.z);

      const discGeo = new THREE.CircleGeometry(CONFIG.starRadius * 0.65, 32);
      const discMat = new THREE.MeshBasicMaterial({
        color: 0x0a1848,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      });
      const disc = new THREE.Mesh(discGeo, discMat);
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(star.x, 0.03, star.z);

      const sparkleMat = new THREE.SpriteMaterial({
        map: this.sparkleTex,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sparkle = new THREE.Sprite(sparkleMat);
      sparkle.position.set(star.x, 1.2, star.z);
      sparkle.scale.set(1.8, 1.8, 1);

      this.group.add(disc, ring, sparkle);
      this.starMeshes.push({ disc, ring, sparkle, star, activeMesh: null });
      this.particles.push({ sprite: sparkle, baseY: 1.2, offset: Math.random() * Math.PI * 2 });
    }
  }

  buildActiveVisuals() {
    for (const entry of this.starMeshes) {
      if (entry.disc) {
        this.group.remove(entry.disc);
        entry.disc.geometry.dispose();
        entry.disc.material.dispose();
        entry.disc = null;
      }
      if (entry.ring) {
        this.group.remove(entry.ring);
        entry.ring.geometry.dispose();
        entry.ring.material.dispose();
        entry.ring = null;
      }

      const { x, z } = entry.star;
      const sphereGeo = new THREE.SphereGeometry(CONFIG.starRadius * 0.75, 16, 16);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: 0x0a0828,
        emissive: 0x111144,
        emissiveIntensity: 0.5,
        roughness: 0.4,
        metalness: 0.3,
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.set(x, CONFIG.starRadius * 0.5, z);

      const glowGeo = new THREE.SphereGeometry(CONFIG.starRadius * 0.95, 16, 16);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0x2266cc,
        transparent: true,
        opacity: 0.25,
        side: THREE.BackSide,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.copy(sphere.position);

      entry.sparkle.position.set(x, CONFIG.starRadius * 0.55, z);
      entry.sparkle.scale.set(2.2, 2.2, 1);

      this.group.add(sphere, glow);
      entry.activeMesh = { sphere, glow };
    }

    for (const [a, b] of this.edges) {
      const sa = this.stars[a];
      const sb = this.stars[b];
      const beam = createBeamMesh(sa.x, sa.z, sb.x, sb.z);
      this.group.add(beam);
      this.beamMeshes.push(beam);
    }
  }

  update(dt, elapsed) {
    if (!this.phase) return;

    this.phaseTime += dt;

    for (const p of this.particles) {
      p.sprite.position.y = p.baseY + Math.sin(elapsed * 3 + p.offset) * 0.25;
      p.sprite.material.opacity = 0.6 + Math.sin(elapsed * 5 + p.offset) * 0.3;
    }

    if (this.boundaryRing && this.isBoundaryActive()) {
      this.boundaryRing.material.opacity = 0.7 + Math.sin(elapsed * 4) * 0.15;
    }

    if (this.phase === PHASE.TELEGRAPH && this.phaseTime >= CONFIG.telegraphDuration) {
      this.phase = PHASE.ACTIVE;
      this.phaseTime = 0;
      this.buildActiveVisuals();
    } else if (this.phase === PHASE.ACTIVE) {
      const pulse = 0.85 + Math.sin(elapsed * 8) * 0.15;
      for (const beam of this.beamMeshes) {
        beam.material.emissiveIntensity = 1.2 * pulse;
        beam.material.opacity = 0.75 + Math.sin(elapsed * 6) * 0.15;
      }
      if (this.phaseTime >= CONFIG.activeDuration) {
        this.phase = PHASE.CLEAR;
        this.phaseTime = 0;
      }
    } else if (this.phase === PHASE.CLEAR) {
      const fade = Math.max(0, 1 - this.phaseTime / 0.5);
      for (const child of this.group.children) {
        if (child.material) {
          child.material.opacity = (child.material.userData.baseOpacity ?? child.material.opacity) * fade;
          if (!child.material.userData.baseOpacity) {
            child.material.userData.baseOpacity = child.material.opacity;
          }
        }
      }
      if (this.phaseTime >= 0.5) {
        this.clear();
        this.phase = null;
      }
    }
  }

  isTelegraph() {
    return this.phase === PHASE.TELEGRAPH;
  }

  isActive() {
    return this.phase === PHASE.ACTIVE;
  }

  isBoundaryActive() {
    return this.phase === PHASE.TELEGRAPH || this.phase === PHASE.ACTIVE;
  }

  isPlayerOutsideBoundary(px, pz, playerRadius) {
    if (!this.isBoundaryActive()) return false;
    const limit = this.clusterBoundaryRadius - playerRadius;
    const dx = px - this.clusterCenterX;
    const dz = pz - this.clusterCenterZ;
    return dx * dx + dz * dz > limit * limit;
  }

  checkCollision(px, pz, playerRadius) {
    if (this.phase !== PHASE.ACTIVE) return false;

    for (const star of this.stars) {
      if (circleCircleHit(px, pz, playerRadius, star.x, star.z, CONFIG.starRadius)) {
        return true;
      }
    }

    for (const [a, b] of this.edges) {
      const sa = this.stars[a];
      const sb = this.stars[b];
      if (pointSegmentHit(px, pz, sa.x, sa.z, sb.x, sb.z, CONFIG.beamHalfWidth + playerRadius)) {
        return true;
      }
    }

    return false;
  }
}
