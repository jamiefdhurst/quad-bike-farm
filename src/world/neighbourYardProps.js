// The things a working dairy yard has about it (#911), drawn: the feed passage, the bale feeder and wrapped bales, the water trough and tap, the tools, the
// stores, the muck heap, the hens' coop, a cat on the wall, the kennel, the churn and name board at the gate, the lights and the marks on the concrete. Where each
// stands is the layout's (`furniture`, neighbourYard.js); this builds each in its own frame (origin on the ground at its place, along x and z, turned by its yaw)
// and returns meshes for the yard to merge by material with the house and the barn (neighbourFarmProps.js). The hens, the cat and the dog are set dressing, not the
// farm's animals: Cat, Dog and FarmAnimals (cat.js, dog.js, farmAnimals.js) are written for our own yard's places and tuning, so a second set would need machines of
// their own. Everything is lit stock material; the lamps glow by emissive only (`glow`, scaled by `setNight`), no light is added.

import * as THREE from 'three';
import { canvasTexture, worldBox } from './outbuildingProps.js';
import { piece } from './dairyKit.js';
import { lettered } from './dairyTextures.js';
import { yardMarks } from './neighbourYard.js';
import { paintSlabWear } from './concretePaint.js';
import { createRandom } from '../core/random.js';

const TAU = Math.PI * 2;
const std = (o) => new THREE.MeshStandardMaterial(o);

/** Chopped silage: yellow-green with darker clumps and the odd pale stalk. */
function silageTexture(random) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#7d8a3c';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 420; i++) {
      ctx.fillStyle = random() < 0.3 ? `rgba(60,70,25,${0.3 + random() * 0.3})` : `rgba(${150 + random() * 60},${150 + random() * 50},70,0.35)`;
      ctx.fillRect(random() * w, random() * h, 2 + random() * 10, 1 + random() * 2);
    }
  });
}

/** Black bale wrap: glossy dark with the pale lines where each layer laps, and a green-grey cast. */
function wrapTexture(random) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#1f2421';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 5 + random() * 4) {
      ctx.fillStyle = `rgba(150,165,155,${0.08 + random() * 0.1})`;
      ctx.fillRect(0, y, w, 1);
    }
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(random() * w, random() * h, 8 + random() * 14, 3 + random() * 5); // creases
    }
  });
}

/** Dry hay: pale gold stalks across the face, the baler's rings round it. */
function hayTexture(random) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#b79a52';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = `rgba(${110 + random() * 100},${90 + random() * 70},40,0.4)`;
      ctx.fillRect(random() * w, random() * h, 6 + random() * 20, 1);
    }
  });
}

