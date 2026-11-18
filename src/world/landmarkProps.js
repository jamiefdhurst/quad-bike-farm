// The field landmarks (#815): one thing in each field that is its own and can be seen from its gate. Eight are built here from `layout.fieldLandmarks`
// (layoutNew.js): the lone oak, the old gateposts, the dead elm, Far Field's pond and willows, the cast-iron roller, the lone ash, the alders along the
// brook and the big oaks. The line, the barn, the hut and rock and the pillar only have their place there (fieldLandmarks.js `BUILT_KINDS`).
//
// The kit at the top (`limb`, `grow`, `foliage`, `ivy`, `sticks`, `groundDisc`) is for any tree or worn patch the next items build: #683's veteran oak, #682's oak on the
// rise and #684's hawthorn start from it. A landmark is two things: the group named for its kind (a `SET_PIECE_NAMES` entry), which holds the small detail
// (ivy, sticks, worn ground, reeds, fallen limbs) and is drawn within `setPieceDistance`, and for a tree or the pond a `userData.body`, its trunk, boughs and
// crown or its water, which goes in the scene on its own and is drawn like the farm's other trees, so a tree stays in sight from the gate.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { enableShadows } from './assets.js';
import { tiledInstances } from './tiledInstances.js';
import { worldBox } from './outbuildingProps.js';
import { frondGeometry, matrixAt } from './hillProps.js';
import { willowGeometry } from './riverProps.js';
import { gritstoneTexture, wornEarthTexture } from './landmarkTextures.js';
import { barkTexture } from './neighbourTextures.js';
import { rustTexture } from './quarryTextures.js';
import { boltsMesh, boltCircle } from '../vehicle/detail/fixings.js';
import { POND } from './fieldLandmarks.js';

const UP = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);
const TAU = Math.PI * 2;

const std = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0, ...extra });
/** The landmarks' textures, drawn the first time a landmark needs them and kept on the context. */
const texturesOf = (c) => (c.landmarkTextures ??= landmarkTextures(c.random));
const leafMaterial = () => new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true });

// ---- The kit ----

/** A tapering limb from `a` (radius r0) to `b` (radius r1) with its texture laid in metres along it and round it: a tile is a metre of bark. */
export function limb(a, b, r0, r1, radial = 7) {
  const len = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(r1, r0, len, radial, 1);
  const uv = geo.getAttribute('uv');
  const round = Math.max(0.3, Math.PI * (r0 + r1));
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * round, uv.getY(i) * len);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize()));
  const mid = a.clone().add(b).multiplyScalar(0.5);
  return geo.translate(mid.x, mid.y, mid.z);
}

/** `d` turned `angle` away from itself round the way `az` points: a branch leaving its parent. */
function kick(d, angle, az) {
  const side = new THREE.Vector3().crossVectors(d, Math.abs(d.y) > 0.9 ? X : UP).normalize().applyAxisAngle(d, az);
  return d.clone().multiplyScalar(Math.cos(angle)).addScaledVector(side, Math.sin(angle)).normalize();
}

/**
 * A tree's boughs as segments { a, b, r0, r1 } and the points they end at: a trunk of `length` m and `radius`, forking `fork` ways, then two or three at each
 * of `levels` more, each shorter by `shrink`, leaning `upward` (0..1) towards the sky. `snap` of the branches stop short in a broken stub. `dir` is the
 * trunk's way (a lean). `lengths`, one for each level from the trunk down, sets how long each is outright (times a little give or take) in place of `length` and `shrink`.
 */
export function grow(random, { base = new THREE.Vector3(), dir = UP, length, lengths = null, radius, taper = 0.62, levels, fork = 3, spread = 0.5, upward = 0.3, shrink = 0.72, snap = 0 }) {
  const segs = [];
  const tips = [];
  const walk = (a, d, len, r, depth) => {
    const b = a.clone().addScaledVector(d, len);
    segs.push({ a, b, r0: r, r1: r * taper });
    if (depth >= levels) {
      tips.push({ at: b, dir: d, r: r * taper });
      return;
    }
    const n = depth === 0 ? fork : 2 + (random() < 0.35 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      if (depth >= 1 && random() < snap) {
        const stub = kick(d, spread * 1.3, random() * TAU);
        segs.push({ a: b, b: b.clone().addScaledVector(stub, len * (0.2 + random() * 0.25)), r0: r * taper * 0.7, r1: r * taper * 0.5 });
        continue;
      }
      const next = kick(d, spread * (0.6 + random() * 0.8), (i / n) * TAU + random() * 1.2).lerp(UP, upward).normalize();
      walk(b, next, (lengths ? lengths[depth + 1] : len * shrink) * (0.85 + random() * 0.3), r * taper * 0.85, depth + 1);
    }
  };
  walk(base, dir.clone().normalize(), lengths ? lengths[0] : length, radius, 0);
  return { segs, tips };
}

/** The segments of `grow` as one bark-textured geometry. */
export const bough = (segs, radial = 7) => mergeGeometries(segs.map((s) => limb(s.a, s.b, s.r0, s.r1, radial)));

