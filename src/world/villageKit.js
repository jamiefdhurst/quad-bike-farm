// The village's building kit (world/villageProps.js): a gabled shell with an eaved tiled roof, bargeboards, gutters and downpipes, chimney stacks with
// pots, sash windows with frames, cills and lintels, bays, doors with surrounds, porches and dormers. Everything is built in a building's own frame
// (x along the frontage, y up from its floor, +z the front, facing the road) and the group is turned to the road with `yaw` (0 or Math.PI, so a
// footprint stays a plain rectangle in the world). Pieces are plain boxes that overlap where they meet, so there is no gap to see through.

import * as THREE from 'three';
import { worldBox } from './outbuildingProps.js';

/** A building's frame: the group its pieces go in, the floor's height, and the colliders in world terms. */
export class Frame {
  constructor({ group, x, z, yaw, y0, fixedBox }) {
    Object.assign(this, { group, x, z, yaw, y0, fixedBox });
    this.cos = Math.round(Math.cos(yaw));
  }

  /** Adds a mesh at a local position. */
  add(geo, material, x, y, z, rotY = 0) {
    const o = new THREE.Mesh(geo, material);
    o.position.set(x, y, z);
    o.rotation.y = rotY;
    this.group.add(o);
    return o;
  }

  /** A box `w` by `h` by `d`, its texture `tile` metres a repeat. */
  box(w, h, d, material, x, y, z, tile = 1.2) {
    return this.add(worldBox(w, h, d, tile), material, x, y, z);
  }

  /** The world position of a local (x, z). */
  world(lx, lz) {
    return { x: this.x + lx * this.cos, z: this.z + lz * this.cos };
  }

  /** A collider for a local box (centre lx, y above the floor, lz; half sizes). */
  solid(lx, y, lz, hx, hy, hz) {
    const p = this.world(lx, lz);
    return this.fixedBox(p.x, this.y0 + y, p.z, hx, hy, hz);
  }
}

/** A gable end: a triangle `width` wide and `rise` high, `depth` thick, in the plane facing along x (x = `x`), standing on y = `base`. */
function gableGeometry(width, rise, depth, tile = 1.5, vOffset = 0) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(0, rise);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / tile, uv.getY(i) / tile + vOffset);
  geo.translate(0, 0, -depth / 2);
  geo.rotateY(Math.PI / 2);
  return geo;
}

/**
 * The walls and the roof. `b`: { halfX, halfZ, wallHeight, ridge }. `m`: { wall, roof, ridgeCap, fascia, iron, stone }. Walls are a plinth and a block
 * (the block's foot sunk 0.4 m so no gap shows on a slope); the roof overhangs the eaves by `eave` and the gables by `verge`, with fascia and
 * barge boards, ridge tiles, gutters on both slopes and a downpipe at the corner each end. Returns where the eaves and ridge are.
 */
