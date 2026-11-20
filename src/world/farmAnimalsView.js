// The hens, the pig and their run and sty, drawn from what world/farmAnimals.js says. All procedural, all ordinary lit materials (so the
// day's light and the night dim them without help). The fences are solid to you and to vehicles (static boxes in the physics world), the
// animals are not: they are kinematic and keep to their own rectangles.

import * as THREE from 'three';
import { buildHenHouse, buildPigArk } from './orchardKit.js';
import { createRandom } from '../core/random.js';
import { worldBox } from './outbuildingProps.js';
import { woodTexture } from './neighbourTextures.js';

const HEN_COLOURS = [
  { body: 0x9a5a2c, wing: 0x7e4520 }, // brown
  { body: 0xe9e4d6, wing: 0xd3ccb8 }, // white
  { body: 0x7a3a22, wing: 0x5f2c19 }, // red
  { body: 0x2b2b2e, wing: 0x1c1c1f }, // black
];
const PIG_PINK = 0xe8a8a0;
const FENCE_H = 1.05;

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
const shadowed = (o) => {
  o.traverse((m) => {
    if (m.isMesh) m.castShadow = m.receiveShadow = true;
  });
  return o;
};

function buildHen(look) {
  const g = new THREE.Group();
  const feather = mat(look.body);
  const wingMat = mat(look.wing);
  const red = mat(0xc22a22);
  const yellow = mat(0xd9a830);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), feather);
  body.scale.set(0.115, 0.13, 0.19);
  body.position.set(0, 0.22, 0);
  g.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 6), wingMat);
  tail.rotation.x = -2.1;
  tail.position.set(0, 0.3, -0.2);
  g.add(tail);
  const wings = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.1, 0.27, 0.0);
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.2), wingMat);
    w.position.set(side * 0.01, -0.04, -0.02);
    pivot.add(w);
    g.add(pivot);
    wings.push({ pivot, side });
  }
  const neck = new THREE.Group(); // pivots at the shoulder so a peck tips it forward
  neck.position.set(0, 0.28, 0.13);
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.14, 8), feather);
  stalk.position.y = 0.07;
  neck.add(stalk);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), feather);
  head.position.set(0, 0.16, 0.015);
  neck.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.045, 6), yellow);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.155, 0.065);
  neck.add(beak);
  const comb = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.05), red);
  comb.position.set(0, 0.205, 0.012);
  neck.add(comb);
  const wattle = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 5), red);
  wattle.position.set(0, 0.125, 0.05);
  neck.add(wattle);
  g.add(neck);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.12, 5), yellow);
    leg.position.set(side * 0.04, 0.06, 0.0);
    g.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.008, 0.06), yellow);
    foot.position.set(side * 0.04, 0.004, 0.015);
    g.add(foot);
  }
  shadowed(g);
  return { group: g, neck, wings };
}

function buildPig() {
  const g = new THREE.Group();
  const skin = mat(PIG_PINK, { roughness: 0.75 });
  const dark = mat(0xc98880, { roughness: 0.8 });
  const body = new THREE.Group(); // lowers when she lies down
  const trunk = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), skin);
  trunk.scale.set(0.34, 0.34, 0.62);
  trunk.position.set(0, 0.52, 0);
  body.add(trunk);
  const head = new THREE.Group();
  head.position.set(0, 0.5, 0.55);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), skin);
  skull.scale.set(1, 0.95, 1.05);
  head.add(skull);
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.17, 10), dark);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -0.05, 0.22);
  head.add(snout);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.012, 10), mat(0xb87068));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.05, 0.31);
  head.add(nose);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.15, 5), dark);
    ear.position.set(side * 0.13, 0.17, 0.0);
    ear.rotation.set(0.5, 0, -side * 0.6);
    head.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), mat(0x1a1a1a));
    eye.position.set(side * 0.12, 0.05, 0.16);
    head.add(eye);
  }
  body.add(head);
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 5, 10, Math.PI * 1.6), dark);
  tail.position.set(0, 0.6, -0.62);
  body.add(tail);
  g.add(body);
  const legs = [];
  for (const [x, z] of [[-0.17, 0.33], [0.17, 0.33], [-0.17, -0.33], [0.17, -0.33]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.3, z);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.3, 7), skin);
    leg.position.y = -0.15;
    pivot.add(leg);
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.045, 0.04, 7), mat(0x3a2e2a));
    hoof.position.y = -0.29;
    pivot.add(hoof);
    g.add(pivot);
    legs.push(pivot);
  }
  shadowed(g);
  return { group: g, body, head, legs };
}