/** Colours a geometry with a base colour and a light-to-dark shading by how far up each point faces, so a clump of leaves is not one flat tone. */
function paint(geo, hex, random, jitter = 0.12) {
  const base = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const normal = geo.attributes.normal;
  const a = new Float32Array(n * 3);
  const shade = 1 + (random() - 0.5) * jitter * 2;
  for (let i = 0; i < n; i++) {
    const k = shade * (0.82 + 0.3 * (normal ? normal.getY(i) * 0.5 + 0.5 : 0.5));
    a[i * 3] = Math.min(1, base.r * k);
    a[i * 3 + 1] = Math.min(1, base.g * k);
    a[i * 3 + 2] = Math.min(1, base.b * k);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

/** Clumps of leaves at `centres` (Vector3s), `radius` m each give or take, flattened by `flat`, in `colours`: one shaded merged geometry. */
export function foliage(random, centres, radius, colours, flat = 0.7, detail = 1) {
  if (!centres.length) return new THREE.BufferGeometry();
  return mergeGeometries(centres.map((p) => {
    const g = new THREE.IcosahedronGeometry(radius * (0.7 + random() * 0.6), detail);
    g.scale(1.2, flat, 1.2);
    g.rotateY(random() * TAU);
    g.translate(p.x, p.y, p.z);
    return paint(g.index ? g.toNonIndexed() : g, colours[Math.floor(random() * colours.length)], random);
  }));
}

/** Ivy up one side of a trunk between heights `y0` and `y1`: dark green clumps hugging it, round the way `side` points. `radius` is the trunk's, in metres, or a function of the height. */
export function ivy(random, radius, y0, y1, side = 0) {
  const clumps = [];
  const n = Math.round((y1 - y0) * 9);
  const radiusAt = typeof radius === 'function' ? radius : () => radius;
  for (let i = 0; i < n; i++) {
    const a = side + (random() - 0.5) * 1.9;
    const y = y0 + (y1 - y0) * Math.pow(random(), 0.8);
    const r = radiusAt(y) * (1.02 + random() * 0.08);
    clumps.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  return foliage(random, clumps, 0.17, ['#2f4a26', '#3b5a2c', '#27401f'], 0.6, 0);
}

/** Sticks lying on the ground over `spread` m: `n` of them, bark-textured, each tipped a little off the flat. */
export function sticks(random, n, spread, length = [0.4, 1.3]) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const yaw = random() * TAU;
    const len = length[0] + random() * (length[1] - length[0]);
    const r = 0.014 + random() * 0.026;
    const x = (random() - 0.5) * spread;
    const z = (random() - 0.5) * spread;
    const a = new THREE.Vector3(x, 0.05 + random() * 0.04, z);
    parts.push(limb(a, a.clone().add(new THREE.Vector3(Math.cos(yaw) * len, random() * 0.08, Math.sin(yaw) * len)), r, r * 0.7, 5));
  }
  return mergeGeometries(parts);
}

/**
 * A thin patch of `map` laid over the ground at (x, z), following it: an ellipse `rx` by `rz` m in rings of vertices each at the ground's height there
 * (so it never sinks into a slope or floats over a dip), a few millimetres above it, fading to nothing at its rim by the map's own alpha. The mesh is
 * positioned at `origin` ({ x, y, z }), so it goes in a group at the world's origin, never one that is itself placed at the spot.
 */
export function groundDisc(heights, origin, rx, rz, map, { rings = 4, segs = 24, lift = 0.025 } = {}) {
  const pos = [];
  const uv = [];
  const index = [];
  pos.push(0, heights.heightAt(origin.x, origin.z) - origin.y + lift, 0);
  uv.push(0.5, 0.5);
  for (let r = 1; r <= rings; r++) {
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * TAU;
      const k = r / rings;
      const x = Math.cos(a) * rx * k;
      const z = Math.sin(a) * rz * k;
      pos.push(x, heights.heightAt(origin.x + x, origin.z + z) - origin.y + lift, z);
      uv.push(0.5 + Math.cos(a) * 0.5 * k, 0.5 + Math.sin(a) * 0.5 * k);
    }
  }
  for (let s = 0; s < segs; s++) index.push(0, 1 + ((s + 1) % segs), 1 + s);
  for (let r = 1; r < rings; r++) {
    for (let s = 0; s < segs; s++) {
      const a = 1 + (r - 1) * segs + s;
      const b = 1 + (r - 1) * segs + ((s + 1) % segs);
      index.push(a, b, a + segs, b, b + segs, a + segs);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(origin.x, origin.y, origin.z);
  mesh.receiveShadow = true;
  mesh.userData.noShadow = true;
  return mesh;
}

/** A trunk collider like the oaks' (hillProps.js `buildMeadowTrees`): a cylinder you cannot ride through, and a post the winch can hook. */
function trunk(c, x, y, z, r, h) {
  c.physics.createCollider(c.RAPIER.ColliderDesc.cylinder(h / 2, r).setTranslation(x, y + h / 2, z));
  c.anchors?.push({ x, y, z, r });
}

/** Shadows on for everything in a landmark but its ground patches, the water and the duckweed, which lie flat on the ground. */
function finish(group) {
  enableShadows(group);
  group.traverse((o) => {
    if (o.userData.noShadow) o.castShadow = false;
  });
}


const mesh = (geo, material, name) => {
  const m = new THREE.Mesh(geo, material);
  if (name) m.name = name;
  return m;
};

/** A child group of `parent` standing on the ground at (x, z), turned `yaw`, for local parts. */
function standing(parent, c, x, z, yaw = 0) {
  const g = new THREE.Group();
  g.position.set(x, c.heights.heightAt(x, z), z);
  g.rotation.y = yaw;
  parent.add(g);
  return g;
}

/** A landmark's group (named for its kind, within `setPieceDistance`) and the body that is always drawn beside it: both stand on the ground at (x, z), turned `yaw`. */
function placed(group, body, c, x, z, yaw = 0) {
  return { detail: standing(group, c, x, z, yaw), bark: standing(body, c, x, z, yaw) };
}

// ---- Oaks ----

/** The leaf colours of an oak and of an ash: dark and light greens, so a crown is not one tone. */
const OAK_LEAVES = ['#4a6b2a', '#567a30', '#3f5d26', '#617f33'];

/**
 * A field oak at (x, z) `s` times a big oak's size (a bole 1.1 m across, a domed crown about 20 m across and 12 m high at 1): a short bole forking into five
 * boughs that sweep out almost level, clumps of leaves along them, a few bare dead tips, a burr, a broken stub, ivy up one side, a worn ring of earth, and
 * a limb that came down in a gale lying under it. `hollow` cuts a hollow in the bole. The trunk is a collider the winch can hook.
 */
function fieldOak(c, group, body, x, z, s, { hollow = false, ivySide = 0, name = 'fieldOak' } = {}) {
  const { heights, random } = c;
  const T = texturesOf(c);
  const y = heights.heightAt(x, z);
  const { detail, bark } = placed(group, body, c, x, z);
  bark.name = name; // so a shot can be framed on one oak
  const R = 0.55 * s;
  const taper = 0.78;
  const bole = 2.8 * s;
  const { segs, tips } = grow(random, { lengths: [bole, 4.6 * s, 4.0 * s, 3.0 * s], radius: R, taper, levels: 3, fork: 5, spread: 1.0, upward: 0.1, snap: 0.07 });
  const radiusAt = (h) => R * (1 - (1 - taper) * Math.min(1, h / bole));
  const parts = segs.map((sg) => limb(sg.a, sg.b, sg.r0, sg.r1, 8));
  parts.push(limb(new THREE.Vector3(0, -0.25, 0), new THREE.Vector3(0, 0.9 * s, 0), R * 1.45, radiusAt(0.9 * s), 10)); // the flare at the foot
  // A burr on the bole, on the side away from the ivy, and bare dead tips with no leaves on them.
  const away = ivySide + Math.PI;
  const burr = new THREE.SphereGeometry(0.3 * s, 8, 6);
  burr.scale(1, 1.3, 1);
  parts.push(burr.translate(Math.cos(away + 0.9) * radiusAt(1.5 * s) * 0.95, 1.5 * s, Math.sin(away + 0.9) * radiusAt(1.5 * s) * 0.95));
  const dead = tips.filter(() => random() < 0.14);
  for (const t of dead) parts.push(limb(t.at, t.at.clone().addScaledVector(t.dir, 1.6 * s), t.r, t.r * 0.3, 6));
  bark.add(mesh(mergeGeometries(parts), std(T.bark.oak), 'oakBark'));
  const live = tips.filter((t) => !dead.includes(t)).map((t) => t.at);
  const along = segs.filter((sg) => sg.b.y > bole + 0.5).map((sg) => sg.b);
  const centres = [...live, ...along].map((p) => p.clone().add(new THREE.Vector3((random() - 0.5) * 1.2, (random() - 0.3) * 0.8, (random() - 0.5) * 1.2)));
  bark.add(mesh(foliage(random, centres, 2.1 * s, OAK_LEAVES, 0.7), leafMaterial(), 'oakLeaves'));
  detail.add(mesh(ivy(random, radiusAt, 0.2, 2.4 * s, ivySide), leafMaterial(), 'oakIvy'));
  if (hollow) {
    const cave = new THREE.SphereGeometry(0.22 * s, 10, 6);
    cave.scale(0.55, 1.5, 0.9);
    cave.rotateY(-away);
    cave.translate(Math.cos(away) * radiusAt(0.9 * s) * 1.0, 0.9 * s, Math.sin(away) * radiusAt(0.9 * s) * 1.0);
    detail.add(mesh(cave, new THREE.MeshStandardMaterial({ color: 0x120d08, roughness: 1 }), 'hollow'));
  }
  group.add(groundDisc(heights, detail.position, 6.5 * s, 6.5 * s, T.earth));
  // The limb that came down, with sticks round it.
  const yaw = random() * TAU;
  const from = new THREE.Vector3(Math.cos(yaw) * R * 2.4, 0.12, Math.sin(yaw) * R * 2.4);
  const to = from.clone().add(new THREE.Vector3(Math.cos(yaw + 0.3) * 4.2 * s, 0.05, Math.sin(yaw + 0.3) * 4.2 * s));
  const side = (dy, dx, dz, r0) => limb(from.clone().lerp(to, 0.3).add(new THREE.Vector3(0, 0.1, 0)), from.clone().lerp(to, 0.3).add(new THREE.Vector3(dx, dy, dz)), r0, r0 * 0.4, 6);
  const fallen = mergeGeometries([limb(from, to, 0.24, 0.1, 8), side(0.7, 0.3, 0.9, 0.09), side(0.55, -0.4, -0.8, 0.08), side(0.5, 0.2, 0.7, 0.07)]);
  detail.add(mesh(fallen, std(T.bark.oak), 'fallenLimb'));
  detail.add(mesh(sticks(random, 14, 6 * s), std(T.bark.oak), 'oakSticks'));
  trunk(c, x, y, z, R * 1.05, 6 * s);
}

/** North Field's lone oak, a big one in mid-field with the ring of bare earth stock have made sheltering under it. */
export function buildLoneOak(c, spot) {
  const group = new THREE.Group();
  group.name = 'loneOak';
  const body = new THREE.Group();
  group.userData.body = body;
  fieldOak(c, group, body, spot.at[0], spot.at[1], 1, { ivySide: 0.8 });
  finish(group);
  finish(body);
  return group;
}

/**
 * Hollow Wood's veteran oak (#683): a field oak with a hollow in its bole, in the glade north of the pond, so one tree stands over the wood from the gate.
 * Its crown is about 20 m across and 12 m high, more than twice the size of the wood's oaks (4 to 8 m across), and the ground beneath it is bare.
 */
export function buildVeteranOak(c, spot) {
  const group = new THREE.Group();
  group.name = 'veteranOak';
  const body = new THREE.Group();
  group.userData.body = body;
  fieldOak(c, group, body, spot.at[0], spot.at[1], 1, { hollow: true, ivySide: 2.4, name: 'veteranOak' });
  finish(group);
  finish(body);
  return group;
}

/** Brook Meadow's big old oaks: four, a little smaller and bigger than each other, one with a hollow in its bole, bare ground and a fallen limb under each. */
export function buildBigOaks(c, spot) {
  const group = new THREE.Group();
  group.name = 'bigOaks';
  const body = new THREE.Group();
  group.userData.body = body;
  spot.trees.forEach(([x, z], i) => fieldOak(c, group, body, x, z, [1.15, 1.0, 1.25, 1.1][i % 4], { hollow: i === 1, ivySide: i * 1.7, name: 'bigOak' }));
  finish(group);
  finish(body);
  return group;
}

// ---- The lone ash ----

/** Hay Meadow's lone ash: a tall open crown of upward-curving limbs on a straight pale trunk, leaves only at the ends. */
export function buildLoneAsh(c, spot) {
  const { random, heights } = c;
  const group = new THREE.Group();
  group.name = 'loneAsh';
  const body = new THREE.Group();
  group.userData.body = body;
  const [x, z] = spot.at;
  const y = heights.heightAt(x, z);
  const { detail, bark } = placed(group, body, c, x, z);
  const { segs, tips } = grow(random, { length: 4.2, radius: 0.46, taper: 0.72, levels: 3, fork: 5, spread: 0.62, upward: 0.3, shrink: 0.8 });
  bark.add(mesh(bough(segs), std(texturesOf(c).bark.ash), 'ashBark'));
  // The flare where the trunk meets the ground, and the root buttresses.
  bark.add(mesh(limb(new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(0, 0.8, 0), 0.52, 0.37, 8), std(texturesOf(c).bark.ash), 'ashFoot'));
  // Leaves: airy clumps at the ends of the limbs, so the sky shows through.
  const centres = segs.filter((sg) => sg.b.y > 5.2).map((sg) => sg.b.clone().add(new THREE.Vector3((random() - 0.5) * 0.8, (random() - 0.2) * 0.6, (random() - 0.5) * 0.8)));
  bark.add(mesh(foliage(random, centres, 0.95, ['#5d7f36', '#6c8a3a', '#527232', '#78953f'], 0.62), leafMaterial(), 'ashLeaves'));
  // Keys: bunches of seeds hanging from the tips, pale green going to brown.
  const keys = tips.map((t) => t.at.clone().add(new THREE.Vector3((random() - 0.5) * 0.8, -0.5, (random() - 0.5) * 0.8)));
  bark.add(mesh(foliage(random, keys, 0.22, ['#a49a5a', '#8f8a4c'], 1.6, 0), leafMaterial(), 'ashKeys'));
  group.add(groundDisc(heights, detail.position, 4.2, 4.2, texturesOf(c).earth));
  detail.add(mesh(sticks(random, 10, 6, [0.3, 1.0]), std(texturesOf(c).bark.ash), 'ashTwigs'));
  trunk(c, x, y, z, 0.38, 5);
  finish(group);
  finish(body);
  return group;
}

// ---- The dead elm ----

/** Long Piece's dead elm: a grey barkless trunk and a bleached forked crown of bare limbs, snapped stubs, ivy the only green and a hole in the bole. */
export function buildDeadElm(c, spot) {
  const { random, heights } = c;
  const group = new THREE.Group();
  group.name = 'deadElm';
  const body = new THREE.Group();
  group.userData.body = body;
  const [x, z] = spot.at;
  const y = heights.heightAt(x, z);
  const { detail, bark } = placed(group, body, c, x, z);
  const R = 0.5;
  const taper = 0.7;
  const trunkLength = 4.8;
  const { segs } = grow(random, { dir: new THREE.Vector3(0.05, 1, 0.03), length: trunkLength, radius: R, taper, levels: 4, fork: 4, spread: 0.62, upward: 0.25, shrink: 0.74, snap: 0.3 });
  const radiusAt = (h) => R * (1 - (1 - taper) * Math.min(1, h / trunkLength));
  bark.add(mesh(bough(segs, 8), std(texturesOf(c).bark.elm), 'elmBark'));
  bark.add(mesh(limb(new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(0, 0.9, 0), 0.62, radiusAt(0.9), 8), std(texturesOf(c).bark.elm), 'elmFoot'));
  // A hanging limb, snapped and held by a strip of bark.
  const hangFrom = segs.find((sg) => sg.a.y > 5 && sg.a.y < 8)?.b ?? new THREE.Vector3(0, 7, 0);
  bark.add(mesh(limb(hangFrom, hangFrom.clone().add(new THREE.Vector3(0.9, -1.8, 0.3)), 0.07, 0.04, 6), std(texturesOf(c).bark.elm), 'elmHanging'));
  // Ivy up the lower trunk on one side, the only green on it, and a dark hole where a limb rotted out.
  detail.add(mesh(ivy(random, radiusAt, 0.3, 4.2, 0.6), leafMaterial(), 'elmIvy'));
  const hole = new THREE.SphereGeometry(0.2, 10, 6);
  hole.scale(0.5, 1.4, 0.9);
  hole.rotateY(-(Math.PI + 0.9));
  hole.translate(Math.cos(Math.PI + 0.9) * radiusAt(2.4), 2.4, Math.sin(Math.PI + 0.9) * radiusAt(2.4));
  detail.add(mesh(hole, new THREE.MeshStandardMaterial({ color: 0x100c08, roughness: 1 }), 'elmHole'));
  detail.add(mesh(sticks(random, 18, 5, [0.4, 1.6]), std(texturesOf(c).bark.elm), 'elmSticks'));
  trunk(c, x, y, z, 0.5, 5);
  finish(group);
  finish(body);
  return group;
}

// ---- Alders along the brook ----

/** Low Ley's alders: a line along the brook, each with two or three stems from the base, dark rounded crowns and cones, roots into the water. */
export function buildAlders(c, spot) {
  const { random, heights } = c;
  const group = new THREE.Group();
  group.name = 'brookAlders';
  const body = new THREE.Group();
  group.userData.body = body;
  const barkMat = std(texturesOf(c).bark.alder);
  spot.trees.forEach(([x, z], i) => {
    const y = heights.heightAt(x, z);
    const turn = random() * TAU;
    const { detail, bark } = placed(group, body, c, x, z, turn);
    bark.name = i === Math.floor(spot.trees.length / 2) ? 'brookAlder' : 'alder'; // the middle one is the spot `at` names
    const stems = 2 + (i % 2);
    const segs = [];
    const centres = [];
    const cones = [];
    for (let k = 0; k < stems; k++) {
      const a = (k / stems) * TAU + random();
      const base = new THREE.Vector3(Math.cos(a) * 0.28, -0.1, Math.sin(a) * 0.28);
      const dir = kick(UP, 0.18 + random() * 0.2, a);
      const grown = grow(random, { base, dir, length: 2.6 + random() * 0.8, radius: 0.18, taper: 0.68, levels: 2, fork: 1, spread: 0.55, upward: 0.4, shrink: 0.75 });
      segs.push(...grown.segs);
      for (const t of grown.tips) {
        centres.push(t.at.clone(), t.at.clone().addScaledVector(t.dir, -0.7));
        if (random() < 0.7) cones.push(t.at.clone().add(new THREE.Vector3((random() - 0.5) * 0.8, -0.3 - random() * 0.4, (random() - 0.5) * 0.8)));
      }
    }
    bark.add(mesh(bough(segs), barkMat, 'alderBark'));
    bark.add(mesh(foliage(random, centres, 1.05, ['#3f5c2c', '#37532a', '#476533'], 0.8), leafMaterial(), 'alderLeaves'));
    if (cones.length) bark.add(mesh(foliage(random, cones, 0.07, ['#4b3a2c', '#3c2f24'], 1.5, 0), leafMaterial(), 'alderCones'));
    // The roots reach out and down at the foot of the bank.
    const roots = [0, 1, 2].map((r) => {
      const a = i * 0.9 + r * 2.1;
      return limb(new THREE.Vector3(Math.cos(a) * 0.3, 0.2, Math.sin(a) * 0.3), new THREE.Vector3(Math.cos(a) * 1.0, -0.25, Math.sin(a) * 1.0), 0.09, 0.04, 6);
    });
    detail.add(mesh(mergeGeometries(roots), barkMat, 'alderRoots'));
    trunk(c, x, y, z, 0.35, 4);
  });
  // A gap between two where the cattle go down to drink: trodden mud at the water's edge.
  const mid = spot.trees[Math.floor(spot.trees.length / 2) - 1];
  const next = spot.trees[Math.floor(spot.trees.length / 2)];
  const gx = (mid[0] + next[0]) / 2;
  const gz = (mid[1] + next[1]) / 2 + 1.5;
  group.add(groundDisc(heights, { x: gx, y: heights.heightAt(gx, gz), z: gz }, 3.2, 2.4, texturesOf(c).earth));
  finish(group);
  finish(body);
  return group;
}

// ---- The old gateposts ----

const POST_HALF = 0.17; // m from a gatepost's axis to its flat faces
const POST_SHAFT = 1.62;

/** One gatepost: a chamfered gritstone shaft with a collar and a domed top, set a quarter-metre into the ground. */
function post(stone, iron, side, random) {
  const g = new THREE.Group();
  g.name = 'gatepost';
  const r = POST_HALF / Math.cos(Math.PI / 8);
  const shaftGeo = new THREE.CylinderGeometry(r, r, POST_SHAFT + 0.25, 8, 1);
  shaftGeo.rotateY(Math.PI / 8);
  const uv = shaftGeo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.1, uv.getY(i)); // one tile up its height, so the damp band at the foot is not repeated halfway up
  g.add(mesh(shaftGeo.translate(0, (POST_SHAFT - 0.25) / 2, 0), stone, 'postShaft'));
  const collar = new THREE.CylinderGeometry(r * 1.22, r * 1.22, 0.08, 8, 1).rotateY(Math.PI / 8);
  g.add(mesh(collar.translate(0, POST_SHAFT + 0.04, 0), stone, 'postCollar'));
  const dome = new THREE.SphereGeometry(r * 1.05, 8, 3, 0, TAU, 0, Math.PI / 2).rotateY(Math.PI / 8);
  dome.scale(1, 0.75, 1);
  g.add(mesh(dome.translate(0, POST_SHAFT + 0.08, 0), stone, 'postDome'));
  // Iron on the inner face (`side` is +1 where the gate would have swung to the other post): the hinge post has two pins and a strap, the other a catch.
  const face = POST_HALF * side;
  if (side > 0) {
    const pins = [];
    for (const y of [0.42, 1.38]) {
      pins.push(limb(new THREE.Vector3(face - 0.01, y, 0), new THREE.Vector3(face + 0.17, y, 0), 0.02, 0.016, 6));
      const knob = new THREE.SphereGeometry(0.026, 8, 6);
      pins.push(knob.translate(face + 0.17, y, 0));
      const eye = new THREE.TorusGeometry(0.045, 0.009, 6, 12);
      pins.push(eye.translate(face + 0.1, y - 0.07, 0));
    }
    g.add(mesh(mergeGeometries(pins), iron, 'hinges'));
    // A strap hinge's stub, rusted through where the gate was taken off.
    g.add(mesh(worldBox(0.34, 0.035, 0.07, 0.4).translate(face + 0.15, 1.41, 0), iron, 'hingeStrap'));
  } else {
    const catchParts = [worldBox(0.09, 0.16, 0.07, 0.3).translate(face - 0.035, 1.12, 0), limb(new THREE.Vector3(face, 1.12, 0), new THREE.Vector3(face - 0.15, 1.12, 0), 0.016, 0.014, 6)];
    g.add(mesh(mergeGeometries(catchParts), iron, 'catch'));
    // The slot where a rail once went in, a dark mortise, standing 9 mm proud of the face so it is not on its plane.
    g.add(mesh(worldBox(0.02, 0.11, 0.045, 0.2).translate(face - 0.001, 0.7, 0), new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 1 }), 'mortise'));
  }
  // The latch post has leant a little (3 degrees, one way or the other); the hinge post still stands true.
  g.rotation.z = side < 0 ? (random() < 0.5 ? -1 : 1) * 0.05 : 0;
  return g;
}

