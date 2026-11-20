// What the farmstead's yard and stackyard are dressed with (#817), from the kits' boxes and textures: the barn wall's hose reel, brush, shovel, bucket and twine on a
// nail; a stack of pallets and a pile of old tyres; the gully grate; the steel gates at the yard's ways out on their stone or timber posts; the stackyard's bales, loose
// straw and bale spike; nettles and weeds along the walls; and the gloss of standing water. Each group's parts are merged by material (a handful of draw calls) with a
// collider for whatever you could ride into. Places are `layout.farmstead.yard` (layoutNew.js `yardKitLayout`); the painted ground is yardGround.js.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { worldBox, canvasTexture, stoneTexture } from './outbuildingProps.js';
import { woodTexture } from './neighbourTextures.js';
import { tiledInstances } from './tiledInstances.js';
import { hoseGeometry } from '../vehicle/detail/cables.js';
import { mergedGroup } from './farmsteadProps.js';

const rgb = (r, g, b) => `rgb(${r},${g},${b})`;

/** Galvanised steel gone dull: streaked along its length, with orange rust where it has been knocked. */
export function galvanisedTexture(random) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = rgb(148, 152, 154);
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      const shade = (random() - 0.5) * 70;
      ctx.fillStyle = `rgba(${shade > 0 ? '235,238,240' : '40,42,44'},${Math.abs(shade) / 200})`;
      ctx.fillRect(random() * w, random() * h, 8 + random() * 40, 1 + random() * 2);
    }
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `rgba(${150 + random() * 40},${70 + random() * 30},30,${0.25 + random() * 0.35})`;
      ctx.beginPath();
      ctx.ellipse(random() * w, random() * h, 1 + random() * 4, 1 + random() * 3, random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Old rubber: near black, flecked grey, with a pale bloom where the sun has had it. */
export function rubberTexture(random) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = rgb(30, 30, 31);
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(${random() > 0.5 ? '120,118,112' : '8,8,8'},${0.1 + random() * 0.3})`;
      ctx.fillRect(random() * w, random() * h, 1 + random() * 3, 1 + random() * 2);
    }
    ctx.fillStyle = 'rgba(150,146,138,0.12)'; // the grey bloom of old rubber, in bands round the tyre
    for (let y = 0; y < h; y += 32) ctx.fillRect(0, y + random() * 10, w, 8);
  });
}

/** Straw: pale gold stalks every way, darker where it has lain damp. */
export function strawTexture(random) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = rgb(196, 168, 96);
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const shade = (random() - 0.5) * 80;
      ctx.strokeStyle = `rgba(${shade > 0 ? '240,214,140' : '96,70,32'},${0.2 + Math.abs(shade) / 120})`;
      ctx.lineWidth = 1 + random();
      const x = random() * w;
      const y = random() * h;
      const a = (random() - 0.5) * 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * (14 + random() * 30), y + Math.sin(a) * 14);
      ctx.stroke();
    }
  });
}

/** A nettle clump on a transparent card: serrated leaves up a stem, dark green. */
export function nettleTexture(random) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let s = 0; s < 4; s++) {
      const x0 = 22 + s * 28 + random() * 8;
      ctx.strokeStyle = 'rgb(54,86,38)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, h);
      ctx.lineTo(x0 + (random() - 0.5) * 14, 14 + random() * 20);
      ctx.stroke();
      for (let k = 0; k < 5; k++) {
        const y = h - 18 - k * 20 - random() * 6;
        for (const side of [-1, 1]) {
          ctx.fillStyle = `rgb(${40 + random() * 22},${88 + random() * 36},${30 + random() * 18})`;
          ctx.beginPath();
          ctx.moveTo(x0, y);
          for (let t = 0; t <= 6; t++) ctx.lineTo(x0 + side * (4 + t * 3.4), y - 6 + (t % 2 ? 3 : -3) - t * 1.2);
          for (let t = 6; t >= 0; t--) ctx.lineTo(x0 + side * (4 + t * 3.4), y + 6 + (t % 2 ? -3 : 3) - t * 1.2);
          ctx.fill();
        }
      }
    }
  });
}

/** The opacity of the water standing in the yard's low spots for ground `wet` (0..1): none on a dry day, a full sheet once it has been wet a while. */
export const standingWater = (wet) => Math.max(0, Math.min(1, (wet - 0.15) / 0.5)) * 0.78;

/** Geometry bag: `add(material, geometry)` then `group()` merges each material's. */
function bag() {
  const by = new Map();
  return {
    add(material, geo) {
      if (!by.has(material)) by.set(material, []);
      const g = geo.index ? geo.toNonIndexed() : geo;
      if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((g.getAttribute('position').count) * 2), 2));
      by.get(material).push(g);
    },
    entries: () => by,
    group() {
      for (const geos of by.values()) for (const g of geos) for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a);
      return mergedGroup(by);
    },
  };
}

/** The height to set something with a footprint of half-sizes (hx, hz) about (x, z) on: the highest ground under it, so on a slope the low side is buried a little rather than floating. */
export function restingHeight(ground, x, z, hx, hz) {
  let y = -Infinity;
  for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) y = Math.max(y, ground(x + dx * hx, z + dz * hz));
  return y;
}

/** `geo` turned about x, z then y, and set at (x, y, z). */
const put = (geo, x, y, z, ry = 0, rx = 0, rz = 0) => {
  if (rx) geo.rotateX(rx);
  if (rz) geo.rotateZ(rz);
  if (ry) geo.rotateY(ry);
  return geo.translate(x, y, z);
};

// The steel gates at the yard's ways out -------------------------------------------------------------------------------------------------------------------------------

const POST = { w: 0.34, h: 1.75, sink: 0.4, cap: 0.42 };
const GATE_LEAF = 2.4;
const GATE_HALF = 2.6; // m from the gateway's middle to each post

/** Every gate post of `gates`: two to each, either side of the gateway's middle along its line. */
export function gatePosts(gates) {
  return gates.flatMap((g) => [-1, 1].map((side) => ({ x: g.along === 'z' ? g.x : g.x + side * GATE_HALF, z: g.along === 'z' ? g.z + side * GATE_HALF : g.z, side, gate: g })));
}

/** A steel gate's leaf lying along local +x from its hinge: seven rails with a heavier top one, two stiles and a brace, 1.2 m high, in tube. */
function leafParts(len) {
  const parts = [];
  const tube = (l, r, x, y, rz = 0) => parts.push(put(new THREE.CylinderGeometry(r, r, l, 8), x, y, 0, 0, 0, rz));
  for (const y of [0.12, 0.26, 0.41, 0.57, 0.75, 0.95, 1.18]) tube(len, y === 1.18 ? 0.03 : 0.018, len / 2, y, Math.PI / 2);
  tube(1.12, 0.025, 0.03, 0.65);
  tube(1.12, 0.022, len - 0.03, 0.65);
  const brace = Math.hypot(len * 0.55, 1.03);
  parts.push(put(new THREE.CylinderGeometry(0.018, 0.018, brace, 8), len * 0.275, 0.66, 0, 0, 0, -Math.atan2(len * 0.55, 1.03)));
  return parts;
}

/**
 * A steel field gate at each way out of the yard that is a gateway (`layout.farmstead.yard.gates`), hung open: two leaves laid back along the fence, each hinged on a
 * post (stone at the Home Ground rail, timber at the hay field's hedge) with a cap and hanging straps. Posts are solid, leaves are not.
 */
export function buildYardGates({ scene, layout, heights, fixedBox, random }) {
  const gates = layout.farmstead?.yard?.gates;
  if (!gates?.length) return null;
  const steel = new THREE.MeshStandardMaterial({ map: galvanisedTexture(random), roughness: 0.5, metalness: 0.55 });
  const stone = new THREE.MeshStandardMaterial({ map: stoneTexture(random, { damp: false }), roughness: 0.95 });
  const timber = new THREE.MeshStandardMaterial({ map: woodTexture(random, [92, 72, 50]), roughness: 0.95 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x4a4640, roughness: 0.6, metalness: 0.5 });
  const b = bag();
  for (const { x, z, side, gate } of gatePosts(gates)) {
    const alongZ = gate.along === 'z';
    const y = restingHeight((px, pz) => heights.heightAt(px, pz), x, z, POST.cap / 2, POST.cap / 2);
    const post = alongZ ? stone : timber; // the rail's end is stone, the hedge's timber
    b.add(post, put(worldBox(POST.w, POST.h + POST.sink, POST.w, 1), x, y + (POST.h - POST.sink) / 2, z));
    b.add(post, put(worldBox(POST.cap, 0.07, POST.cap, 1), x, y + POST.h + 0.025, z)); // a cap wider than the post, to throw the wet off
    b.add(timber, put(worldBox(0.9, 0.05, 0.9, 1), x, y + 0.002, z)); // a plank footing for the post's foot out of the mud
    // The leaf lies back along the fence on the yard side of its line (0.45 m off a rail, 1.2 m off a hedge's face), its hinge straps on the post.
    const off = alongZ ? 0.45 : 1.2 * gate.inward; // towards the yard side of the line
    const lx = alongZ ? x + off : x + side * (POST.w / 2 + 0.02);
    const lz = alongZ ? z + side * (POST.w / 2 + 0.02) : z + off;
    const yaw = alongZ ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : side > 0 ? 0 : Math.PI;
    for (const p of leafParts(GATE_LEAF)) b.add(steel, put(p, lx, y, lz, yaw));
    for (const hy of [0.26, 1.1]) b.add(dark, put(worldBox(0.1, 0.05, 0.1, 1), lx, y + hy, lz));
    fixedBox(x, y + POST.h / 2, z, POST.w / 2, POST.h / 2, POST.w / 2, 0);
  }
  const group = b.group();
  group.name = 'yardGates';
  scene.add(group);
  return group;
}

// The yard's furniture ------------------------------------------------------------------------------------------------------------------------------------------------

/** The barn's east wall's gear and the heaps at its ends, the gully grate, nettles and the standing water. Returns the group (`userData.setWet(wet)` sets the water). */
export function buildYardFurniture({ scene, layout, heights, fixedBox, random, drawDistance }) {
  const k = layout.farmstead?.yard;
  if (!k) return null;
  const steel = new THREE.MeshStandardMaterial({ map: galvanisedTexture(random), roughness: 0.5, metalness: 0.5 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x2c2d2f, roughness: 0.6, metalness: 0.6 });
  const timber = new THREE.MeshStandardMaterial({ map: woodTexture(random, [118, 98, 72]), roughness: 0.95 });
  const oldTimber = new THREE.MeshStandardMaterial({ map: woodTexture(random, [96, 82, 62]), roughness: 0.97 });
  const rubber = new THREE.MeshStandardMaterial({ map: rubberTexture(random), roughness: 0.95 });
  const hoseGreen = new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.55 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08d3c, roughness: 0.4, metalness: 0.7 });
  const bristle = new THREE.MeshStandardMaterial({ color: 0x4a3c2a, roughness: 1 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x2c5fae, roughness: 0.8 });
  const b = bag();
  const ground = (x, z) => heights.heightAt(x, z);
  // The gear on the barn's east end wall, built in its own frame (x along the wall, z out of it, y up from the ground) and then turned and set down at `k.wall`.
  const gear = bag();
  const g = gear.add;
  {
    // The hose reel: a backplate on two screws, a drum between flanges with the hose wound on it, a crank, and the hose's tail going down to a brass nozzle on the ground.
    const x = 0;
    const z = -0.01; // the backplate sunk a centimetre into the wall
    const y = 1.15;
    g(oldTimber, put(worldBox(0.5, 0.5, 0.05, 0.5), x, y, z + 0.025));
    g(iron, put(new THREE.CylinderGeometry(0.2, 0.2, 0.015, 20), x, y, z + 0.1, 0, Math.PI / 2));
    g(iron, put(new THREE.CylinderGeometry(0.2, 0.2, 0.015, 20), x, y, z + 0.27, 0, Math.PI / 2));
    g(hoseGreen, put(new THREE.CylinderGeometry(0.17, 0.17, 0.155, 20), x, y, z + 0.185, 0, Math.PI / 2));
    g(iron, put(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8), x, y, z + 0.3, 0, Math.PI / 2));
    g(iron, put(worldBox(0.17, 0.02, 0.02, 1), x + 0.07, y, z + 0.34));
    g(iron, put(new THREE.CylinderGeometry(0.014, 0.014, 0.07, 8), x + 0.15, y, z + 0.37, 0, Math.PI / 2));
    for (const dx of [-0.2, 0.2]) g(steel, put(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 8), x + dx, y + 0.2, z + 0.055, 0, Math.PI / 2));
    const { hose, clamps } = hoseGeometry([[x, y - 0.17, z + 0.19], [x + 0.05, y - 0.5, z + 0.3], [x - 0.2, 0.03, z + 0.75], [x - 0.35, 0.025, z + 1.3]], 0.014, { sag: 0.1, steps: 8 });
    g(hoseGreen, hose);
    if (clamps) g(steel, clamps);
    g(brass, put(new THREE.CylinderGeometry(0.02, 0.028, 0.14, 10), x - 0.43, 0.03, z + 1.32, 0, 0, Math.PI / 2));
  }
  {
    // The yard brush and the shovel leaning on the wall.
    g(timber, put(new THREE.CylinderGeometry(0.014, 0.014, 1.45, 8), 0.75, 0.72, 0.1, 0, 0.12));
    g(timber, put(worldBox(0.5, 0.045, 0.085, 0.25), 0.75, 0.065, 0.2));
    g(bristle, put(worldBox(0.48, 0.045, 0.075, 0.25), 0.75, 0.02, 0.2));
    g(timber, put(new THREE.CylinderGeometry(0.016, 0.016, 1.0, 8), 1.15, 0.55, 0.12, 0, 0.18));
    g(timber, put(worldBox(0.17, 0.035, 0.035, 1), 1.15, 1.06, 0.04));
    g(steel, put(new THREE.BoxGeometry(0.24, 0.012, 0.28), 1.15, 0.04, 0.3, 0, -0.14));
    // The bucket: a galvanised pail, rim rolled over, a bail across it.
    g(steel, put(new THREE.CylinderGeometry(0.15, 0.115, 0.3, 16, 1, true), -0.25, 0.15, 1.0));
    g(steel, put(new THREE.CylinderGeometry(0.115, 0.115, 0.012, 16), -0.25, 0.006, 1.0));
    g(steel, put(new THREE.TorusGeometry(0.152, 0.01, 6, 16), -0.25, 0.3, 1.0, 0, Math.PI / 2));
    g(iron, put(new THREE.TorusGeometry(0.15, 0.005, 5, 12, Math.PI), -0.25, 0.3, 1.0));
    // The coil of blue baler twine on a nail, a loose end hanging.
    g(iron, put(new THREE.CylinderGeometry(0.006, 0.006, 0.09, 6), 1.4, 1.55, 0.04, 0, Math.PI / 2));
    g(blue, put(new THREE.TorusGeometry(0.075, 0.032, 8, 16), 1.4, 1.49, 0.08));
    g(blue, put(new THREE.CylinderGeometry(0.004, 0.004, 0.32, 5), 1.45, 1.29, 0.09, 0, 0, 0.1));
    // A pallet leaned on the wall, on its edge and tipped back: five boards across three blocks.
    for (let i = 0; i < 5; i++) g(oldTimber, put(worldBox(1.2, 0.022, 0.1, 0.6), 3.0, 0.4 + (i - 2) * 0.175 * 0.97, 0.13 - (i - 2) * 0.03, 0, -0.17));
    for (const dx of [-0.5, 0, 0.5]) g(oldTimber, put(worldBox(0.1, 0.8, 0.09, 0.5), 3.0 + dx, 0.4, 0.16, 0, -0.17));
  }
  const gearY = restingHeight(ground, k.wall.x + 0.6, k.wall.z - 1.2, 0.6, 2.4); // 1.2 m out of the wall and 3.6 m along it
  for (const [material, geos] of gear.entries()) {
    for (const geo of geos) b.add(material, geo.rotateY(k.wall.yaw).translate(k.wall.x, gearY, k.wall.z));
  }
  // A stack of pallets, each as it was dropped.
  {
    const { x, z, yaw } = k.pallets;
    const y0 = restingHeight(ground, x, z, 0.65, 0.5);
    for (let n = 0; n < 5; n++) {
      const dy = y0 + n * 0.145;
      const jy = yaw + (n % 2 ? 0.07 : -0.05) * (n + 1) * 0.3;
      const jx = x + ((n % 3) - 1) * 0.04;
      const m = (geo, ox, oy, oz) => b.add(oldTimber, put(geo, jx + ox * Math.cos(jy) + oz * Math.sin(jy), dy + oy, z - ox * Math.sin(jy) + oz * Math.cos(jy), jy));
      for (let i = 0; i < 5; i++) m(worldBox(1.2, 0.022, 0.1, 0.6), 0, 0.133, -0.35 + i * 0.175);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m(worldBox(0.1, 0.09, 0.1, 0.5), -0.5 + j * 0.5, 0.077, -0.35 + i * 0.35);
      for (let i = 0; i < 3; i++) m(worldBox(1.2, 0.022, 0.1, 0.6), 0, 0.011, -0.35 + i * 0.35);
    }
    fixedBox(x, y0 + 0.36, z, 0.62, 0.36, 0.45, yaw);
  }
  // A pile of old tyres: three lying flat, two on those, one on top, and one stood against the pile. Each ring sits on the ground under it, or on the rings it rests on.
  {
    const { x, z } = k.tyres;
    const ring = (cx, cz, under) => {
      const y = under.length ? Math.max(...under.map((r) => r.top)) : restingHeight(ground, cx, cz, 0.4, 0.4);
      b.add(rubber, put(new THREE.TorusGeometry(0.3, 0.1, 10, 20), cx, y + 0.1, cz, 0, Math.PI / 2));
      return { x: cx, top: y + 0.2 };
    };
    const low = [0, 1, 2].map((i) => ring(x + (i - 1) * 0.82, z + (i % 2) * 0.06, []));
    const mid = [0, 1].map((i) => ring(x + (i - 0.5) * 0.82, z + 0.02, low.filter((r) => Math.abs(r.x - (x + (i - 0.5) * 0.82)) < 0.5)));
    ring(x, z, mid);
    const leanY = restingHeight(ground, x + 1.5, z + 0.1, 0.2, 0.35);
    b.add(rubber, put(new THREE.TorusGeometry(0.3, 0.1, 10, 20), x + 1.5, leanY + 0.4, z + 0.1, 0.4, 0.05));
    fixedBox(x, restingHeight(ground, x, z, 1.2, 0.42) + 0.25, z, 1.2, 0.27, 0.42, 0);
  }
  // The gully grate: a kerbed frame flush with the concrete, a dark sump, slots across it.
  {
    const { x, z } = k.gully;
    const y = restingHeight(ground, x, z, 0.4, 0.4);
    b.add(iron, put(worldBox(0.64, 0.012, 0.64, 1), x, y + 0.001, z));
    for (const [dx, dz, sx, sz] of [[0, -0.33, 0.7, 0.05], [0, 0.33, 0.7, 0.05], [-0.33, 0, 0.05, 0.6], [0.33, 0, 0.05, 0.6]]) b.add(steel, put(worldBox(sx, 0.03, sz, 0.5), x + dx, y + 0.014, z + dz));
    for (let i = 0; i < 6; i++) b.add(steel, put(worldBox(0.04, 0.022, 0.62, 0.5), x - 0.25 + i * 0.1, y + 0.012, z));
  }
  const group = b.group();
  group.name = 'yardFurniture';
  // Standing water: a flat gloss disc over each low spot that shows with the ground's wetness (`standingWater`).
  const water = k.puddles.map((p) => {
    const material = new THREE.MeshStandardMaterial({ color: 0x353a3f, roughness: 0.04, metalness: 0.15, transparent: true, opacity: 0, depthWrite: false });
    const geo = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
    const at = geo.getAttribute('position');
    for (let v = 0; v < at.count; v++) at.setY(v, ground(p.x + at.getX(v) * p.rx, p.z + at.getZ(v) * p.rz) - ground(p.x, p.z)); // lies on the ground, each vertex
    const disc = new THREE.Mesh(geo, material);
    disc.scale.set(p.rx, 1, p.rz);
    disc.position.set(p.x, ground(p.x, p.z) + 0.012, p.z);
    disc.receiveShadow = true;
    disc.visible = false;
    disc.userData.keepFar = true;
    group.add(disc);
    return disc;
  });
  /** Sets each puddle's sheet for `wet`; off altogether when dry, so it costs nothing then. */
  group.userData.setWet = (wet) => {
    const o = standingWater(wet);
    for (const d of water) {
      d.material.opacity = o;
      d.visible = o > 0.01;
    }
  };
  group.add(nettles({ layout, heights, random, drawDistance }));
  scene.add(group);
  return group;
}

/** Where nettles and weeds stand: along the barn's wall foot (not across its doors), at the pallets and tyres, the gully's edge and the gateposts. */
export function weedSpots(layout, random) {
  const k = layout.farmstead.yard;
  const spots = [];
  const wall = k.muckLines[0];
  const doorways = [[504.4, 508.5], [513.4, 517.9]].map(([a, b]) => [wall.x0 + (a - 501.8) - 0.3, wall.x0 + (b - 501.8) + 0.3]);
  for (let i = 0; i < 26; i++) {
    const x = wall.x0 + random() * (wall.x1 - wall.x0);
    if (doorways.some(([a, b]) => x > a && x < b)) continue;
    spots.push({ x, z: wall.z0 - 0.5 + random() * 0.55 });
  }
  const east = k.muckLines[1]; // and along the east end wall
  for (let i = 0; i < 12; i++) spots.push({ x: east.x0 - 0.3 + random() * 0.5, z: east.z0 + random() * (east.z1 - east.z0) });
  for (const at of [k.pallets, k.tyres]) for (let i = 0; i < 7; i++) spots.push({ x: at.x + (random() - 0.5) * 3, z: at.z + 0.8 + random() * 0.8 });
  for (const p of gatePosts(k.gates)) for (let i = 0; i < 4; i++) spots.push({ x: p.x + (random() - 0.5) * 1.2, z: p.z + (random() - 0.5) * 1.2 });
  for (let i = 0; i < 8; i++) spots.push({ x: k.gully.x + (random() - 0.5) * 2.4, z: k.gully.z + (random() - 0.5) * 2.4 });
  return spots;
}

/** Nettles and weeds as crossed cards, instanced by tile. */
function nettles({ layout, heights, random, drawDistance }) {
  const material = new THREE.MeshStandardMaterial({ map: nettleTexture(random), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 });
  const card = mergeGeometries([new THREE.PlaneGeometry(0.45, 0.45).translate(0, 0.22, 0), new THREE.PlaneGeometry(0.45, 0.45).rotateY(Math.PI / 2).translate(0, 0.22, 0)]);
  const up = new THREE.Vector3(0, 1, 0);
  const matrices = weedSpots(layout, random).map((p) => {
    const s = 0.5 + random() * 0.8;
    return new THREE.Matrix4().compose(new THREE.Vector3(p.x, heights.heightAt(p.x, p.z) - 0.02, p.z), new THREE.Quaternion().setFromAxisAngle(up, random() * 3.14), new THREE.Vector3(s, s, s));
  });
  const group = tiledInstances(card, material, matrices, { name: 'yardWeeds' });
  return drawDistance ? drawDistance.add(group, 'coverDistance') : group;
}

// The stackyard -------------------------------------------------------------------------------------------------------------------------------------------------------

/**
 * The stackyard's gear (the floor is `paintHardcore`): square bales stacked in bond at the Dutch barn's back, two round bales beside them, loose straw over the
 * hardcore, and a bale spike on its stand. Colliders for the stack and the round bales.
 */
export function buildStackyardKit({ scene, layout, heights, fixedBox, random }) {
  const k = layout.farmstead?.yard;
  if (!k) return null;
  const straw = new THREE.MeshStandardMaterial({ map: strawTexture(random), roughness: 1 });
  const twine = new THREE.MeshStandardMaterial({ color: 0x8b6a2c, roughness: 0.9 });
  const steel = new THREE.MeshStandardMaterial({ map: galvanisedTexture(random), roughness: 0.5, metalness: 0.5 });
  const looseStraw = new THREE.MeshStandardMaterial({ map: strawTexture(random), roughness: 1, side: THREE.DoubleSide });
  const b = bag();
  const ground = (x, z) => heights.heightAt(x, z);
  // Square bales, 0.8 by 0.45 by 0.4: three along, two deep, four courses, each course shifted half a bale so it ties.
  {
    const { x, z } = k.stack;
    const y0 = restingHeight(ground, x + 0.6, z + 0.2, 1.4, 0.5);
    for (let layer = 0; layer < 4; layer++) {
      for (let row = 0; row < 2; row++) {
        for (let i = 0; i < 3; i++) {
          const bx = x + i * 0.8 + (layer % 2 ? 0.4 : 0) - 0.4;
          const bz = z + row * 0.43;
          const y = y0 + layer * 0.45 + 0.225;
          b.add(straw, put(worldBox(0.8, 0.45, 0.4, 0.8), bx, y, bz));
          for (const dx of [-0.2, 0.2]) b.add(twine, put(worldBox(0.012, 0.436, 0.412, 1), bx + dx, y, bz));
        }
      }
    }
    fixedBox(x + 0.6, y0 + 0.9, z + 0.215, 1.4, 0.9, 0.42, 0);
  }
  // Round bales on their sides, 1.2 m across and wide, string in bands round the curved face.
  for (const { x: rx, z: rz } of k.round) {
    const y0 = restingHeight(ground, rx, rz, 0.6, 0.6);
    b.add(straw, put(new THREE.CylinderGeometry(0.6, 0.6, 1.2, 24), rx, y0 + 0.6, rz, 0, 0, Math.PI / 2));
    for (let i = 0; i < 4; i++) b.add(twine, put(new THREE.CylinderGeometry(0.606, 0.606, 0.014, 24), rx - 0.45 + i * 0.3, y0 + 0.6, rz, 0, 0, Math.PI / 2));
    fixedBox(rx, y0 + 0.6, rz, 0.6, 0.6, 0.6, 0);
  }
  // Loose straw: short stalks scattered flat on the hardcore, thickest by the stack.
  for (const [i, s] of k.straw.entries()) {
    for (let n = 0; n < 48; n++) {
      const r = 0.4 + random() * 2.0;
      const a = random() * 6.28;
      const px = s.x + Math.cos(a) * r;
      const pz = s.z + Math.sin(a) * r;
      // a stalk lies a little off flat, so no two lie on one plane
      b.add(looseStraw, put(new THREE.PlaneGeometry(0.3 + random() * 0.4, 0.05).rotateX(-Math.PI / 2), px, ground(px, pz) + 0.02 + ((i + n) % 5) * 0.004, pz, random() * 3.14, 0.08 + random() * 0.1, 0.05 + random() * 0.1));
    }
  }
  // The bale spike: a steel stand on a plate, a tapering spike on top, a gusset each side.
  {
    const { x, z } = k.spike;
    const y0 = restingHeight(ground, x, z, 0.35, 0.35);
    b.add(steel, put(worldBox(0.7, 0.04, 0.7, 0.5), x, y0 + 0.02, z));
    b.add(steel, put(worldBox(0.1, 0.45, 0.1, 0.5), x, y0 + 0.27, z));
    b.add(steel, put(new THREE.CylinderGeometry(0.012, 0.042, 1.2, 10), x, y0 + 1.07, z));
    for (const s of [-1, 1]) {
      b.add(steel, put(worldBox(0.035, 0.32, 0.035, 0.5), x + s * 0.12, y0 + 0.2, z, 0, 0, s * -0.5));
      b.add(steel, put(worldBox(0.035, 0.32, 0.035, 0.5), x, y0 + 0.2, z + s * 0.12, 0, s * 0.5, 0));
    }
    fixedBox(x, y0 + 0.5, z, 0.35, 0.5, 0.35, 0);
  }
  const group = b.group();
  group.name = 'stackyardKit';
  scene.add(group);
  return group;
}