/** A fence of posts and rails (or boards) along a rectangle's four sides, solid in the physics world. Returns the group. */
function buildFence(rect, { boards, groundAt, physics, RAPIER }) {
  const g = new THREE.Group();
  const random = createRandom(0xfe4ce + Math.round(rect.minX * 3 + rect.minZ * 5));
  const wood = mat(0xffffff, { map: woodTexture(random, [128, 98, 66]) }); // weathered boards, the grain along them
  const post = mat(0xffffff, { map: woodTexture(random, [84, 62, 40]) }); // creosoted posts
  const cx = (rect.minX + rect.maxX) / 2;
  const cz = (rect.minZ + rect.maxZ) / 2;
  const sides = [
    { x1: rect.minX, z1: rect.minZ, x2: rect.maxX, z2: rect.minZ },
    { x1: rect.maxX, z1: rect.minZ, x2: rect.maxX, z2: rect.maxZ },
    { x1: rect.maxX, z1: rect.maxZ, x2: rect.minX, z2: rect.maxZ },
    { x1: rect.minX, z1: rect.maxZ, x2: rect.minX, z2: rect.minZ },
  ];
  for (const s of sides) {
    const len = Math.hypot(s.x2 - s.x1, s.z2 - s.z1);
    const yaw = Math.atan2(s.x2 - s.x1, s.z2 - s.z1);
    const mx = (s.x1 + s.x2) / 2;
    const mz = (s.z1 + s.z2) / 2;
    const ground = groundAt(mx, mz);
    const posts = Math.max(2, Math.round(len / 1.6) + 1);
    for (let i = 0; i < posts; i++) {
      const t = i / (posts - 1);
      const px = s.x1 + (s.x2 - s.x1) * t;
      const pz = s.z1 + (s.z2 - s.z1) * t;
      const p = new THREE.Mesh(worldBox(0.1, FENCE_H + 0.1, 0.1, 1), post);
      p.position.set(px, groundAt(px, pz) + (FENCE_H + 0.1) / 2 - 0.05, pz);
      g.add(p);
      const cap = new THREE.Mesh(worldBox(0.14, 0.035, 0.14, 1), post); // a cap wider than the post, to throw the wet off
      cap.position.set(px, groundAt(px, pz) + FENCE_H + 0.0675, pz);
      cap.rotation.y = 0.6 * random();
      g.add(cap);
    }
    const out = { x: s.x1 === s.x2 ? Math.sign(mx - cx) : 0, z: s.z1 === s.z2 ? Math.sign(mz - cz) : 0 }; // the rails are nailed on the outer face of the posts
    const rails = boards ? [0.18, 0.42, 0.66, 0.9] : [0.35, 0.7, 1.02];
    for (const y of rails) {
      const r = new THREE.Mesh(worldBox(0.04, boards ? 0.2 : 0.07, len + 0.14, 1), wood);
      r.position.set(mx + out.x * 0.07, ground + y, mz + out.z * 0.07);
      r.rotation.y = yaw;
      g.add(r);
    }
    if (!boards) {
      // Wire: thin upright strands between the posts, as the hens' run is wired in.
      const wire = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.7, len), mat(0x9a9ea3, { transparent: true, opacity: 0.35 }));
      wire.position.set(mx, ground + 0.52, mz);
      wire.rotation.y = yaw;
      g.add(wire);
    }
    // Solid to you and to vehicles.
    const half = len / 2;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    physics.createCollider(RAPIER.ColliderDesc.cuboid(0.07, FENCE_H / 2, half).setTranslation(mx, ground + FENCE_H / 2, mz).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }));
  }
  return shadowed(g);
}

