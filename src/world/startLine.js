import * as THREE from 'three';

// The start and finish line the girls race from: a few traffic cones either side of the track, near the yard. Just
// something to look at (no collider), so a quad can drive straight through one.

const ORANGE = new THREE.MeshStandardMaterial({ color: 0xe8541a, roughness: 0.55 });
const WHITE = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.5 });
const BLACK = new THREE.MeshStandardMaterial({ color: 0x1d1d1d, roughness: 0.8 });

export function cone() {
  const g = new THREE.Group();
  const h = 0.5;
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.15, h, 14), ORANGE);
  body.position.y = h / 2 + 0.03;
  // A white band round the middle: a short cone section, sized to sit on the body's surface.
  const bandY = 0.3;
  const r = 0.15 * (1 - (bandY - 0.03) / h) + 0.004;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.012, r, 0.1, 14, 1, true), WHITE);
  band.position.y = bandY + 0.03;
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.34), BLACK);
  base.position.y = 0.015;
  for (const m of [body, band, base]) {
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

/**
 * Fraction round the track (0..1) of the point nearest to (x, z), for choosing where the start line goes.
 */
export function nearestTrackFraction(track, x, z, steps = 200) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < steps; i++) {
    const s = track.sample(i / steps);
    const d = Math.hypot(s.x - x, s.z - z);
    if (d < bestD) {
      bestD = d;
      best = i / steps;
    }
  }
  return best;
}

/** Cones either side of the track at fraction `u`, `halfWidth` out from its middle. Returns the group. */
export function buildStartLine(scene, heightAt, track, u, halfWidth) {
  const group = new THREE.Group();
  group.name = 'startLine';
  const s = track.sample(u);
  for (const side of [-1, 1]) {
    for (const along of [-0.6, 0.6]) {
      const out = halfWidth + 0.9;
      const x = s.x - s.tz * out * side + s.tx * along;
      const z = s.z + s.tx * out * side + s.tz * along;
      const c = cone();
      c.position.set(x, heightAt(x, z), z);
      group.add(c);
    }
  }
  scene.add(group);
  return group;
}

/** Cones either side of each gate of the hill climb (npc/hillClimb.js climbGates): two at the start and the finish, one at the ends of the gates between. */
export function buildClimbCones(scene, heightAt, gates) {
  const group = new THREE.Group();
  group.name = 'climbCones';
  gates.forEach((g, i) => {
    const end = i === 0 || i === gates.length - 1;
    for (const side of [-1, 1]) {
      for (const along of end ? [-0.6, 0.6] : [0]) {
        const x = g.x - g.tz * (g.half + 0.9) * side + g.tx * along;
        const z = g.z + g.tx * (g.half + 0.9) * side + g.tz * along;
        const c = cone();
        c.position.set(x, heightAt(x, z), z);
        group.add(c);
      }
    }
  });
  scene.add(group);
  return group;
}