/** Top Field's old gateposts: two gritstone posts 3 m apart where a hedge was grubbed out, with no gate, stumps of the old hedge and nettles at their feet. */
export function buildGateposts(c, spot) {
  const { random, heights } = c;
  const group = new THREE.Group();
  group.name = 'oldGateposts';
  const [x, z] = spot.at;
  const local = standing(group, c, x, z, spot.yaw ?? 0);
  const stone = std(texturesOf(c).stone);
  const iron = std(texturesOf(c).iron, { roughness: 0.7, metalness: 0.25 });
  const half = (spot.gap ?? 3) / 2;
  for (const side of [1, -1]) {
    const p = post(stone, iron, side, random);
    p.position.set(-side * half, 0, 0);
    local.add(p);
    const px = x - side * half * Math.cos(spot.yaw ?? 0);
    const pz = z + side * half * Math.sin(spot.yaw ?? 0);
    c.fixedBox(px, heights.heightAt(px, pz) + 0.95, pz, POST_HALF, 0.95, POST_HALF, spot.yaw ?? 0);
  }
  // The old hedge line: a few stumps of hawthorn either side, and the worn ground between the posts where the gate stood open.
  const stumps = [];
  for (const dx of [-9.5, -7.4, -5.1, -3.6, 3.7, 5.3, 7.2, 9.6]) {
    const h = 0.2 + random() * 0.4;
    const px = dx + (random() - 0.5);
    const pz = (random() - 0.5) * 0.7;
    stumps.push(limb(new THREE.Vector3(px, -0.1, pz), new THREE.Vector3(px + (random() - 0.5) * 0.1, h, pz), 0.1 + random() * 0.06, 0.07, 6));
  }
  local.add(mesh(mergeGeometries(stumps), std(texturesOf(c).bark.oak), 'hedgeStumps'));
  group.add(groundDisc(heights, local.position, 3.2, 2.0, texturesOf(c).earth, { segs: 20 }));
  // Nettles and long grass at the feet of the posts.
  const nettles = frondGeometry(random, 6, 0.75, 0.05, 0.18);
  const mats = [];
  for (const sx of [-half, half]) {
    for (let i = 0; i < 6; i++) {
      const a = random() * TAU;
      const lx = sx + Math.cos(a) * (0.3 + random() * 0.5);
      const lz = Math.sin(a) * (0.3 + random() * 0.5);
      const wx = x + lx * Math.cos(spot.yaw ?? 0) + lz * Math.sin(spot.yaw ?? 0);
      const wz = z - lx * Math.sin(spot.yaw ?? 0) + lz * Math.cos(spot.yaw ?? 0);
      mats.push(matrixAt(wx, heights.heightAt(wx, wz) - 0.03, wz, random() * TAU, 0.8 + random() * 0.6));
    }
  }
  const nettleMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  group.add(tiledInstances(nettles, nettleMat, mats, { name: 'gatepostNettles' }));
  finish(group);
  return group;
}

