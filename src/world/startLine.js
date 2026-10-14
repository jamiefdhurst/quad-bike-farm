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

/**
 * Cones for the hill climb's gates (npc/hillClimb.js climbGates), bigger than the lap's so they read from across the pasture: one pair (a cone
 * either side) at each gate between, and two pairs `box` m apart along the course at the start and the finish, to ride through like a gateway.
 */
export function buildClimbCones(scene, heightAt, gates, { scale = 1.8, box = 3 } = {}) {
  const group = new THREE.Group();
  group.name = 'climbCones';
  gates.forEach((g, i) => {
    const end = i === 0 || i === gates.length - 1;
    for (const side of [-1, 1]) {
      for (const along of end ? [-box / 2, box / 2] : [0]) {
        const x = g.x - g.tz * (g.half + 0.5) * side + g.tx * along;
        const z = g.z + g.tx * (g.half + 0.5) * side + g.tz * along;
        const c = cone();
        c.scale.setScalar(scale);
        c.position.set(x, heightAt(x, z), z);
        group.add(c);
      }
    }
  });
  scene.add(group);
  return group;
}

/**
 * The cone course's cones (npc/coneCourse.js coneSpots), one group each so a knocked one can be tipped over. Returns { group, cones }, the
 * cones in the order of `spots`. `lay` tips cone i by `fall` (0 up, 1 flat) away along (dx, dz).
 */
export function buildConeCourse(scene, heightAt, spots, { scale = 1.4 } = {}) {
  const group = new THREE.Group();
  group.name = 'coneCourse';
  const cones = spots.map((s) => {
    const pivot = new THREE.Group(); // at the cone's foot, so it tips about its base
    const c = cone();
    c.scale.setScalar(scale);
    pivot.add(c);
    pivot.position.set(s.x, heightAt(s.x, s.z), s.z);
    group.add(pivot);
    return pivot;
  });
  scene.add(group);
  return { group, cones };
}

/** Tips a cone's pivot over by `fall` (0 standing, 1 on its side) in the direction (dx, dz), settling a little off the ground. */
export function layCone(pivot, fall, dx, dz) {
  pivot.rotation.set(0, 0, 0);
  if (fall <= 0) return;
  const a = fall * (Math.PI / 2 - 0.1);
  pivot.rotation.order = 'YXZ';
  pivot.rotation.y = Math.atan2(dx, dz);
  pivot.rotation.x = a; // after the yaw, local +z is the way it falls
}
