export function circleCircleHit(ax, az, ar, bx, bz, br) {
  const dx = ax - bx;
  const dz = az - bz;
  const r = ar + br;
  return dx * dx + dz * dz < r * r;
}

export function pointSegmentHit(px, pz, ax, az, bx, bz, halfWidth) {
  const abx = bx - ax;
  const abz = bz - az;
  const lenSq = abx * abx + abz * abz;
  if (lenSq === 0) {
    const dx = px - ax;
    const dz = pz - az;
    return dx * dx + dz * dz < halfWidth * halfWidth;
  }
  let t = ((px - ax) * abx + (pz - az) * abz) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * abx;
  const cz = az + t * abz;
  const dx = px - cx;
  const dz = pz - cz;
  return dx * dx + dz * dz < halfWidth * halfWidth;
}