/** Muck: dark brown, lumpy, with straw through it and wetter black patches. */
function muckTexture(random) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#3d2f1d';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = `rgba(${15 + random() * 20},${12 + random() * 14},8,${0.2 + random() * 0.25})`;
      ctx.beginPath();
      ctx.ellipse(random() * w, random() * h, 3 + random() * 9, 2 + random() * 6, random() * 3, 0, TAU);
      ctx.fill();
    }
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(${170 + random() * 50},${140 + random() * 50},70,0.55)`;
      ctx.fillRect(random() * w, random() * h, 3 + random() * 9, 1);
    }
  });
}

/** An intermediate bulk container's body: blue plastic, ribbed, a little dirty at the foot. */
function ibcTexture(random) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#3f6fae';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      ctx.fillStyle = 'rgba(0,20,60,0.22)';
      ctx.fillRect(0, y, w, 3);
    }
    const g = ctx.createLinearGradient(0, h * 0.7, 0, h);
    g.addColorStop(0, 'rgba(60,50,30,0)');
    g.addColorStop(1, 'rgba(60,50,30,0.4)');
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.7, w, h * 0.3);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(random() * w, random() * h, 2, 8);
    }
  });
}

/** A paper feed sack: buff, a printed band and a stitched mouth. One tile is a sack's face. */
function sackTexture(random) {
  return canvasTexture(64, 96, (ctx, w, h) => {
    ctx.fillStyle = '#c3aa7c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#7a3a2a';
    ctx.fillRect(0, h * 0.35, w, h * 0.2);
    ctx.fillStyle = '#e8dcc0';
    ctx.fillRect(6, h * 0.4, w - 12, 6);
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = `rgba(90,70,40,${0.05 + random() * 0.08})`;
      ctx.fillRect(random() * w, random() * h, 1 + random() * 3, 1);
    }
    ctx.fillStyle = 'rgba(60,45,25,0.6)';
    for (let x = 4; x < w; x += 6) ctx.fillRect(x, 5, 3, 1); // the stitching
  });
}

/** A faint rising wisp: soft white, thinner at the top. */
function steamTexture() {
  return canvasTexture(64, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h * 0.7, 2, w / 2, h * 0.55, h * 0.5);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

/** The materials the pieces add to the dairy's shared ones (`dairyMaterials`): kept few, as every one is a draw call in the yard. */
export function yardMaterials(random) {
  return {
    silage: std({ map: silageTexture(random), roughness: 1 }),
    wrap: std({ map: wrapTexture(random), roughness: 0.3, metalness: 0.05 }),
    hay: std({ map: hayTexture(random), roughness: 1 }),
    muck: std({ map: muckTexture(random), roughness: 0.95 }),
    ibc: std({ map: ibcTexture(random), roughness: 0.4 }),
    sack: std({ map: sackTexture(random), roughness: 0.9 }),
    lime: std({ map: lettered(['AGRI', 'LIME', '25 kg'], { ground: '#ecebe4', sizes: [24, 34, 18], w: 128, h: 96 }), roughness: 0.9 }),
    hen: std({ color: 0x8a4c24, roughness: 0.95 }),
    cat: std({ color: 0x26221f, roughness: 0.95 }),
    board: std({ map: lettered(['LOW HOLLINS', 'DAIRY FARM'], { ground: '#e6e2d2', ink: '#1f3b2c', sizes: [62, 50], w: 512, h: 192 }), roughness: 0.6 }),
    steam: std({ map: steamTexture(), transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, roughness: 1 }),
    lamp: std({ color: 0xe6e0c8, emissive: 0xffe0a0, emissiveIntensity: 0, roughness: 0.4 }),
  };
}

/** A seeded little generator, so a blob drawn from a mark's seed is the same each load. */
const seeded = (seed) => {
  let a = Math.floor(seed * 4294967296) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** An irregular blob (never a circle): a closed curve about (x, y) of half sizes rx by ry, its radius wandering by `rough` (0..1) round the turn. */
function blob(ctx, x, y, rx, ry, rot, seed, rough = 0.35) {
  const r = seeded(seed);
  const n = 14;
  const k = Array.from({ length: n }, () => 1 - rough * 0.5 + r() * rough);
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const m = k[i % n];
    const px = Math.cos(a) * rx * m;
    const py = Math.sin(a) * ry * m;
    const X = x + px * Math.cos(rot) - py * Math.sin(rot);
    const Y = y + px * Math.sin(rot) + py * Math.cos(rot);
    if (i === 0) ctx.moveTo(X, Y);
    else ctx.lineTo(X, Y);
  }
  ctx.closePath();
}

export const MARK_PX = 14; // pixels a metre in the yard's marks

/** Paints the marks (neighbourYard.js `yardMarks`) into a canvas over the slab, 14 px a metre: tracks, hooves, oil, puddle, straw, scrape, drips. */
export function paintYardMarks(ctx, slab, marks) {
  const px = (x) => (x - slab.minX) * MARK_PX;
  const pz = (z) => (z - slab.minZ) * MARK_PX;
  for (const m of marks) {
    const X = px(m.x);
    const Y = pz(m.z);
    const r = seeded(m.seed);
    ctx.save();
    ctx.translate(X, Y);
    ctx.rotate(-m.yaw); // yaw 0 runs along +z, which is down the canvas
    const w = m.w * MARK_PX;
    const d = m.d * MARK_PX;
    ctx.translate(0, 0);
    if (m.type === 'tyre') {
      ctx.fillStyle = `rgba(35,30,26,${0.16 + r() * 0.14})`;
      for (let i = 0; i < 5; i++) ctx.fillRect(-w / 2, -d / 2 + (i * d) / 5, w, d / 5 - 2); // the tread blocks
    } else if (m.type === 'hoof') {
      ctx.fillStyle = `rgba(70,52,30,${0.3 + r() * 0.2})`;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(s * 3, 0, 2, 4.2, 0, 0, TAU);
        ctx.fill();
      }
    } else if (m.type === 'oil') {
      ctx.rotate(m.yaw);
      for (let i = 0; i < 4; i++) {
        blob(ctx, (r() - 0.5) * w * 0.4, (r() - 0.5) * d * 0.4, (w / 2) * (0.5 + r() * 0.5), (d / 2) * (0.5 + r() * 0.5), r() * 3, r(), 0.5);
        ctx.fillStyle = `rgba(18,14,10,${0.18 + r() * 0.2})`;
        ctx.fill();
      }
    } else if (m.type === 'puddle') {
      ctx.rotate(m.yaw);
      blob(ctx, 0, 0, w / 2 + 6, d / 2 + 5, 0, m.seed, 0.45);
      ctx.fillStyle = 'rgba(95,90,80,0.45)'; // the wet rim
      ctx.fill();
      blob(ctx, 0, 0, w / 2, d / 2, 0, m.seed + 0.1, 0.4);
      ctx.fillStyle = 'rgba(62,76,88,0.6)';
      ctx.fill();
      blob(ctx, -w * 0.12, -d * 0.12, w * 0.22, d * 0.14, 0.2, m.seed + 0.2, 0.3); // the sky in it
      ctx.fillStyle = 'rgba(190,205,215,0.35)';
      ctx.fill();
    } else if (m.type === 'straw') {
      for (let i = 0; i < 160; i++) { // loose stalks, thicker towards the middle and drifting out
        const along = (r() - 0.5) * d;
        const across = (r() - 0.5) * w * (1 - Math.abs(along) / (d / 2)) * (0.3 + r());
        ctx.strokeStyle = `rgba(${196 + r() * 36},${170 + r() * 36},${96 + r() * 30},${0.35 + r() * 0.4})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(across, along);
        ctx.lineTo(across + (r() - 0.5) * 7, along + (r() - 0.5) * 7);
        ctx.stroke();
      }
    } else if (m.type === 'scrape') {
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = `rgba(${55 + r() * 20},${42 + r() * 14},24,${0.1 + r() * 0.12})`;
        ctx.fillRect((r() - 0.5) * w, (r() - 0.5) * d, 2 + r() * 4, 20 + r() * 60);
      }
    } else if (m.type === 'drip' || m.type === 'silage') {
      const col = m.type === 'drip' ? '28,26,24' : '70,66,20';
      blob(ctx, 0, 0, w * 0.4, d * 0.4, 0, m.seed, 0.5);
      ctx.fillStyle = `rgba(${col},0.42)`;
      ctx.fill();
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = `rgba(${col},0.2)`;
        ctx.fillRect((r() - 0.5) * w * 0.8, (r() - 0.5) * d * 0.9, 1.5, m.type === 'drip' ? 5 + r() * 9 : 12 + r() * 30);
      }
    }
    ctx.restore();
  }
}