// ---- The cast-iron roller ----

/** South Field's roller: two ribbed cast-iron drums on an axle in a cast frame with a drawbar and ring, a seat bracket with no seat, rust, and grass grown up round it. */
export function buildRoller(c, spot) {
  const { random, heights } = c;
  const group = new THREE.Group();
  group.name = 'castRoller';
  const [x, z] = spot.at;
  const yaw = spot.yaw ?? 0;
  const local = standing(group, c, x, z, yaw);
  const iron = std(texturesOf(c).iron, { roughness: 0.75, metalness: 0.3 });
  const R = 0.46; // a drum's radius
  const lift = R - 0.05; // sunk a little into the ground
  const drums = [];
  for (const dx of [-0.34, 0.34]) {
    const drum = new THREE.CylinderGeometry(R, R, 0.5, 28, 1).rotateZ(Math.PI / 2);
    const uv = drum.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 1.1);
    drums.push(drum.translate(dx, lift - (dx > 0 ? 0.05 : 0), 0)); // the east drum has sunk further than the west
    // Raised ribs round each drum and a boss on the outer end.
    for (const rib of [-0.15, 0.15]) drums.push(new THREE.CylinderGeometry(R + 0.02, R + 0.02, 0.05, 28, 1).rotateZ(Math.PI / 2).translate(dx + rib, lift, 0));
    const outer = Math.sign(dx) * 0.57;
    drums.push(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 20, 1).rotateZ(Math.PI / 2).translate(outer, lift, 0));
    drums.push(new THREE.CylinderGeometry(0.075, 0.075, 0.11, 14, 1).rotateZ(Math.PI / 2).translate(outer + Math.sign(dx) * 0.04, lift, 0));
  }
  drums.push(limb(new THREE.Vector3(-0.1, lift, 0), new THREE.Vector3(0.1, lift, 0), 0.045, 0.045, 10));
  local.add(mesh(mergeGeometries(drums), iron, 'rollerDrums'));
  // Six bolts round each outer boss, from the detail kit, their heads facing out.
  for (const side of [-1, 1]) local.add(boltsMesh(boltCircle(6, 0.14).map(([u, v]) => [side * 0.6, lift + u, v]), [side, 0, 0], iron, { size: 0.03, name: 'hubBolts' }));
  // The frame: a bar each side from the hub forward and up to the drawbar, a cross bar, the drawbar's two arms meeting at a ring, and the scraper behind.
  const bars = [];
  const hub = (sx) => new THREE.Vector3(sx * 0.64, lift, 0);
  for (const sx of [-1, 1]) {
    bars.push(limb(hub(sx), new THREE.Vector3(sx * 0.62, 0.62, 0.8), 0.06, 0.048, 4));
    bars.push(limb(new THREE.Vector3(sx * 0.62, 0.62, 0.8), new THREE.Vector3(0, 0.52, 1.62), 0.048, 0.038, 4));
    bars.push(limb(hub(sx), new THREE.Vector3(sx * 0.6, 0.3, -0.52), 0.045, 0.036, 4));
  }
  bars.push(limb(new THREE.Vector3(-0.64, 0.62, 0.8), new THREE.Vector3(0.64, 0.62, 0.8), 0.03, 0.03, 6));
  bars.push(limb(new THREE.Vector3(-0.6, 0.3, -0.52), new THREE.Vector3(0.6, 0.3, -0.52), 0.03, 0.03, 6));
  bars.push(worldBox(1.15, 0.1, 0.018, 0.5).translate(0, 0.26, -0.5)); // the scraper plate
  bars.push(new THREE.TorusGeometry(0.075, 0.016, 8, 16).translate(0, 0.52, 1.66)); // the draw ring
  bars.push(limb(new THREE.Vector3(0, 0.62, 0.8), new THREE.Vector3(0, 1.14, 0.78), 0.02, 0.018, 6)); // the seat's standard
  bars.push(worldBox(0.2, 0.025, 0.14, 0.3).translate(0, 1.15, 0.78)); // its bracket, the seat long gone
  local.add(mesh(mergeGeometries(bars), iron, 'rollerFrame'));
  // Grass and nettles grown up round the drums, thick on the sunk one's side.
  const clumps = frondGeometry(random, 7, 0.7, 0.045, 0.2);
  const mats = [];
  for (let i = 0; i < 9; i++) {
    const a = random() * TAU;
    const lx = Math.cos(a) * (0.5 + random() * 0.9);
    const lz = Math.sin(a) * (0.4 + random() * 1.4) + 0.3;
    const wx = x + lx * Math.cos(yaw) + lz * Math.sin(yaw);
    const wz = z - lx * Math.sin(yaw) + lz * Math.cos(yaw);
    mats.push(matrixAt(wx, heights.heightAt(wx, wz) - 0.03, wz, random() * TAU, 0.8 + random() * 0.7));
  }
  group.add(tiledInstances(clumps, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), mats, { name: 'rollerGrass' }));
  const y = heights.heightAt(x, z);
  c.fixedBox(x, y + 0.5, z, 0.65, 0.5, 0.5, yaw);
  finish(group);
  return group;
}

