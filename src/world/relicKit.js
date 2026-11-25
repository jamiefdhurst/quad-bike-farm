// A kit for things left to go to ruin (#1003), first used on the Old Pit's relics: rust streaks that run down from a pin or a bolt, a pane broken
// through with a jagged hole and its shards, a window boarded with a ply sheet or nailed planks, a weathered folding table and a moulded plastic
// chair. Pieces go into a `Parts` (parts.js), so a whole machine or cabin stays a few draw calls; everything is lit and built to real sizes. Its
// textures are quarryTextures.js's (`rustStreakTexture`, `crackedGlassTexture`, `weatheredPlasticTexture`) and the wood is neighbourTextures.js's.

import * as THREE from 'three';
import { worldBox } from './outbuildingProps.js';
import { woodTexture } from './neighbourTextures.js';
import { rustStreakTexture, rustTexture, weatheredPlasticTexture } from './quarryTextures.js';
import { addBolts } from './entranceKit.js';

/** How far a decal stands off the face it is on: clear of the coplanar test's 3 mm, near enough not to show a gap. */
export const DECAL_OFF = 0.005;

/** The rust streaks' material: see-through, drawn over the face it hangs on, lit. */
export function streakMaterial(wear) {
  const m = new THREE.MeshStandardMaterial({ map: rustStreakTexture(wear), roughness: 0.9, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  m.name = 'streak';
  return m;
}

/** The kit's materials, from `wear` (a random stream): rust streaks (see-through, drawn over a face), weathered ply and planks, rusty steel, dark fixings, weathered plastic. */
export function relicMaterials(wear) {
  const m = {
    streak: streakMaterial(wear),
    ply: new THREE.MeshStandardMaterial({ map: woodTexture(wear, [128, 118, 100]), roughness: 0.95 }), // ply gone silver-grey in the weather
    plank: new THREE.MeshStandardMaterial({ map: woodTexture(wear, [104, 92, 76]), roughness: 0.95 }),
    rust: new THREE.MeshStandardMaterial({ map: rustTexture(wear, '#6e4430'), roughness: 0.9, metalness: 0.2 }),
    fixing: new THREE.MeshStandardMaterial({ color: 0x3a3029, roughness: 0.7, metalness: 0.4 }),
    plastic: new THREE.MeshStandardMaterial({ map: weatheredPlasticTexture(wear), roughness: 0.85 }),
  };
  for (const [k, v] of Object.entries(m)) v.name = `relic-${k}`;
  return m;
}

/**
 * Rust streaks: each `{ x, y, z, normal, len, w }` hangs from (x, y, z) on a face whose outward normal is `normal` ('+x', '-x', '+z' or '-z'), `len` m
 * down it and `w` wide, a decal `DECAL_OFF` off the face. Streaks on one face are spaced by the caller so none lies over another.
 */
export function addRustStreaks(parts, material, streaks) {
  for (const s of streaks) {
    const [axis, sign] = [s.normal[1], s.normal[0] === '+' ? 1 : -1];
    const geo = new THREE.PlaneGeometry(s.w, s.len);
    geo.translate(0, -s.len / 2 + s.w * 0.15, 0); // its top a little above the pin, so the stain starts round it
    const ry = axis === 'x' ? (sign * Math.PI) / 2 : sign > 0 ? 0 : Math.PI;
    const off = DECAL_OFF + (s.lift ?? 0);
    parts.add(material, geo, s.x + (axis === 'x' ? sign * off : 0), s.y, s.z + (axis === 'z' ? sign * off : 0), 0, ry, 0);
  }
}

/**
 * A pane `w` by `h` broken through (#1003): the glass left in its frame round a jagged hole whose middle is at `hole` ([u, v] 0..1 across it) and
 * which takes `size` (0..1) of the pane, as a flat shape in x-y facing +z, centred on the origin, with uvs 0..1 over the pane for a cracked texture.
 */
export function brokenPaneGeometry(w, h, random, { hole = [0.45, 0.5], size = 0.55 } = {}) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, -h / 2);
  shape.lineTo(w / 2, -h / 2);
  shape.lineTo(w / 2, h / 2);
  shape.lineTo(-w / 2, h / 2);
  shape.closePath();
  const cx = (hole[0] - 0.5) * w;
  const cy = (hole[1] - 0.5) * h;
  const rx = (w / 2) * size;
  const ry = (h / 2) * size;
  const n = 14;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = i % 2 ? 0.45 + random() * 0.3 : 0.8 + random() * 0.35; // in and out: the points of the glass left round the hole
    const x = Math.max(-w / 2 + 0.02, Math.min(w / 2 - 0.02, cx + Math.cos(a) * rx * r));
    const y = Math.max(-h / 2 + 0.02, Math.min(h / 2 - 0.02, cy + Math.sin(a) * ry * r));
    pts.push(new THREE.Vector2(x, y));
  }
  shape.holes.push(new THREE.Path(pts.reverse()));
  const geo = new THREE.ShapeGeometry(shape);
  const p = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
  return geo;
}