/** A house from orchardKit.js stood on the ground at (x, z). */
function placed(house, x, z, groundAt) {
  house.position.set(x, groundAt(x, z), z);
  return house;
}

function buildTrough(x, z, yaw, groundAt) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.3), mat(0x5c5f63, { metalness: 0.4 }));
  t.position.y = 0.07;
  g.add(t);
  g.position.set(x, groundAt(x, z), z);
  g.rotation.y = yaw;
  return shadowed(g);
}

export class FarmAnimalsView {
  constructor({ scene, animals, groundAt, physics, RAPIER }) {
    this.animals = animals;
    this.groundAt = groundAt;
    this.root = new THREE.Group();
    this.root.name = 'farmAnimals';
    scene.add(this.root);
    const { pen, sty } = animals;
    const random = createRandom(0x0c4a); // the same boards and tin on every farm
    this.root.add(buildFence(pen, { boards: false, groundAt, physics, RAPIER }));
    this.root.add(buildFence(sty, { boards: true, groundAt, physics, RAPIER }));
    this.root.add(placed(buildHenHouse(random), pen.minX + 1.5, pen.minZ + 1.5, groundAt));
    this.root.add(placed(buildPigArk(random), sty.minX + 1.6, sty.maxZ - 1.2, groundAt));
    this.root.add(buildTrough(sty.maxX - 0.9, sty.minZ + 0.6, 0, groundAt));
    this.hens = animals.hens.map((h, i) => {
      const built = buildHen(HEN_COLOURS[i % HEN_COLOURS.length]);
      built.phase = i * 1.7;
      this.root.add(built.group);
      return built;
    });
    this.pig = buildPig();
    this.root.add(this.pig.group);
    this.time = 0;
    this.update(0);
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    this.animals.hens.forEach((h, i) => {
      const v = this.hens[i];
      v.group.position.set(h.x, this.groundAt(h.x, h.z), h.z);
      v.group.rotation.y = h.heading;
      const running = h.mode === 'run';
      const walking = h.mode === 'walk';
      // A peck is a quick nod forward from the shoulder, then up to look; a runner holds her head up, out in front.
      const peck = h.mode === 'peck' ? Math.max(0, Math.sin(t * 6 + v.phase)) ** 2 : 0;
      v.neck.rotation.x = running ? -0.2 : walking ? Math.sin(t * 5 + v.phase) * 0.12 : 0.15 + peck * 1.1;
      v.group.position.y += running ? Math.abs(Math.sin(t * 16 + v.phase)) * 0.06 : walking ? Math.abs(Math.sin(t * 5 + v.phase)) * 0.012 : 0;
      for (const w of v.wings) w.pivot.rotation.z = w.side * (running ? 0.5 + Math.sin(t * 28 + v.phase) * 0.6 : 0.05);
    });
    const pg = this.animals.pig;
    const v = this.pig;
    const lying = pg.mode === 'rest';
    v.group.position.set(pg.x, this.groundAt(pg.x, pg.z), pg.z);
    v.group.rotation.y = pg.heading;
    v.body.position.y = lying ? -0.14 : 0;
    const swing = pg.speed > 0 ? Math.sin(t * 6) * 0.45 : 0;
    v.legs.forEach((leg, i) => (leg.rotation.x = i === 0 || i === 3 ? swing : -swing));
    v.legs.forEach((leg) => leg.scale.setY(lying ? 0.45 : 1)); // folded under her
    // Rooting: the head goes down and swings from side to side; walking she bobs it.
    v.head.rotation.x = pg.mode === 'root' ? 0.5 + Math.sin(t * 3) * 0.1 : pg.mode === 'walk' ? Math.sin(t * 6) * 0.05 : 0;
    v.head.rotation.y = pg.mode === 'root' ? Math.sin(t * 1.7) * 0.4 : 0;
  }
}