export function shellAndRoof(f, b, m, { eave = 0.4, verge = 0.28, plinth = 0.5, plinthMat = null, thick = 0.1, gutters = true, solidWalls = true } = {}) {
  const { halfX, halfZ, wallHeight: wH, ridge: R } = b;
  const sink = 0.4;
  if (solidWalls) f.box(halfX * 2, wH + sink, halfZ * 2, m.wall, 0, (wH - sink) / 2, 0, 1.2);
  if (solidWalls) f.box(halfX * 2 + 0.08, plinth + sink, halfZ * 2 + 0.08, plinthMat ?? m.stone, 0, (plinth - sink) / 2, 0, 1);
  // The gables, set into the ends of the roof.
  for (const side of [-1, 1]) f.add(gableGeometry(halfZ * 2, R - wH, 0.4, 1.2, (wH + sink) / 1.2), m.wall, side * (halfX - 0.2), wH, 0);
  const over = halfZ + eave;
  const drop = (R - wH) * (over / halfZ);
  const slope = Math.hypot(over, drop);
  const pitch = Math.atan2(drop, over);
  const len = halfX * 2 + verge * 2;
  for (const side of [-1, 1]) {
    const slab = f.box(len, thick, slope, m.roof, 0, R + thick / 2 - drop / 2, (side * over) / 2, 1);
    slab.rotation.x = side * pitch;
    // The fascia along the eave's edge and the gutter on it.
    const lowY = R + thick / 2 - drop - 0.02;
    f.box(len, 0.16, 0.035, m.fascia, 0, lowY - 0.07, side * (over + 0.02), 0.6);
    if (gutters) {
      // A half-round trough hung from the fascia, open at the top (the half-cylinder's curve faces down), with its ends stopped by the caps.
      const g = f.add(new THREE.CylinderGeometry(0.07, 0.07, len - 0.1, 10, 1, false, 0, Math.PI), m.gutter ?? m.iron, 0, lowY - 0.01, side * (over + 0.07));
      g.rotation.z = -Math.PI / 2;
    }
    // A soffit closing the underside of the overhang: flat at the fascia's lower edge, from the wall out to it (never above the roof's slope).
    f.box(len - 0.1, 0.03, eave + 0.05, m.fascia, 0, lowY - 0.135, side * (halfZ + (eave + 0.05) / 2 - 0.05), 0.6);
  }
  // The barge boards climbing each gable edge, and the ridge tiles.
  const bargeLen = Math.hypot(over, drop) + 0.05;
  for (const side of [-1, 1]) {
    for (const zs of [-1, 1]) {
      const bd = f.box(0.035, 0.2, bargeLen, m.fascia, side * (halfX + verge), R - drop / 2 - 0.02, (zs * over) / 2, 0.6);
      bd.rotation.x = zs * pitch;
    }
  }
  const ridgeCap = f.box(len, 0.16, 0.16, m.ridgeCap ?? m.roof, 0, R + thick + 0.02, 0, 0.6);
  ridgeCap.rotation.x = Math.PI / 4;
  // Downpipes at the front corners and the back: a swan neck from the gutter in to the wall, then straight down into the ground.
  if (gutters) {
    const reach = over + 0.07 - (halfZ + 0.06); // how far the gutter stands out from the wall
    const neckDrop = 0.45;
    const neckLen = Math.hypot(reach, neckDrop);
    const gutterY = R + thick / 2 - drop - 0.02 - 0.01;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const px = sx * (halfX - 0.2);
        const neck = f.add(new THREE.CylinderGeometry(0.035, 0.035, neckLen, 8), m.iron, px, gutterY - neckDrop / 2, sz * (halfZ + 0.06 + reach / 2));
        neck.rotation.x = sz * Math.atan2(reach, neckDrop);
        const top = gutterY - neckDrop;
        f.add(new THREE.CylinderGeometry(0.035, 0.035, top + sink, 8), m.iron, px, (top - sink) / 2, sz * (halfZ + 0.06));
      }
    }
  }
  return { over, drop, pitch, lowY: R + thick / 2 - drop };
}

/**
 * A chimney stack on the roof at local x, standing on the gable: a brick or stone stack with a lead flashing round its foot, a drip course, a cap
 * slab and `pots` clay pots. `rise` is how far it stands above the ridge. Returns nothing.
 */
export function chimney(f, b, m, x, { pots = 2, rise = 1.3, w = 0.95, d = 0.7, mat = null } = {}) {
  const stack = mat ?? m.brick;
  const foot = b.wallHeight - 0.3;
  const top = b.ridge + rise;
  f.box(w, top - foot, d, stack, x, (foot + top) / 2, 0, 1);
  f.box(w + 0.18, 0.1, d + 0.18, m.stone, x, top - 0.25, 0, 1); // the drip course
  f.box(w + 0.14, 0.12, d + 0.14, m.stone, x, top + 0.04, 0, 1); // the cap
  f.box(w + 0.1, 0.08, d + 0.1, m.lead, x, b.ridge - 0.02, 0, 1); // flashing where it meets the ridge
  const potMat = m.pot;
  for (let i = 0; i < pots; i++) {
    const px = x + (i - (pots - 1) / 2) * (w / pots + 0.04) * 0.9;
    f.add(new THREE.CylinderGeometry(0.1, 0.13, 0.34, 10), potMat, px, top + 0.27, 0);
    f.add(new THREE.CylinderGeometry(0.12, 0.1, 0.06, 10), potMat, px, top + 0.46, 0); // the rim
  }
}

/**
 * A window in the wall facing `face` (+1 front, -1 back) at local x, with its centre `y` up. Sashes behind a painted frame with a middle bar, a
 * projecting stone cill on two corbels, and a lintel (a stone slab, or a soldier course of brick over it). `lit` windows glow after dark.
 * `shutters` hangs a pair either side; `box` puts a flower box on the cill.
 */