/** `count` shards of glass lying flat on y = 0 within `spread` m of the origin, each a thin jagged triangle a few centimetres across, facing up. */
export function shardsGeometry(random, count = 8, spread = 0.3) {
  const pos = [];
  for (let i = 0; i < count; i++) {
    const x = (random() - 0.5) * 2 * spread;
    const z = (random() - 0.5) * 2 * spread;
    const s = 0.02 + random() * 0.05;
    const a = random() * Math.PI * 2;
    const tri = [0, 2.1, 4.2].map((k) => [x + Math.cos(a + k + random() * 0.5) * s, z + Math.sin(a + k + random() * 0.5) * s]);
    pos.push(tri[0][0], 0.002, tri[0][1], tri[2][0], 0.002, tri[2][1], tri[1][0], 0.002, tri[1][1]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2).fill(0.5), 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Boards over a window opening `w` by `h` centred on the origin in a wall plane at z = 0 (outside +z), standing `out` m off it: `kind` 'ply', one
 * 18 mm sheet a little bigger than the opening screwed round its edge, or 'planks', three or four rough planks nailed across at a slant. `mats` is
 * `relicMaterials`'. Returns `{ list, screws, normal }` in the window's own frame (`list` [material, geometry, x, y, z, rx, ry, rz] each), for
 * `addBoards` to place.
 */
export function boardedWindow(mats, w, h, random, { kind = 'ply', out = 0.06 } = {}) {
  const list = [];
  const add = (m, g, x, y, z, rx = 0, ry = 0, rz = 0) => list.push([m, g, x, y, z, rx, ry, rz]);
  if (kind === 'ply') {
    const bw = w + 0.14;
    const bh = h + 0.12;
    add(mats.ply, worldBox(bw, bh, 0.018, 1.2), 0, 0, out + 0.009);
    const screws = [];
    const head = out + 0.014; // the screw heads sunk 4 mm into the sheet, so neither end of one is within 3 mm of its face
    for (const sy of [-1, 1]) for (let i = 0; i <= 3; i++) screws.push([-bw / 2 + 0.05 + (i * (bw - 0.1)) / 3, sy * (bh / 2 - 0.04), head]);
    for (const sx of [-1, 1]) screws.push([sx * (bw / 2 - 0.04), 0, head]);
    return { list, screws, normal: [0, 0, 1] };
  }
  const n = 3 + (random() < 0.5 ? 1 : 0);
  const nails = [];
  for (let i = 0; i < n; i++) {
    const y = -h / 2 + 0.08 + (i * (h - 0.16)) / (n - 1);
    const tilt = (random() - 0.5) * 0.14;
    const len = w + 0.22 + random() * 0.08;
    const z = out + 0.011 + i * 0.022; // each over the last where they cross the jambs, so none shares a plane with another
    const dx = (random() - 0.5) * 0.05;
    add(mats.plank, worldBox(len, 0.15 + random() * 0.03, 0.022, 1), dx, y, z, 0, 0, tilt);
    for (const sx of [-1, 1]) nails.push([dx + sx * (len / 2 - 0.05) * Math.cos(tilt), y + sx * (len / 2 - 0.05) * Math.sin(tilt), z + 0.007]);
  }
  return { list, screws: nails, normal: [0, 0, 1] };
}

/** Puts `boardedWindow`'s boards into `parts` through `matrix` (the window's place), with their screws or nails (the detail kit's bolt heads). */
export function addBoards(parts, mats, boards, matrix) {
  for (const [m, g, x, y, z, rx, ry, rz] of boards.list) {
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1)));
    parts.add(m, g.applyMatrix4(matrix));
  }
  const local = new THREE.Vector3();
  const pts = boards.screws.map((s) => local.set(...s).applyMatrix4(matrix).toArray());
  const normal = new THREE.Vector3(...boards.normal).transformDirection(matrix).toArray();
  addBolts(parts, mats.fixing, pts, normal, 0.012, { washer: false }); // a 12 mm head, 8 mm proud of where it goes in, sunk 4 mm
}