/** One decal over the yard's concrete carrying every mark, the plane 6 mm above the slab's top. `y` is the slab's top. */
export function buildYardMarks(shape, random, y) {
  const slab = shape.slab;
  const w = slab.maxX - slab.minX;
  const d = slab.maxZ - slab.minZ;
  const marks = yardMarks(shape, random);
  const map = canvasTexture(Math.ceil(w * MARK_PX), Math.ceil(d * MARK_PX), (ctx) => {
    // The wear and the rim go under the marks: a polished path from the gateway to the barn door and the exposed aggregate at the slab's edge (#912).
    const gw = shape.gateway;
    const door = shape.barn.door;
    const at = (x, z) => [x - slab.minX, z - slab.minZ];
    const to = [door.x + (door.x > shape.barn.x ? 2.2 : -2.2), door.z];
    const from = [gw.x + (gw.side === 'west' ? 1 : -1), gw.z];
    paintSlabWear(ctx, MARK_PX, w, d, [at(...from), at((from[0] * 2 + to[0]) / 3, (from[1] * 2 + to[1]) / 3 + 0.8), at((from[0] + to[0] * 2) / 3, (to[1] * 2 + from[1]) / 3 - 0.5), at(...to)], createRandom(912), at(slab.minX + 7.5, slab.maxZ - 2.2)); // the slime by the puddle in the slab's low corner (neighbourYard.js `yardMarks`)
    paintYardMarks(ctx, slab, marks);
  });
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  const geo = new THREE.PlaneGeometry(w, d);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  mesh.position.set((slab.minX + slab.maxX) / 2, y + 0.006, (slab.minZ + slab.maxZ) / 2);
  mesh.name = 'yardMarks';
  mesh.castShadow = false;
  return { mesh, marks };
}

/** A pallet (1.2 by 1 m along x and z, 14.5 cm high) at (x, y, z) in `P`'s frame, turned `yaw` and rolled `roll`: three bearers under five top boards. */
function pallet(P, m, x, y, z, yaw = 0, w = 1.2, d = 1, roll = 0) {
  const sub = piece(0, 'pallet');
  for (let i = 0; i < 3; i++) sub.box(w, 0.09, 0.1, m.timber, 0, 0.045, -d / 2 + 0.05 + (i * (d - 0.1)) / 2, 0.6);
  for (let i = 0; i < 5; i++) sub.box(0.1, 0.022, d, m.timber, -w / 2 + 0.05 + (i * (w - 0.1)) / 4, 0.101, 0, 0.6); // the top boards, over the bearers
  const at = new THREE.Matrix4().makeRotationY(yaw).multiply(new THREE.Matrix4().makeRotationZ(roll)).setPosition(x, y, z);
  for (const o of [...sub.group.children]) {
    o.updateMatrix();
    o.applyMatrix4(at);
    P.group.add(o);
  }
}

/**
 * Builds every piece the layout lists, plus the barn's gable light, merged-ready: returns { group, glow, colliders } where `glow` is the lamp material to
 * scale by darkness. `shape` is `neighbourFarmShape`'s, `y0` the yard's ground, `dm` the dairy's shared materials (`dairyMaterials`), `fixedBox` makes a collider.
 */