export function windowAt(f, m, { x, y, w = 1, h = 1.2, face = 1, lit = true, shutters = null, flowers = false, wallZ, lintel = 'stone' }) {
  const z = wallZ;
  const s = face;
  const bar = 0.07;
  const out = s * 0.04;
  // The frame: four bars standing 4 cm proud of the wall, with the glass set back inside them.
  f.box(w + bar * 2, bar, 0.07, m.paint, x, y + h / 2 + bar / 2, z + out, 0.6);
  f.box(w + bar * 2, bar, 0.07, m.paint, x, y - h / 2 - bar / 2, z + out, 0.6);
  for (const sx of [-1, 1]) f.box(bar, h, 0.07, m.paint, x + sx * (w / 2 + bar / 2), y, z + out, 0.6);
  const glass = f.add(worldBox(w, h, 0.05, w, h), lit ? m.glow : m.glass, x, y, z + s * 0.01);
  glass.userData.window = true;
  f.box(w, 0.045, 0.08, m.paint, x, y, z + out, 0.6); // the meeting rail across the middle
  // The cill: a slab sticking out 0.12 m, longer than the frame, on a pair of small corbels.
  f.box(w + 0.34, 0.07, 0.2, m.stone, x, y - h / 2 - bar - 0.035, z + s * 0.1, 1);
  for (const sx of [-1, 1]) f.box(0.07, 0.1, 0.12, m.stone, x + sx * (w / 2 + 0.04), y - h / 2 - bar - 0.1, z + s * 0.06, 1);
  // The lintel.
  if (lintel === 'brick') {
    f.box(w + 0.5, 0.11, 0.1, m.brickDark, x, y + h / 2 + bar + 0.055, z + s * 0.05, 1); // a soldier course
    f.box(w + 0.34, 0.05, 0.12, m.stone, x, y + h / 2 + bar + 0.135, z + s * 0.06, 1);
  } else {
    f.box(w + 0.5, 0.18, 0.14, m.stone, x, y + h / 2 + bar + 0.09, z + s * 0.07, 1);
  }
  if (shutters) {
    for (const sx of [-1, 1]) {
      const sh = f.box(w / 2 - 0.01, h + 0.1, 0.035, shutters, x + sx * (w / 2 + w / 4 + bar + 0.02), y, z + out, 0.6);
      sh.userData.shutter = true;
      for (let k = -2; k <= 2; k++) f.box(w / 2 - 0.05, 0.02, 0.045, m.paintDark, x + sx * (w / 2 + w / 4 + bar + 0.02), y + k * (h / 5.4), z + out + s * 0.005, 0.6); // louvres
    }
  }
  if (flowers) flowerBox(f, m, x, y - h / 2 - bar - 0.22, z + s * 0.22, w + 0.1, s);
}

/** A window box of flowers: a trough on the wall under a cill with a row of bright blobs and trailing green. */
export function flowerBox(f, m, x, y, z, w, s = 1) {
  f.box(w, 0.2, 0.2, m.timber, x, y, z, 0.6);
  const n = Math.max(3, Math.round(w / 0.16));
  for (let i = 0; i < n; i++) {
    const px = x - w / 2 + 0.1 + (i * (w - 0.2)) / (n - 1);
    const colour = m.blooms[i % m.blooms.length];
    const o = f.add(new THREE.IcosahedronGeometry(0.075 + (i % 3) * 0.012, 0), colour, px, y + 0.17 + (i % 2) * 0.03, z);
    o.scale.y = 0.85;
    f.add(new THREE.IcosahedronGeometry(0.06, 0), m.leaf, px + 0.04, y + 0.03, z + s * 0.1);
  }
}

/** A flat slab in the plan of a bay: `w` wide at the wall, `front` wide `depth` out, grown `grow` all round, `thick` tall, its foot at y = 0. */
function bayPlan(w, front, depth, grow, thick) {
  const pts = [[-(w / 2 + grow), -grow], [w / 2 + grow, -grow], [front / 2 + grow, depth + grow], [-(front / 2 + grow), depth + grow]];
  const shape = new THREE.Shape();
  pts.forEach(([px, pz], i) => (i ? shape.lineTo(px, -pz) : shape.moveTo(px, -pz)));
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2); // the plan lies flat, its y becoming -z, and the thickness stands up
  return geo;
}