/**
 * A steel-legged folding table left out (#1003), 0.8 by 0.6 m and 0.72 m high, at (x, y, z) turned `yaw`, leaning `tilt` on soft ground: a
 * chipboard top gone swollen and grey with a lip round it, four rusty tube legs splayed a little and the cross rails between them.
 */
export function addFoldingTable(parts, mats, x, y, z, yaw, tilt = 0) {
  const local = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, tilt, 'YXZ')), new THREE.Vector3(1, 1, 1));
  const put = (m, geo) => parts.add(m, geo.applyMatrix4(local));
  put(mats.ply, worldBox(0.8, 0.025, 0.6, 0.8).translate(0, 0.7075, 0));
  for (const s of [-1, 1]) {
    put(mats.rust, worldBox(0.82, 0.03, 0.02, 0.5).translate(0, 0.68, s * 0.29)); // the apron, a lip round the top's underside
    put(mats.rust, worldBox(0.02, 0.03, 0.56, 0.5).translate(s * 0.39, 0.68, 0));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.CylinderGeometry(0.012, 0.012, 0.67, 6).rotateZ(sx * 0.05).translate(sx * 0.36, 0.335, sz * 0.26);
    put(mats.rust, leg);
  }
  for (const sx of [-1, 1]) put(mats.rust, new THREE.CylinderGeometry(0.009, 0.009, 0.5, 6).rotateX(Math.PI / 2).translate(sx * 0.355, 0.16, 0)); // the rails
}

/**
 * A moulded plastic garden chair (#1003) at (x, y, z) turned `yaw`: a seat with a rolled front edge, a slatted back, arms and four tapered legs, in
 * `material` (`relicMaterials`' weathered plastic). `tipped` lays it on its back, as the wind leaves one.
 */
export function addPlasticChair(parts, material, x, y, z, yaw, { tipped = false } = {}) {
  const geos = [];
  const put = (geo) => geos.push(geo);
  put(worldBox(0.44, 0.035, 0.42, 0.5).translate(0, 0.44, 0));
  put(new THREE.CylinderGeometry(0.02, 0.02, 0.44, 8).rotateZ(Math.PI / 2).translate(0, 0.435, 0.205)); // the rolled front edge
  for (let i = 0; i < 4; i++) put(worldBox(0.075, 0.46, 0.025, 0.5).rotateX(-0.1).translate(-0.165 + i * 0.11, 0.68, -0.225)); // the slats, raked back a little from the seat to the top rail
  put(worldBox(0.46, 0.06, 0.03, 0.5).translate(0, 0.92, -0.25)); // the top rail
  for (const s of [-1, 1]) {
    put(worldBox(0.04, 0.03, 0.4, 0.5).translate(s * 0.235, 0.63, -0.02)); // an arm
    put(worldBox(0.035, 0.2, 0.035, 0.5).translate(s * 0.235, 0.53, 0.16));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(new THREE.CylinderGeometry(0.016, 0.024, 0.43, 6).translate(sx * 0.19, 0.215, sz * 0.18));
  // Tipped, it lies back on its top rail and its back legs' feet: turned over backwards, then set down so its lowest point is on the ground.
  const tip = tipped ? new THREE.Matrix4().makeRotationX(-1.3) : new THREE.Matrix4();
  let low = Infinity;
  for (const g of geos) {
    g.applyMatrix4(tip);
    g.computeBoundingBox();
    low = Math.min(low, g.boundingBox.min.y);
  }
  const local = new THREE.Matrix4().compose(new THREE.Vector3(x, y - low - 0.005, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
  for (const g of geos) parts.add(material, g.applyMatrix4(local));
}
