import * as THREE from 'three';

// The start and finish line the girls race from: a few traffic cones either side of the track, near the yard. Just
// something to look at (no collider), so a quad can drive straight through one.

const WHITE = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.5 });
const BLACK = new THREE.MeshStandardMaterial({ color: 0x1d1d1d, roughness: 0.8 });

// What a cone says: orange is any plain cone (Amy's course), green says START and blue says FINISH, so a start or a finish can be found across the
// farm. The word is painted on the band as well as the colour, for anyone who can't tell green from orange.
// The lap's and the strip's cones are a bit bigger than a plain cone so their lettering reads; the climbs' start and finish pairs bigger again.
export const LAP_SCALE = 1.4;

export const CONE_KINDS = {
  orange: { colour: 0xe8541a, word: null },
  start: { colour: 0x2e9a44, word: 'START' },
  finish: { colour: 0x1f6dcc, word: 'FINISH' },
};

const bodyMaterials = {};
const bandMaterials = {};

/** The band's lettering: the word twice, on opposite faces, so it reads from the way you ride in and as you ride out. Null with no canvas (tests). */
function bandMaterial(word) {
  if (!word) return WHITE;
  if (bandMaterials[word]) return bandMaterials[word];
  if (typeof document === 'undefined') return WHITE;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f2f2ee';
  ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = '#1d1d1d';
  ctx.font = '700 70px Arial Narrow, Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const x of [128, 384]) ctx.fillText(word, x, 51, word.length > 5 ? 168 : 140); // squeezed to under half way round, so a face reads from the side
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return (bandMaterials[word] = new THREE.MeshStandardMaterial({ map, roughness: 0.5 }));
}

/** A traffic cone of `kind` ('orange', 'start' or 'finish'). A lettered one has a wider band, lower down where the cone is wider, to fit the word. */
export function cone(kind = 'orange') {
  const k = CONE_KINDS[kind];
  const g = new THREE.Group();
  const h = 0.5;
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.15, h, 14), (bodyMaterials[kind] ??= new THREE.MeshStandardMaterial({ color: k.colour, roughness: 0.55 })));
  body.position.y = h / 2 + 0.03;
  // A white band round the middle: a short cone section, sized to sit on the body's surface.
  const bandY = k.word ? 0.2 : 0.3;
  const bandH = k.word ? 0.16 : 0.1;
  const r = 0.15 * (1 - (bandY - 0.03) / h) + 0.004;
  const slope = 0.15 / h; // how much the cone narrows per metre up
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r - slope * bandH / 2 - 0.002, r + slope * bandH / 2 + 0.004, bandH, 14, 1, true), bandMaterial(k.word));
  band.position.y = bandY + 0.03;
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.34), BLACK);
  base.position.y = 0.015;
  for (const m of [body, band, base]) {
    m.castShadow = true;
    g.add(m);
  }
  g.userData.kind = kind;
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
      const c = cone('start'); // the line by the yard is the start and the finish of a lap
      c.scale.setScalar(LAP_SCALE);
      c.rotation.y = Math.atan2(s.tx, s.tz) + Math.PI / 2; // the words are at local +-x, so turn them to face along the track
      c.position.set(x, heightAt(x, z), z);
      group.add(c);
    }
  }
  scene.add(group);
  return group;
}

/**
 * Cones for a climb's gates (npc/hillClimb.js climbGates), bigger than the lap's so they read from across the pasture: one plain pair (a cone
 * either side) at each gate between, and two pairs `box` m apart along the course at the start (green, START) and the finish (blue, FINISH),
 * larger again, to ride through like a gateway.
 */
export function buildClimbCones(scene, heightAt, gates, { scale = 1.8, endScale = 2.2, box = 3 } = {}) {
  const group = new THREE.Group();
  group.name = 'climbCones';
  gates.forEach((g, i) => {
    const end = i === 0 || i === gates.length - 1;
    const kind = i === 0 ? 'start' : end ? 'finish' : 'orange';
    for (const side of [-1, 1]) {
      for (const along of end ? [-box / 2, box / 2] : [0]) {
        const x = g.x - g.tz * (g.half + 0.5) * side + g.tx * along;
        const z = g.z + g.tx * (g.half + 0.5) * side + g.tz * along;
        const c = cone(kind);
        c.scale.setScalar(end ? endScale : scale);
        c.position.set(x, heightAt(x, z), z);
        // Face the lettering along the course, so the band's two words read riding in (and out).
        c.rotation.y = Math.atan2(g.tx, g.tz) + Math.PI / 2;
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