// ---- Far Field's pond and willows ----

/** Far Field's corner pond: brown-green water on a dish in the ground, reeds on the far bank, duckweed, a fallen limb and a stump in it, and a drinking place trodden bare, with two willows leaning over. */
export function buildFarPond(c, spot) {
  const { random, heights } = c;
  const group = new THREE.Group();
  group.name = 'farPond';
  const body = new THREE.Group();
  group.userData.body = body;
  const [cx, cz] = spot.at;
  const level = heights.heightAt(cx, cz) + POND.water;
  // The water: a fan out to where the dished ground comes up to its level, so it follows the bank on a slope.
  const steps = 40;
  const pos = [cx, level, cz];
  const edge = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * TAU;
    let r = 0;
    while (r < 1.3 && heights.heightAt(cx + Math.cos(a) * r * spot.rx, cz + Math.sin(a) * r * spot.rz) < level - 0.02) r += 0.02;
    edge.push(r);
    pos.push(cx + Math.cos(a) * r * 0.97 * spot.rx, level, cz + Math.sin(a) * r * 0.97 * spot.rz);
  }
  const index = [];
  for (let i = 0; i < steps; i++) index.push(0, 1 + ((i + 1) % steps), 1 + i);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const water = mesh(geo, new THREE.MeshStandardMaterial({ color: 0x3a4430, roughness: 0.12, transparent: true, opacity: 0.86, depthWrite: false }), 'pondWater');
  water.receiveShadow = true;
  body.add(water);
  // The muddy margin round the water, poached and trodden on the south-west side, where the stock come down.
  const origin = { x: cx, y: heights.heightAt(cx, cz), z: cz };
  const margin = groundDisc(heights, origin, spot.rx * 1.9, spot.rz * 1.9, texturesOf(c).earth, { rings: 5, segs: 32, lift: 0.04 });
  group.add(margin);
  const drink = groundDisc(heights, { x: cx - spot.rx * 0.9, y: heights.heightAt(cx - spot.rx * 0.9, cz + spot.rz * 0.8), z: cz + spot.rz * 0.8 }, 3.2, 2.4, texturesOf(c).earth, { lift: 0.05 });
  group.add(drink);
  // Reeds on the north and east banks (not the drinking place), tall and stiff.
  const reedGeo = frondGeometry(random, 6, 1.3, 0.035, 0.12);
  const mats = [];
  const colors = [];
  for (let tries = 0; mats.length < 38 && tries < 600; tries++) {
    const i = Math.floor(random() * steps);
    const a = (i / steps) * TAU;
    if (Math.sin(a) > 0.2 && Math.cos(a) < 0.2) continue; // south-west: the way down to drink
    const r = edge[i] * (0.92 + random() * 0.3);
    const rx = cx + Math.cos(a) * r * spot.rx;
    const rz = cz + Math.sin(a) * r * spot.rz;
    mats.push(matrixAt(rx, heights.heightAt(rx, rz) - 0.05, rz, random() * TAU, 0.8 + random() * 0.6, 0.9 + random() * 0.6, 0.8 + random() * 0.6));
    colors.push(new THREE.Color().setHSL(0.17 + random() * 0.05, 0.3 + random() * 0.15, 0.3 + random() * 0.15));
  }
  group.add(tiledInstances(reedGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), mats, { colors, name: 'pondReeds' }));
  // Duckweed: flat green patches drifting on the water, none over another (they would fight for the same plane).
  const weed = [];
  const spots = [];
  for (let tries = 0; spots.length < 14 && tries < 200; tries++) {
    const a = random() * TAU;
    const k = random() * 0.75;
    const r = 0.2 + random() * 0.4;
    const px = cx + Math.cos(a) * k * spot.rx;
    const pz = cz + Math.sin(a) * k * spot.rz;
    if (spots.some((o) => Math.hypot(o.x - px, o.z - pz) < o.r + r + 0.05)) continue;
    spots.push({ x: px, z: pz, r });
    const d = new THREE.CircleGeometry(r, 9).rotateX(-Math.PI / 2).translate(px, level + 0.012, pz);
    weed.push(paint(d.index ? d.toNonIndexed() : d, ['#6f8f2c', '#7c9a34', '#5f7f28'][spots.length % 3], random, 0.1));
  }
  group.add(mesh(mergeGeometries(weed), leafMaterial(), 'duckweed'));
  // A limb that fell in from a willow and a pollard stump standing in the shallows.
  const bark = std(texturesOf(c).bark.willow);
  const lx = cx + spot.rx * 0.45;
  const lz = cz - spot.rz * 0.35;
  group.add(mesh(limb(new THREE.Vector3(lx + 2.3, level + 0.05, lz - 0.5), new THREE.Vector3(lx - 0.4, level - 0.04, lz + 0.6), 0.1, 0.06, 7), bark, 'fallenWillow'));
  group.add(mesh(limb(new THREE.Vector3(lx - 1.2, level - 0.3, lz + 1.2), new THREE.Vector3(lx - 1.2, level + 0.55, lz + 1.2), 0.17, 0.14, 8), bark, 'pondStump'));
  // The two willows, each a leaning pollard stem with three limbs and the hanging crown of the riverside willow on top.
  for (const [wx, wz] of spot.willows) {
    const y = heights.heightAt(wx, wz);
    const toward = Math.atan2(cz - wz, cx - wx);
    const local = standing(body, c, wx, wz);
    const { segs, tips } = grow(random, { dir: kick(UP, 0.16, toward), length: 2.4, radius: 0.4, taper: 0.72, levels: 1, fork: 3, spread: 0.55, upward: 0.2, shrink: 1.1 });
    local.add(mesh(bough(segs, 8), bark, 'willowBark'));
    const top = tips.reduce((m, t) => m.add(t.at), new THREE.Vector3()).multiplyScalar(1 / tips.length);
    const crown = mesh(foliageFromWillow(random), leafMaterial(), 'willowCrown');
    crown.scale.setScalar(1.6);
    crown.position.set(top.x, top.y - 3.4 * 1.6 + 1.1, top.z);
    local.add(crown);
    trunk(c, wx, y, wz, 0.4, 4);
  }
  water.userData.noShadow = true;
  finish(group);
  finish(body);
  return group;
}

