import * as THREE from 'three';
import { Parts } from './parts.js';

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
 * Cones for a climb's gates (npc/hillClimb.js climbGates), bigger than the lap's so they read from across the pasture: one pair (a cone
 * either side) at each gate, plain between, and larger again at the start (green, START) and the finish (blue, FINISH): a gate at each end, not a box.
 */
export function buildClimbCones(scene, heightAt, gates, { scale = 1.8, endScale = 2.2 } = {}) {
  const group = new THREE.Group();
  group.name = 'climbCones';
  gates.forEach((g, i) => {
    const end = i === 0 || i === gates.length - 1;
    const kind = i === 0 ? 'start' : end ? 'finish' : 'orange';
    for (const side of [-1, 1]) {
      const x = g.x - g.tz * (g.half + 0.5) * side;
      const z = g.z + g.tx * (g.half + 0.5) * side;
      const c = cone(kind);
      c.scale.setScalar(end ? endScale : scale);
      c.position.set(x, heightAt(x, z), z);
      // Face the lettering along the course, so the band's two words read riding in (and out).
      c.rotation.y = Math.atan2(g.tx, g.tz) + Math.PI / 2;
      group.add(c);
    }
  });
  scene.add(group);
  return group;
}

// A flag for the pit climb's gates (#685): on a wall of 30 to 47 degrees a cone stands plumb against the face and reads as lying flat, so the pit plants a
// pole in the ground instead, upright whatever the slope, with a cloth reaching in across the gate. The same colours and words as the cones.
export const FLAG = { pole: 0.03, height: 2.1, endHeight: 2.7, cloth: [0.8, 0.5], sink: 0.4, collar: 0.07 };

const poleMaterial = new THREE.MeshStandardMaterial({ color: 0xd9d4c6, roughness: 0.55, metalness: 0.25 });
const collarMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2825, roughness: 0.85 });
const clothMaterials = {};

/** A flag's cloth: its colour with the word across it, or two white stripes on the orange gates. Plain colour with no canvas (tests). */
function clothMaterial(kind) {
  if (clothMaterials[kind]) return clothMaterials[kind];
  const k = CONE_KINDS[kind];
  const colour = `#${k.colour.toString(16).padStart(6, '0')}`;
  let map = null;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, 256, 160);
    ctx.fillStyle = '#f2f2ee';
    if (k.word) {
      ctx.font = '700 64px Arial Narrow, Arial, Helvetica, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(k.word, 128, 84, 220);
    } else {
      ctx.fillRect(0, 46, 256, 14);
      ctx.fillRect(0, 100, 256, 14);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(0, 0, 256, 8); // a hem at the top and a darker one at the foot, as a sewn flag has
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 152, 256, 8);
    map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
  }
  return (clothMaterials[kind] = new THREE.MeshStandardMaterial({ color: map ? 0xffffff : k.colour, map, roughness: 0.8, side: THREE.DoubleSide }));
}

/**
 * Flags for a climb's gates (npc/hillClimb.js climbGates) in place of cones: a pole planted in the ground at each side of each gate, plumb whatever the
 * slope, a collar at its foot and a finial on top, and a cloth reaching in across the gate and facing along the course. Green at the start, blue at the
 * finish and orange between, with START and FINISH written on the cloth. The poles are taller at the two ends. One group, a few meshes (a set piece).
 */
export function buildClimbFlags(scene, heightAt, gates) {
  const parts = new Parts();
  gates.forEach((g, i) => {
    const end = i === 0 || i === gates.length - 1;
    const kind = i === 0 ? 'start' : end ? 'finish' : 'orange';
    const height = end ? FLAG.endHeight : FLAG.height;
    const [cw, ch] = FLAG.cloth;
    const cloth = clothMaterial(kind);
    for (const side of [-1, 1]) {
      const x = g.x - g.tz * (g.half + 0.5) * side;
      const z = g.z + g.tx * (g.half + 0.5) * side;
      const y = heightAt(x, z);
      parts.rod(poleMaterial, [x, y - FLAG.sink, z], [x, y + height, z], FLAG.pole, FLAG.pole * 0.8, 6);
      parts.add(collarMaterial, new THREE.CylinderGeometry(FLAG.collar, FLAG.collar * 1.3, 0.12, 8), x, y + 0.04, z);
      parts.add(cloth, new THREE.SphereGeometry(0.05, 8, 6), x, y + height + 0.04, z); // the finial, in the cloth's colour
      // The cloth hangs from the pole towards the middle of the gate, facing the way the course runs (so the word reads riding in), with a wave
      // that grows away from the pole.
      const plane = new THREE.PlaneGeometry(cw, ch, 6, 3);
      const pos = plane.getAttribute('position');
      for (let v = 0; v < pos.count; v++) {
        const away = Math.abs(pos.getX(v) - (side < 0 ? -cw / 2 : cw / 2)) / cw; // 0 at the pole, 1 at the free edge
        pos.setZ(v, Math.sin(away * 5 + pos.getY(v) * 3) * 0.05 * away);
      }
      plane.computeVertexNormals();
      const toward = [side * g.tz, -side * g.tx]; // the unit vector from the pole to the gate's middle
      parts.add(cloth, plane, x + (toward[0] * cw) / 2, y + height - ch / 2 - 0.1, z + (toward[1] * cw) / 2, 0, Math.atan2(-g.tx, -g.tz), 0);
    }
  });
  const group = parts.build({ castShadow: false });
  group.name = 'pitFlags';
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