/**
 * A three-sided bay window on the wall facing `face`: a stone base and a lead hood in the bay's own plan (as wide at the wall as `w`, narrowing to
 * the front pane), glazed panes with bars, the side panes angled from the wall's ends in to the front pane's. `base` is its floor's height.
 */
export function bayWindow(f, m, { x, w = 2.6, depth = 0.7, h = 1.5, base = 0.7, wallZ, face = 1, lit = true, roofMat = null }) {
  const s = face;
  const front = w * 0.64;
  const zf = wallZ + s * depth;
  // Each pane is a frame and glass in its own group, turned to face outwards.
  const pane = (px, pz, pw, ry) => {
    const g = new THREE.Group();
    g.position.set(px, base + h / 2, pz);
    g.rotation.y = ry;
    g.userData.pane = pw;
    f.group.add(g);
    const box = (bw, bh, bd, mat, bx, by, bz) => {
      const o = new THREE.Mesh(worldBox(bw, bh, bd, 0.6), mat);
      o.position.set(bx, by, bz);
      g.add(o);
    };
    const gl = new THREE.Mesh(worldBox(pw, h, 0.05, pw, h), lit ? m.glow : m.glass);
    g.add(gl);
    box(pw + 0.1, 0.08, 0.08, m.paint, 0, h / 2 + 0.04, 0);
    box(pw + 0.1, 0.08, 0.08, m.paint, 0, -h / 2 - 0.04, 0);
    for (const sx of [-1, 1]) box(0.08, h + 0.16, 0.08, m.paint, sx * (pw / 2 + 0.01), 0, 0);
    box(pw, 0.05, 0.09, m.paint, 0, 0, 0);
  };
  pane(x, zf, front, s > 0 ? 0 : Math.PI);
  // A side pane runs from the wall (x +- w/2) to the front pane's end (x +- front/2): `run` along the wall and `depth` out, facing outwards and along.
  const run = (w - front) / 2;
  const sideW = Math.hypot(depth, run);
  for (const sx of [-1, 1]) pane(x + sx * (front / 2 + run / 2), wallZ + (s * depth) / 2, sideW, Math.atan2(sx * depth, s * run));
  // The base and the hood over it, in the bay's plan.
  const slab = (geo, mat, y) => {
    const o = new THREE.Mesh(geo, mat);
    o.position.set(x, y, wallZ);
    o.rotation.y = s > 0 ? 0 : Math.PI;
    f.group.add(o);
  };
  slab(bayPlan(w, front, depth, 0.05, base), m.stone, 0);
  slab(bayPlan(w, front, depth, 0.14, 0.07), m.stone, base + h + 0.1); // the sill the hood sits on
  slab(bayPlan(w, front, depth, 0.2, 0.06), roofMat ?? m.lead, base + h + 0.17);
}

/**
 * A front door in the wall facing `face` at local x: a painted door with panels and brass, a frame, an optional glazed transom over it (three bars
 * of dark glass, lit after dark), a lintel, a step and a number.
 */
export function doorAt(f, m, { x, w = 0.95, h = 2.05, face = 1, wallZ, colour, number = null, doorMat = null, fanlight = false, lamp = true }) {
  const s = face;
  const fanH = fanlight ? 0.3 : 0;
  const top = h + 0.2 + fanH; // the top of the frame
  f.box(w + 0.3, top, 0.1, m.paint, x, top / 2, wallZ + s * 0.04, 0.6); // the frame
  const door = f.add(worldBox(w, h, 0.06, w, h), doorMat ?? m.doors[colour], x, h / 2, wallZ + s * 0.08);
  door.userData.door = true;
  f.add(new THREE.SphereGeometry(0.035, 8, 6), m.brass, x + w / 2 - 0.13, 1.0, wallZ + s * 0.14); // the knob
  f.add(new THREE.BoxGeometry(0.1, 0.03, 0.02), m.brass, x, 1.46, wallZ + s * 0.115); // the knocker's plate
  f.add(new THREE.TorusGeometry(0.04, 0.008, 6, 12), m.brass, x, 1.4, wallZ + s * 0.125); // and its ring
  if (fanlight) {
    f.box(w, 0.3, 0.04, m.fanGlass, x, h + 0.06 + 0.15, wallZ + s * 0.075, 0.6);
    for (const k of [-1, 0, 1]) f.box(0.03, 0.3, 0.05, m.paint, x + (k * w) / 4, h + 0.21, wallZ + s * 0.08, 0.6);
    f.box(w, 0.05, 0.05, m.paint, x, h + 0.035, wallZ + s * 0.08, 0.6); // the transom rail over the door
  }
  f.box(w + 0.7, 0.16, 0.14, m.stone, x, top + 0.07, wallZ + s * 0.07, 1); // the lintel
  f.box(w + 0.5, 0.15, 0.55, m.stone, x, 0.075, wallZ + s * 0.3, 1); // the step
  if (number != null) {
    const plate = f.box(0.14, 0.12, 0.02, m.paint, x + w / 2 + 0.38, 1.7, wallZ + s * 0.025, 0.6);
    plate.userData.plate = number;
  }
  if (lamp) f.add(new THREE.CylinderGeometry(0.06, 0.07, 0.2, 8), m.lampGlow, x - w / 2 - 0.45, 2.05, wallZ + s * 0.09);
}