export function buildYardFurniture(shape, y0, dm, { random, fixedBox = () => null, wallTop = 1.4 } = {}) {
  const ym = yardMaterials(random);
  const m = { ...dm, ...ym };
  const group = new THREE.Group();
  group.name = 'yardFurniture';
  const colliders = [];
  /** Builds a piece in its own frame with `fn(P)` (P: the dairy kit's shorthands at ground 0), then puts it at the piece's place, turned by its yaw. */
  const place = (f, fn, base = 0) => {
    const P = piece(0, f.kind);
    fn(P, f);
    const at = new THREE.Matrix4().makeRotationY(f.yaw ?? 0).setPosition(f.x, y0 + base, f.z);
    for (const o of [...P.group.children]) {
      o.updateMatrix();
      o.applyMatrix4(at);
      group.add(o);
    }
  };
  /** A collider for a block of the piece: its centre (dx, dz) in its frame, half sizes and height. */
  const solid = (f, dx, dz, hx, hy, hz, lift = 0) => {
    const c = Math.cos(f.yaw ?? 0);
    const s = Math.sin(f.yaw ?? 0);
    colliders.push(fixedBox(f.x + dx * c + dz * s, y0 + lift + hy, f.z - dx * s + dz * c, hx, hy, hz, f.yaw ?? 0));
  };
  const ring = (P, r, tube, mat, y, seg = 18) => P.add(new THREE.TorusGeometry(r, tube, 5, seg), mat, 0, y, 0, 0, Math.PI / 2, 0);

  const make = {
    silageTrough(P, f) {
      const L = f.hx * 2;
      P.box(L - 0.18, 0.08, 0.62, m.concrete, 0, 0.04, 0, 3); // the floor between the walls
      for (const s of [-1, 1]) P.box(L, 0.56, 0.09, m.concrete, 0, 0.28, s * 0.355, 3);
      for (const s of [-1, 1]) P.box(0.09, 0.56, 0.62, m.concrete, s * (f.hx - 0.045), 0.28, 0, 3); // the ends, between the long walls
      P.box(L + 0.06, 0.04, 0.14, m.galv, 0, 0.58, 0.355, 1); // the steel cap along the front lip
      for (let i = 0; i < 9; i++) P.add(new THREE.SphereGeometry(0.4, 8, 6), m.silage, -f.hx + 0.9 + i * 1.15, 0.5, (i % 2) * 0.05, 0, 0).scale.set(1.5, 0.55, 0.85);
      solid(f, 0, 0, f.hx, 0.3, 0.4);
    },
    mineralTub(P, f) {
      pallet(P, m, 0, 0, 0);
      P.tube(0.32, 0.42, m.drum, 0.05, 0.36, 0, 'y', 0.3);
      P.tube(0.28, 0.02, m.muck, 0.05, 0.58, 0, 'y', 0.28); // the lick, dark and molasses-sticky
      P.tube(0.34, 0.03, m.rubber, 0.05, 0.575 - 0.035, 0, 'y', 0.34, 12); // the rim
      solid(f, 0, 0, 0.6, 0.3, 0.5);
    },
    balefeeder(P, f) {
      const R = 1.0;
      for (const y of [0.22, 0.6, 0.98]) ring(P, R, 0.032, m.galv, y, 22);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        P.tube(0.022, 1.0, m.galv, Math.cos(a) * R, 0.53, Math.sin(a) * R, 'y', 0.022, 5); // on the feet, 3 cm up
      }
      for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) P.box(0.1, 0.06, 0.4, m.galv, Math.cos(a) * R, 0.03, Math.sin(a) * R, 0.5, a); // the feet
      P.tube(0.7, 1.15, m.hay, 0.05, 0.58, 0.04, 'y', 0.68, 14); // the bale, half eaten and lopsided
      P.tube(0.62, 0.04, m.hay, 0.05, 1.17, 0.04, 'y', 0.6, 14);
      solid(f, 0, 0, 1.0, 0.5, 1.0);
    },
    wrappedBale(P, f) {
      const r = 0.62;
      P.tube(r, 1.2, m.wrap, 0, 0.6, 0, 'y', r - 0.03, 14);
      P.tube(r - 0.1, 0.02, m.silage, 0.02, 1.215, 0, 'y', r - 0.1, 12).scale.set(1, 1, 0.9); // the torn top, the grass showing
      const rr = seeded(f.x + f.z);
      for (let i = 0; i < 6; i++) { // the strips of wrap hanging off the torn edge
        const a = rr() * TAU;
        const s = P.box(0.04, 0.4 + rr() * 0.3, 0.14, m.wrap, Math.cos(a) * (r - 0.06), 1.0, Math.sin(a) * (r - 0.06), 0.6, -a + Math.PI / 2);
        s.rotation.z = 0.15 + rr() * 0.2;
      }
      solid(f, 0, 0, 0.62, 0.6, 0.62);
    },
    waterTrough(P, f) {
      const L = f.hx * 2;
      P.box(L - 0.06, 0.05, 0.56, m.galv, 0, 0.025, 0, 1); // the floor, between the walls
      for (const s of [-1, 1]) P.box(L, 0.45, 0.04, m.galv, 0, 0.25, s * 0.3, 1);
      for (const s of [-1, 1]) P.box(0.04, 0.45, 0.56, m.galv, s * (f.hx - 0.02), 0.25, 0, 1); // the ends, between the long walls
      P.box(L - 0.1, 0.02, 0.5, m.glass, 0, 0.4, 0, 1); // the water, a little under the lip
      for (const s of [-1, 1]) P.tube(0.022, L + 0.04, m.galv, 0, 0.485, s * 0.3, 'x', 0.022, 6); // the rolled rim
      P.box(0.04, 0.3, 0.04, m.galv, -f.hx + 0.2, 0.62, -0.25, 0.3); // the ball cock's arm, up from the end
      P.between([-f.hx + 0.2, 0.46, -0.25], [-f.hx + 0.5, 0.5, -0.05], 0.012, m.galv, 5);
      P.add(new THREE.SphereGeometry(0.075, 8, 6), m.rubber, -f.hx + 0.5, 0.455, -0.05); // the float
      solid(f, 0, 0, f.hx, 0.25, 0.32);
    },
    hoseHook(P, f) {
      P.box(0.05, 0.05, 0.26, m.galv, 0, 1.5, -0.07, 0.3); // the hook's arm out from the wall (at local z -0.2)
      for (let i = 0; i < 4; i++) P.add(new THREE.TorusGeometry(0.28 - i * 0.045, 0.024, 5, 20), m.hose, 0, 1.25 - i * 0.02, -0.12 + i * 0.045); // the hose coiled, on the hook, each turn inside the last
      P.between([0.2, 1.1, 0.05], [0.45, 0.35, 0.1], 0.022, m.hose, 5); // the free end hanging down
      P.tube(0.03, 0.06, m.galv, 0.45, 0.31, 0.1, 'y', 0.03, 6); // its coupling
    },
    yardTap(P, f) {
      P.box(0.3, 0.12, 0.3, m.concrete, 0, 0.06, 0, 1);
      P.tube(0.027, 0.85, m.galv, 0, 0.55, 0, 'y', 0.027, 6);
      P.tube(0.02, 0.1, m.galv, 0.1, 0.92, 0, 'y', 0.02, 6); // the spout
      P.box(0.1, 0.02, 0.025, m.washer, 0, 1.0, 0, 0.3); // the wheel handle
      P.box(0.04, 0.04, 0.34, m.galv, 0, 0.7, -0.15, 0.3); // the clip back to the wall
    },
    leaningTools(P) {
      const lean = (z, x1, top, headFn) => {
        P.between([0.2, 0.03, z], [-0.3, top, z], 0.017, m.timber, 5);
        headFn(z);
      };
      lean(-0.32, 0, 1.5, (z) => { // a yard brush: the head along the wall
        P.box(0.08, 0.06, 0.45, m.timber, 0.2, 0.05, z + 0.0, 0.3);
        P.box(0.12, 0.1, 0.43, m.hay, 0.23, 0.04, z + 0.0, 0.3);
      });
      lean(0.0, 0, 1.4, (z) => { // a shovel: the blade at the foot
        P.box(0.025, 0.3, 0.24, m.galv, 0.2, 0.15, z, 0.3).rotation.z = 0.12;
        P.box(0.1, 0.03, 0.14, m.timber, -0.28, 1.4, z, 0.3); // the D-handle
      });
      lean(0.32, 0, 1.55, (z) => { // a muck fork: four tines
        for (let i = -1.5; i <= 1.5; i++) P.box(0.015, 0.3, 0.015, m.galv, 0.2, 0.15, z + i * 0.055, 0.3);
        P.box(0.03, 0.04, 0.2, m.galv, 0.2, 0.31, z, 0.3);
      });
    },
    barrow(P, f) {
      P.box(0.6, 0.28, 0.85, m.green, 0.0, 0.5, 0.05, 0.6).rotation.x = 0; // the tray
      P.box(0.5, 0.04, 0.7, m.green, 0.0, 0.63, 0.05, 0.6);
      P.tube(0.2, 0.07, m.rubber, 0, 0.2, 0.62, 'x', 0.2, 10); // the wheel
      P.tube(0.04, 0.12, m.galv, 0, 0.2, 0.62, 'x', 0.04, 6);
      for (const s of [-1, 1]) {
        P.between([s * 0.22, 0.45, 0.45], [s * 0.3, 0.9, -0.7], 0.018, m.galv, 5); // the handles
        P.box(0.03, 0.4, 0.03, m.galv, s * 0.24, 0.2, -0.28, 0.3); // the legs
      }
    },
    scrapeBlade(P, f) {
      P.box(2.4, 0.5, 0.06, m.washer, 0, 0.5, 0.1, 0.6).rotation.x = -0.3; // the mouldboard, painted steel
      P.box(2.4, 0.1, 0.08, m.rubber, 0, 0.27, -0.01, 0.6); // the rubber edge
      for (const x of [-0.8, 0, 0.8]) P.box(0.05, 0.42, 0.05, m.dark, x, 0.52, 0.2, 0.3).rotation.x = -0.3; // the ribs behind it
      P.box(2.4, 0.04, 0.04, m.galv, 0, 0.78, 0.0, 0.3); // the top lip
      for (const s of [-1, 1]) {
        P.box(0.08, 0.7, 0.08, m.washer, s * 0.55, 0.55, 0.28, 0.4); // the headstock's uprights
        P.between([s * 0.55, 0.85, 0.28], [s * 0.7, 0.3, 0.9], 0.03, m.washer, 6); // the lift arms back
        P.tube(0.025, 0.5, m.galv, s * 0.9, 0.25, 0.4, 'y', 0.025, 6); // the standing legs
      }
      P.box(1.1, 0.06, 0.06, m.washer, 0, 0.9, 0.28, 0.4); // the top bar
      solid(f, 0, 0.3, 1.3, 0.45, 0.5);
    },
    palletStack(P, f) {
      const rr = seeded(f.x * 7 + f.z);
      for (let i = 0; i < 5; i++) pallet(P, m, (rr() - 0.5) * 0.08, i * 0.145, (rr() - 0.5) * 0.08, (rr() - 0.5) * 0.12);
      pallet(P, m, 0.5, 0.55, 0.38, Math.PI / 2, 1.2, 1, -1.25); // one leaning on the stack
      solid(f, 0, 0, 0.6, 0.4, 0.5);
    },
    limeBags(P, f) {
      pallet(P, m, 0, 0, 0, 0.1, 0.8, 0.6);
      for (let i = 0; i < 2; i++) P.add(worldBox(0.55, 0.14, 0.34, 0.55, 0.34), m.lime, 0, 0.215 + i * 0.145, 0.0, i * 0.3);
      P.box(0.3, 0.012, 0.22, m.white, 0.62, 0.008, 0.2, 0.3); // the spill where a corner split
      solid(f, 0, 0, 0.4, 0.25, 0.3);
    },
    feedSacks(P) {
      for (let i = 0; i < 4; i++) P.add(worldBox(0.5, 0.035, 0.74, 0.5, 0.74), m.sack, (i % 2) * 0.03, 0.05 + i * 0.04, 0, i * 0.1 - 0.15);
      for (const z of [-0.18, 0.18]) P.box(0.54, 0.2, 0.015, m.timber, 0, 0.1, z, 0.3); // the baler twine round them
    },
    tyreStack(P, f) {
      const rr = seeded(f.x + f.z * 3);
      for (let i = 0; i < 6; i++) P.add(new THREE.TorusGeometry(0.28, 0.12, 6, 16).rotateX(Math.PI / 2), m.rubber, (rr() - 0.5) * 0.06, 0.12 + i * 0.22, (rr() - 0.5) * 0.06);
      P.tube(0.25, 0.015, m.timber, 0, 1.33, 0, 'y', 0.25, 10); // a board over the top, stones on it
      solid(f, 0, 0, 0.4, 0.7, 0.4);
    },
    ibcTank(P, f) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(0.07, 0.6, 0.07, m.galv, sx * 0.5, 0.3, sz * 0.5, 0.3);
      for (const y of [0.1, 0.55]) for (const s of [-1, 1]) { // the stand's rails (the z ones a hair higher, so no two share a plane at the corners)
        P.box(1.0, 0.05, 0.05, m.galv, 0, y, s * 0.5, 0.3);
        P.box(0.05, 0.05, 1.0, m.galv, s * 0.5, y + 0.012, 0, 0.3);
      }
      P.box(1.0, 0.04, 1.0, m.galv, 0, 0.62, 0, 1); // the deck
      P.add(worldBox(0.98, 0.98, 0.98, 1, 1), m.ibc, 0, 1.14, 0);
      for (let k = 0; k < 4; k++) for (const s of [-1, 1]) { // the cage: bars round the body
        P.box(1.0, 0.025, 0.025, m.galv, 0, 0.75 + k * 0.28, s * 0.51, 0.3);
        P.box(0.025, 0.025, 1.0, m.galv, s * 0.51, 0.762 + k * 0.28, 0, 0.3);
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(0.04, 0.96, 0.04, m.galv, sx * 0.51, 1.13, sz * 0.51, 0.3);
      P.tube(0.07, 0.05, m.rubber, 0.2, 1.65, 0.2, 'y', 0.07, 8); // the fill cap
      P.tube(0.03, 0.12, m.galv, -0.54, 0.74, 0.0, 'x', 0.03, 6); // the drain valve low on the front
      P.box(0.03, 0.12, 0.03, m.washer, -0.6, 0.74, 0.0, 0.3); // its lever
      solid(f, 0, 0, 0.55, 0.82, 0.55);
    },
    muckHeap(P, f) {
      for (const [x, z, r, sy] of [[0, 0.8, 2.0, 0.75], [-1.5, 1.2, 1.5, 0.7], [1.6, 1.0, 1.5, 0.7], [0, 2.0, 1.6, 0.8], [-2, -0.3, 1.1, 0.55], [1.8, -0.4, 1.0, 0.55], [0, -0.9, 1.0, 0.5]]) {
        P.add(new THREE.SphereGeometry(r, 10, 7), m.muck, x, r * sy * 0.55, z).scale.set(1, sy, 1);
      }
      P.add(new THREE.SphereGeometry(3.3, 10, 5), m.muck, 0, 0.02, 0.2).scale.set(1, 0.025, 0.95); // the spread at its foot
      for (const s of [-1, 1]) {
        const plank = P.box(0.3, 0.05, 3.1, m.timber, s * 0.17, 0.6, -2.25, 0.6);
        plank.rotation.x = -Math.atan2(1.08, 2.9); // up towards the heap (+z)
      }
      for (let i = 0; i < 4; i++) P.box(0.8, 0.03, 0.06, m.timber, 0, 0.18 + i * 0.27, -3.5 + i * 0.85, 0.3).rotation.x = -Math.atan2(1.08, 2.9); // the cleats
      for (const [x, z] of [[-0.2, 0.9], [0.7, 1.5]]) P.add(new THREE.PlaneGeometry(2.2, 2.2), m.steam, x, 1.9, z, x * 3); // a little steam off the top
      solid(f, 0, 0.8, 2.6, 0.5, 2.2);
    },
    henCoop(P, f) {
      const run = (x0, x1, z0, z1) => {
        for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [(x0 + x1) / 2, z1], [(x0 + x1) / 2, z0]]) P.box(0.07, 1.3, 0.07, m.timber, x, 0.65, z, 0.4);
        for (const y of [0.2, 0.7, 1.25]) {
          P.box(x1 - x0, 0.04, 0.04, m.timber, (x0 + x1) / 2, y, z0, 0.4);
          P.box(x1 - x0, 0.04, 0.04, m.timber, (x0 + x1) / 2, y, z1, 0.4);
          P.box(0.04, 0.04, z1 - z0, m.timber, x0, y, (z0 + z1) / 2, 0.4);
          P.box(0.04, 0.04, z1 - z0, m.timber, x1, y, (z0 + z1) / 2, 0.4);
        }
      };
      run(-1.55, 1.55, -1.25, 1.25);
      P.box(1.3, 0.75, 1.0, m.green, -0.8, 0.7, 0, 0.6); // the house on its legs
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(0.07, 0.35, 0.07, m.timber, -0.8 + sx * 0.55, 0.17, sz * 0.4, 0.4);
      for (const s of [-1, 1]) P.box(1.5, 0.03, 0.62, m.galv, -0.8, 1.2, s * 0.3, 1).rotation.x = -s * 0.42; // the pitched tin roof
      P.box(0.28, 0.32, 0.03, m.dark, -0.15, 0.75, 0.1, 0.3); // the pop-hole
      P.box(0.3, 0.03, 0.55, m.timber, -0.05, 0.4, 0.1, 0.3).rotation.z = 0.5; // the ramp
      P.box(0.5, 0.35, 0.3, m.timber, -0.8, 0.62, 0.66, 0.4); // the nest box on the side
      for (const [x, z, a] of [[0.6, 0.3, 0.4], [-0.1, -0.7, 2.2], [0.9, -0.5, 4]]) {
        const hen = new THREE.Group();
        const part = (geo, mt, px, py, pz) => { const o = new THREE.Mesh(geo, mt); o.position.set(px, py, pz); hen.add(o); return o; };
        part(new THREE.SphereGeometry(0.15, 8, 6), m.hen, 0, 0.28, 0).scale.set(1, 0.85, 1.35);
        part(new THREE.SphereGeometry(0.065, 6, 5), m.hen, 0.0, 0.43, 0.15);
        part(new THREE.BoxGeometry(0.015, 0.045, 0.05), m.washer, 0, 0.5, 0.15); // the comb
        part(new THREE.BoxGeometry(0.03, 0.1, 0.12), m.hen, 0, 0.36, -0.2).rotation.x = 0.4; // the tail
        for (const s of [-1, 1]) part(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 4), m.galv, s * 0.05, 0.08, 0);
        const mtx = new THREE.Matrix4().makeRotationY(a).setPosition(x, 0, z);
        for (const o of hen.children) { o.updateMatrix(); o.applyMatrix4(mtx); P.group.add(o); }
      }
      solid(f, -0.8, 0, 0.7, 0.6, 0.5, 0.2);
    },
    catOnWall(P) {
      P.add(new THREE.SphereGeometry(0.15, 8, 6), m.cat, 0, 0.15, 0).scale.set(1, 0.95, 1.4);
      P.add(new THREE.SphereGeometry(0.085, 8, 6), m.cat, 0.1, 0.33, 0);
      P.add(new THREE.SphereGeometry(0.06, 6, 5), m.white, 0.12, 0.2, 0).scale.set(0.8, 1, 1);
      for (const s of [-1, 1]) P.add(new THREE.ConeGeometry(0.03, 0.06, 4), m.cat, 0.1, 0.42, s * 0.05);
      P.between([-0.0, 0.1, -0.18], [0.1, 0.03, -0.45], 0.025, m.cat, 5); // the tail curling round
      P.between([0.1, 0.03, -0.45], [0.2, 0.03, -0.35], 0.02, m.cat, 5);
    },
    kennel(P, f) {
      P.box(1.0, 0.78, 0.9, m.green, 0, 0.45, 0, 0.6);
      P.box(0.05, 0.05, 0.86, m.timber, -0.5, 0.06, 0, 0.3);
      P.box(0.4, 0.5, 0.03, m.dark, -0.505, 0.35, 0, 0.3); // the doorway, dark
      for (const s of [-1, 1]) P.box(1.2, 0.04, 0.6, m.galv, 0, 0.93, s * 0.28, 1).rotation.x = -s * 0.55;
      for (const z of [-0.45, 0.45]) P.box(1.08, 0.05, 0.05, m.timber, 0, 0.12, z, 0.3);
      // The chain: from a ring by the door to a stake, its links lying along the ground.
      for (let i = 0; i < 14; i++) {
        const t = i / 13;
        P.box(0.05, 0.016, 0.028, m.galv, -0.6 - t * 1.7, 0.012, 0.25 + t * 0.4 + Math.sin(t * 3) * 0.1, 0.3).rotation.y = (i % 2) * 1.2;
      }
      P.tube(0.025, 0.4, m.galv, -2.3, 0.2, 0.65, 'y', 0.025, 5); // the stake
      solid(f, 0, 0, 0.55, 0.5, 0.45);
    },
    dogBowl(P) {
      P.tube(0.14, 0.07, m.galv, 0, 0.035, 0, 'y', 0.11, 10);
      P.tube(0.1, 0.01, m.glass, 0, 0.075, 0, 'y', 0.1, 10); // the water
    },
    bootsAtDoor(P) {
      for (const [x, z, a] of [[0, 0, 0.2], [0.24, 0.06, -0.1]]) {
        const b = new THREE.Group();
        const part = (geo, px, py, pz) => { const o = new THREE.Mesh(geo, m.green); o.position.set(px, py, pz); b.add(o); };
        part(new THREE.CylinderGeometry(0.075, 0.085, 0.36, 8), 0, 0.2, 0);
        part(new THREE.BoxGeometry(0.1, 0.09, 0.26), 0, 0.045, 0.07);
        const mtx = new THREE.Matrix4().makeRotationY(a).setPosition(x, 0, z);
        for (const o of b.children) { o.updateMatrix(); o.applyMatrix4(mtx); P.group.add(o); }
      }
      P.box(0.7, 0.02, 0.4, m.timber, 0.75, 0.01, 0.0, 0.3);
    },
    churnStand(P, f) {
      P.box(0.95, 0.9, 0.55, m.block, 0, 0.45, 0, 1.2);
      P.box(1.05, 0.06, 0.65, m.timber, 0, 0.93, 0, 0.6); // the platform's top, overhanging
      const churn = new THREE.LatheGeometry([[0.001, 0], [0.19, 0.0], [0.215, 0.05], [0.2, 0.12], [0.19, 0.5], [0.17, 0.6], [0.105, 0.68], [0.1, 0.74], [0.12, 0.76], [0.001, 0.78]].map(([x, y]) => new THREE.Vector2(x, y)), 12);
      for (const s of [-1, 1]) {
        P.add(churn, m.galv, s * 0.24, 0.96, 0);
        P.add(new THREE.TorusGeometry(0.06, 0.012, 4, 8), m.galv, s * 0.24 + 0.12, 1.62, 0, 0, 0, 0.5).rotation.y = 0; // a handle each side of the neck
        P.add(new THREE.TorusGeometry(0.06, 0.012, 4, 8), m.galv, s * 0.24 - 0.12, 1.62, 0, 0, 0, -0.5);
      }
      solid(f, 0, 0, 0.5, 0.5, 0.3);
    },
    nameBoard(P, f) {
      for (const s of [-1, 1]) P.box(0.13, 2.2, 0.13, m.timber, 0, 1.1, s * 0.92, 0.6);
      P.add(worldBox(0.06, 0.72, 1.9, 1.9, 0.72), m.board, 0, 1.55, 0);
      for (const y of [1.55 - 0.375, 1.55 + 0.375]) P.box(0.09, 0.05, 1.98, m.timber, 0, y, 0, 0.6); // the frame's top and bottom
      for (const s of [-1, 1]) P.box(0.09, 0.76, 0.05, m.timber, 0, 1.55, s * 0.975, 0.6);
      P.box(0.17, 0.05, 0.17, m.timber, 0, 2.22, 0.92, 0.6);
      P.box(0.17, 0.05, 0.17, m.timber, 0, 2.22, -0.92, 0.6);
      solid(f, 0, 0.92, 0.07, 1.1, 0.07);
      solid(f, 0, -0.92, 0.07, 1.1, 0.07);
    },
    yardLight(P, f) {
      P.box(0.3, 0.05, 0.3, m.galv, 0, 0.025, 0, 1);
      P.tube(0.06, 5.5, m.galv, 0, 2.8, 0, 'y', 0.075, 8);
      P.box(0.9, 0.08, 0.1, m.galv, 0.4, 5.5, 0, 0.5);
      P.box(0.5, 0.1, 0.28, m.galv, 0.8, 5.52, 0, 0.5); // the hood
      P.box(0.44, 0.04, 0.22, m.lamp, 0.8, 5.455, 0, 0.5); // the lens, glowing at night
      solid(f, 0, 0, 0.1, 2.75, 0.1);
    },
  };
  for (const f of shape.furniture) {
    const fn = make[f.kind];
    if (!fn) continue;
    place(f, fn, f.kind === 'catOnWall' ? wallTop : f.kind === 'bootsAtDoor' ? 0.15 : 0);
  }
  // The barn's gable light: a backplate, a hood and a lens on the gable over the big door (the barn's door is in its gable wall).
  const b = shape.barn;
  const dir = b.door.x > b.x ? 1 : -1;
  const face = dir > 0 ? b.outer.maxX : b.outer.minX;
  const P = piece(0, 'gableLight');
  P.box(0.06, 0.34, 0.28, m.galv, dir * 0.03, 0, 0, 0.5);
  P.box(0.3, 0.1, 0.3, m.galv, dir * 0.2, 0.1, 0, 0.5);
  P.box(0.24, 0.04, 0.24, m.lamp, dir * 0.2, 0.03, 0, 0.5);
  const at = new THREE.Matrix4().setPosition(face - dir * 0.01, y0 + 5.7, b.door.z);
  for (const o of [...P.group.children]) { o.updateMatrix(); o.applyMatrix4(at); group.add(o); }
  return { group, glow: m.lamp, steam: m.steam, colliders: colliders.filter(Boolean) };
}