/** The crown and hanging curtains of a riverside willow, without its trunk (riverProps.js), in vertex colours. */
function foliageFromWillow(random) {
  return willowGeometry(random, { trunk: false });
}

// ---- All of them ----

const BUILDERS = {
  loneOak: buildLoneOak,
  oldGateposts: buildGateposts,
  deadElm: buildDeadElm,
  farPond: buildFarPond,
  castRoller: buildRoller,
  loneAsh: buildLoneAsh,
  brookAlders: buildAlders,
  bigOaks: buildBigOaks,
};

/** The textures the landmarks share, drawn once. */
export function landmarkTextures(random) {
  return {
    stone: gritstoneTexture(random),
    iron: rustTexture(random, '#4a443e'),
    earth: wornEarthTexture(random),
    bark: { oak: barkTexture(random, 'oak'), ash: barkTexture(random, 'ash'), elm: barkTexture(random, 'elm'), alder: barkTexture(random, 'alder'), willow: barkTexture(random, 'willow') },
  };
}

/**
 * Builds every landmark this issue builds that `layout.fieldLandmarks` has (the new farm's; today's has none), puts each in the scene with its body (the
 * tree or the water, always drawn) beside it, and returns them by kind. `c` is the props context (props.js).
 */
export function buildFieldLandmarks(c) {
  const spots = c.layout.fieldLandmarks;
  if (!spots) return null;
  const ctx = { ...c };
  const made = {};
  for (const spot of spots) {
    const build = BUILDERS[spot.kind];
    if (!build) continue;
    const group = build(ctx, spot);
    c.scene.add(group);
    if (group.userData.body) c.scene.add(group.userData.body);
    made[spot.kind] = group;
  }
  return made;
}