/** A gabled porch over a door: two posts on stone bases, a beam, side beams to the wall and a tiled roof that meets the wall. */
export function porch(f, m, { x, w = 1.7, depth = 1.3, height = 2.35, wallZ, face = 1, roofMat }) {
  const s = face;
  const zOuter = wallZ + s * depth;
  for (const sx of [-1, 1]) {
    f.box(0.3, 0.2, 0.3, m.stone, x + sx * w / 2, 0.1, zOuter, 1);
    f.box(0.13, height - 0.2, 0.13, m.timber, x + sx * w / 2, 0.2 + (height - 0.2) / 2, zOuter, 0.6);
    f.box(0.1, 0.18, depth, m.timber, x + sx * w / 2, height - 0.09, wallZ + s * depth / 2, 0.6);
  }
  f.box(w + 0.3, 0.18, 0.12, m.timber, x, height - 0.09, zOuter, 0.6);
  // The roof: two slopes to a ridge running out from the wall.
  const rise = 0.55;
  const half = w / 2 + 0.25;
  const slopeLen = Math.hypot(half, rise);
  const ang = Math.atan2(rise, half);
  for (const sx of [-1, 1]) {
    const slab = f.box(slopeLen, 0.06, depth + 0.3, roofMat, x + sx * half / 2, height + rise / 2 + 0.02, wallZ + s * (depth / 2 + 0.1), 1);
    slab.rotation.z = -sx * ang;
  }
  // The gable end in the wall's material above the beam, as a thin triangle facing out (gableGeometry faces along x, so it is turned to face z).
  f.add(gableGeometry(w + 0.5, rise, 0.1, 1.5), m.wall, x, height, zOuter + s * 0.1, Math.PI / 2);
  f.box(0.04, 0.2, depth + 0.3, m.fascia, x, height + rise + 0.04, wallZ + s * (depth / 2 + 0.1), 0.6);
}

/** A dormer in the front slope: cheeks, a little gabled roof and a window in its face. */
export function dormer(f, m, { x, b, roofInfo, lit = true, roofMat }) {
  const { over, drop } = roofInfo;
  const z = b.halfZ * 0.55;
  const yAt = (zz) => b.ridge - (drop * zz) / over; // the roof's surface height at depth zz
  const baseY = yAt(z) + 0.1;
  const h = 1.15;
  const w = 1.0;
  f.box(w + 0.2, h, 0.08, m.wall, x, baseY + h / 2, z, 1.2); // the face
  for (const sx of [-1, 1]) {
    const cheek = new THREE.Mesh(worldBox(0.08, h, 0.9, 1.2), m.wall);
    cheek.position.set(x + sx * (w / 2 + 0.06), baseY + h / 2, z - 0.4);
    f.group.add(cheek);
  }
  const glass = f.add(worldBox(w - 0.1, h - 0.3, 0.04, w - 0.1, h - 0.3), lit ? m.glow : m.glass, x, baseY + h / 2 - 0.02, z + 0.05);
  glass.userData.window = true;
  f.box(w + 0.2, 0.08, 0.1, m.paint, x, baseY + h / 2 + (h - 0.3) / 2 + 0.03, z + 0.05, 0.6);
  for (const sx of [-1, 1]) {
    const slab = f.box(0.85, 0.05, 1.2, roofMat, x + sx * 0.38, baseY + h + 0.2, z - 0.35, 1);
    slab.rotation.z = -sx * 0.5;
  }
  f.box(0.06, 0.1, 1.2, m.fascia, x, baseY + h + 0.42, z - 0.35, 0.6);
}
