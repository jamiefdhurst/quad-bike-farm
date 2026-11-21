// The village's houses in their different designs (#543, #819): a thatched cottage, a larger house with a cross-gable, a bungalow, a terrace of three, a stone
// farmhouse, besides the plain pair of storeys `buildCottage` makes. Built with the kit (villageKit.js) in the house's own frame; the lane's three houses face the
// lane across a front garden with a hedge, a gate and a path, so each has a `frontGarden`. `ctx` is the village's, as in villageBuildings.js.

import * as THREE from 'three';
import { frameFor, sideFrame } from './villageBuildings.js';
import { shellAndRoof, chimney, windowAt, bayWindow, doorAt, porch, dormer, crossGable, flowerBox } from './villageKit.js';

const mixed = (M, over) => ({ ...M, ...over });

/** The designs `buildHouse` makes. */
export const HOUSE_DESIGNS = ['thatched', 'gabled', 'bungalow', 'terrace', 'farmhouse'];

/** The height of a point of the house's local (x, z) over its floor, from the ground there: where a path or a hedge stands on a sloping garden. */
function groundAt(ctx, f, lx, lz) {
  const p = f.world(lx, lz);
  return ctx.heights.heightAt(p.x, p.z) - f.y0;
}

/** A box standing on the ground at local (x, z), sunk `sink` m so no gap shows on a slope, `h` tall above it. */
function standing(ctx, f, w, h, d, mat, x, z, { sink = 0.3, solid = false, tile = 1 } = {}) {
  const g = groundAt(ctx, f, x, z);
  const o = f.box(w, h + sink, d, mat, x, g + (h - sink) / 2, z, tile);
  if (solid) f.solid(x, g + (h - sink) / 2, z, w / 2, (h + sink) / 2, d / 2);
  return o;
}

/**
 * The front garden of a house on the lane: a hedge across at `depth` m out from the front wall with a timber gate and gateposts opposite the door, and a flagged path
 * from the door to the gate. The hedge stops short of the gate by its posts and runs `reach` m either side of the door.
 */
function frontGarden(ctx, f, b, { depth, doorX, reach }) {
  const { M } = ctx;
  const z = b.halfZ + depth;
  const gap = 0.9;
  for (const sign of [-1, 1]) {
    const from = doorX + sign * (gap + 0.2);
    const to = doorX + sign * reach;
    const mid = (from + to) / 2;
    const len = Math.abs(to - from);
    standing(ctx, f, len, 1.3, 0.8, M.hedge, mid, z, { solid: true });
    // A gatepost each side of the gap, with a stone cap.
    standing(ctx, f, 0.2, 1.25, 0.2, M.timber, doorX + sign * gap, z, { sink: 0.5, solid: true, tile: 0.6 });
    const cap = groundAt(ctx, f, doorX + sign * gap, z) + 1.27;
    f.box(0.28, 0.07, 0.28, M.stone, doorX + sign * gap, cap, z, 1);
  }
  // The gate: a top rail, a bottom rail and a diagonal brace between the posts, its slats upright, hung on the left post.
  const gy = groundAt(ctx, f, doorX, z);
  f.box(gap * 2 - 0.2, 0.08, 0.05, M.timber, doorX, gy + 1.0, z, 0.6);
  f.box(gap * 2 - 0.2, 0.08, 0.05, M.timber, doorX, gy + 0.3, z, 0.6);
  for (let k = -3; k <= 3; k++) f.box(0.07, 0.8, 0.04, M.timber, doorX + k * 0.24, gy + 0.65, z, 0.6);
  const brace = f.box(1.8, 0.07, 0.04, M.timber, doorX, gy + 0.65, z + 0.03, 0.6);
  brace.rotation.z = 0.38;
  // The path: flagstones from the doorstep to the gate, each laid on the ground where it lies.
  const flags = Math.floor((depth - 0.8) / 1.0);
  for (let k = 0; k < flags; k++) {
    const pz = b.halfZ + 0.8 + k * 1.0 + 0.5;
    const o = f.box(1.1, 0.07, 0.94, M.paving, doorX, groundAt(ctx, f, doorX, pz) + 0.02, pz, 1);
    o.rotation.y = ((k * 37) % 7 - 3) * 0.005;
  }
  // A letter box on a post by the gate, the way a house on a road has one, and a pair of bins at the side.
  const bx = doorX + gap + 0.9;
  standing(ctx, f, 0.1, 1.1, 0.1, M.timber, bx, z - 0.5, { sink: 0.4, solid: true, tile: 0.6 });
  const by = groundAt(ctx, f, bx, z - 0.5);
  f.box(0.34, 0.26, 0.24, M.red, bx, by + 1.2, z - 0.5, 0.6);
  for (const dx of [0, 0.55]) {
    const bz = b.halfZ + 1.4;
    const gyb = groundAt(ctx, f, b.halfX * 0.55 + dx, bz);
    f.add(new THREE.CylinderGeometry(0.3, 0.26, 0.9, 12), M.iron, b.halfX * 0.55 + dx, gyb + 0.4, bz);
    f.add(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 12), M.iron, b.halfX * 0.55 + dx, gyb + 0.88, bz);
  }
}

/** The hedges down each side and across the back of a garden `depth` deep, and the plot's low back fence, as a cottage has. */
function backGarden(ctx, f, b, depth) {
  const { M } = ctx;
  const back = -b.halfZ;
  for (const sx of [-1, 1]) {
    f.box(0.8, 1.5, depth + 1, M.hedge, sx * (b.halfX + 0.9), 0.75, back - (depth - 1) / 2, 1);
    f.solid(sx * (b.halfX + 0.9), 0.75, back - (depth - 1) / 2, 0.4, 0.75, (depth + 1) / 2);
  }
  f.box(b.halfX * 2 + 2.8, 1.62, 0.8, M.hedge, 0, 0.81, back - depth, 1);
  f.solid(0, 0.75, back - depth, b.halfX + 1.4, 0.75, 0.4);
}

/** Tubs of flowers either side of a door at local x, in front of the wall. */
function doorTubs(f, M, x, front, index, spread = 1.05) {
  for (const sx of [-1, 1]) {
    f.add(new THREE.CylinderGeometry(0.2, 0.15, 0.32, 10), M.pot, x + sx * spread, 0.16, front + 0.55);
    for (let k = 0; k < 4; k++) f.add(new THREE.IcosahedronGeometry(0.1, 0), M.blooms[(k + index) % 4], x + sx * spread + (k - 1.5) * 0.07, 0.4 + (k % 2) * 0.05, front + 0.55 + ((k % 3) - 1) * 0.06);
  }
}

/** The back and side windows every house has: two a floor on the back wall, one a floor on each end. */
function plainSides(f, m, b, { lintel, upper = true, floors = [1.55, 3.45] } = {}) {
  const back = -b.halfZ;
  for (const x of [-b.halfX * 0.55, b.halfX * 0.55]) {
    windowAt(f, m, { x, y: floors[0], w: 0.95, h: 1.2, face: -1, wallZ: back, lintel });
    if (upper) windowAt(f, m, { x, y: floors[1], w: 0.95, h: 1.05, face: -1, wallZ: back, lintel });
  }
  for (const sx of [-1, 1]) {
    const sf = sideFrame(f, b, sx);
    windowAt(sf, m, { x: 0, y: floors[0] + 0.05, w: 0.9, h: 1.1, wallZ: 0, face: 1, lintel });
    if (upper) windowAt(sf, m, { x: 0, y: floors[1], w: 0.9, h: 1.0, wallZ: 0, face: 1, lintel });
  }
}

/**
 * One house of design `b.design` (`HOUSE_DESIGNS`), `index` its place in the village so no two neighbours repeat a number or a flower. The lane's houses (`b.approach`)
 * have a front garden and bins; `b.wall` is 'brick', 'stone' or 'render' (`b.paint`).
 */
export function buildHouse(ctx, b, index) {
  const { M } = ctx;
  const f = frameFor(ctx, b);
  const thatched = b.design === 'thatched';
  const wall = b.wall === 'brick' ? M.brick : b.wall === 'stone' ? M.stone : M.renders[b.paint];
  const roof = thatched ? M.thatch : b.wall === 'stone' ? M.slate : M.clay;
  const m = mixed(M, { wall, roof, ridgeCap: roof, brick: b.wall === 'render' ? M.brick : wall });
  const plinthMat = b.wall === 'brick' ? M.brickDark : M.stone;
  const lintel = b.wall === 'brick' ? 'brick' : 'stone';
  const front = b.halfZ;
  const info = shellAndRoof(f, b, m, { plinthMat, eave: thatched ? 0.6 : b.design === 'bungalow' ? 0.5 : 0.4, verge: thatched ? 0.36 : 0.28, thick: thatched ? 0.3 : 0.1, gutters: !thatched });
  f.solid(0, b.wallHeight / 2, 0, b.halfX, b.wallHeight / 2 + 0.6, b.halfZ);
  const dormers = (xs) => xs.forEach((x) => dormer(f, m, { x, b, roofInfo: info, roofMat: roof }));
  let doorX = 0;
  if (b.design === 'thatched') {
    // Low eaves with the upstairs windows tucked into the thatch, a deep porch on the door, a big stone stack on one end and a low one on the other.
    chimney(f, b, m, -b.halfX + 0.9, { pots: 1, rise: 1.4, w: 1.2, d: 0.8, mat: M.stone });
    chimney(f, b, m, b.halfX - 0.9, { pots: 2, rise: 1.2, mat: M.stone });
    for (const x of [-b.halfX * 0.55, b.halfX * 0.55]) windowAt(f, m, { x, y: 1.4, w: 0.95, h: 1.15, face: 1, wallZ: front, lintel, flowers: true });
    dormers([-b.halfX * 0.55, b.halfX * 0.55]);
    doorAt(f, m, { x: 0, wallZ: front, face: 1, colour: b.door, number: 3 + index * 2 });
    porch(f, m, { x: 0, wallZ: front, face: 1, roofMat: M.thatch });
    doorTubs(f, M, 0, front, index);
    plainSides(f, m, b, { lintel, floors: [1.4, 3.1] });
  } else if (b.design === 'gabled') {
    // A cross-gable at the front with a bay under it, the door beside it under a porch, windows over the rest, a stack at each end.
    const gx = -b.halfX * 0.38;
    doorX = b.halfX * 0.48;
    crossGable(f, m, { x: gx, w: 3.8, projection: 1.1, wallZ: front, wallHeight: b.wallHeight, ridge: b.wallHeight + 1.7, roofMat: roof });
    bayWindow(f, m, { x: gx, w: 2.6, depth: 0.55, h: 1.5, base: 0.7, wallZ: front + 1.0 });
    windowAt(f, m, { x: gx, y: 3.5, w: 1.0, h: 1.2, face: 1, wallZ: front + 1.0, lintel, flowers: false });
    windowAt(f, m, { x: doorX, y: 3.45, w: 0.95, h: 1.05, face: 1, wallZ: front, lintel });
    windowAt(f, m, { x: b.halfX * 0.05 + 0.2, y: 1.55, w: 0.95, h: 1.2, face: 1, wallZ: front, lintel });
    doorAt(f, m, { x: doorX, wallZ: front, face: 1, colour: b.door, number: 3 + index * 2, fanlight: true });
    porch(f, m, { x: doorX, wallZ: front, face: 1, roofMat: roof });
    doorTubs(f, M, doorX, front, index);
    for (const sx of [-1, 1]) chimney(f, b, m, sx * (b.halfX - 0.9), { pots: 3, rise: 1.4, w: 1.05, d: 0.75 });
    plainSides(f, m, b, { lintel });
  } else if (b.design === 'bungalow') {
    // One storey under a low hipped-looking roof: a wide picture window, a smaller one and the door under a flat canopy, one stack.
    doorX = b.halfX * 0.4;
    windowAt(f, m, { x: -b.halfX * 0.38, y: 1.4, w: 2.2, h: 1.25, face: 1, wallZ: front, lintel, shutters: null, flowers: index % 2 === 0 });
    windowAt(f, m, { x: -b.halfX * 0.85 + 0.3, y: 1.4, w: 0.9, h: 1.2, face: 1, wallZ: front, lintel });
    windowAt(f, m, { x: b.halfX * 0.78, y: 1.4, w: 0.9, h: 1.2, face: 1, wallZ: front, lintel });
    doorAt(f, m, { x: doorX - 0.5, w: 0.95, h: 2.05, wallZ: front, face: 1, colour: b.door, number: 3 + index * 2, lamp: true });
    const canopy = f.box(1.9, 0.07, 1.0, M.lead, doorX - 0.5, 2.5, front + 0.5, 1);
    canopy.rotation.x = 0.06;
    for (const sx of [-1, 1]) f.box(0.09, 2.45, 0.09, M.paint, doorX - 0.5 + sx * 0.85, 1.22, front + 0.95, 0.6);
    chimney(f, b, m, b.halfX * 0.3, { pots: 2, rise: 1.0, w: 0.9, d: 0.7 });
    doorTubs(f, M, doorX - 0.5, front, index, 1.3);
    plainSides(f, m, b, { lintel, upper: false, floors: [1.4, 3] });
    doorX -= 0.5;
  } else if (b.design === 'terrace') {
    // Three houses in a row sharing their walls: three doors in three colours, a window each side of each, party-wall stacks, a hood on one, a step each.
    const third = b.halfX * 2 / 3;
    const doors = b.doors ?? [b.door, b.door, b.door];
    for (let h = 0; h < 3; h++) {
      const x0 = -b.halfX + third * (h + 0.5);
      windowAt(f, m, { x: x0 - 1.6, y: 1.5, w: 0.95, h: 1.2, face: 1, wallZ: front, lintel, flowers: h === 1 });
      windowAt(f, m, { x: x0 - 1.6, y: 3.4, w: 0.95, h: 1.05, face: 1, wallZ: front, lintel });
      windowAt(f, m, { x: x0 + 1.5, y: 3.4, w: 0.95, h: 1.05, face: 1, wallZ: front, lintel });
      doorAt(f, m, { x: x0 + 1.5, w: 0.95, wallZ: front, face: 1, colour: doors[h], number: 5 + h * 2 + index * 6, fanlight: h === 2, lamp: h !== 1 });
      if (h === 1) {
        const hood = f.box(1.5, 0.07, 0.8, M.slate, x0 + 1.5, 2.6, front + 0.4, 1);
        hood.rotation.x = 0.35;
        for (const sx of [-1, 1]) f.box(0.07, 0.5, 0.07, M.iron, x0 + 1.5 + sx * 0.6, 2.35, front + 0.35, 0.6);
      }
      for (const dy of [-1, 1]) windowAt(f, m, { x: x0 + dy * 1.55, y: 1.55, w: 0.95, h: 1.2, face: -1, wallZ: -front, lintel });
      windowAt(f, m, { x: x0, y: 3.45, w: 0.95, h: 1.05, face: -1, wallZ: -front, lintel });
      flowerBox(f, m, x0 - 1.6, 0.8, front + 0.1, 1.0, 1);
    }
    for (const x of [-b.halfX + 0.9, -third / 2, third / 2, b.halfX - 0.9]) chimney(f, b, m, x, { pots: 2, rise: 1.2, w: 0.95, d: 0.7 });
    for (const sx of [-1, 1]) {
      const sf = sideFrame(f, b, sx);
      windowAt(sf, m, { x: 0, y: 1.55, w: 0.9, h: 1.1, wallZ: 0, face: 1, lintel });
      windowAt(sf, m, { x: 0, y: 3.45, w: 0.9, h: 1.0, wallZ: 0, face: 1, lintel });
    }
  } else {
    // The farmhouse: five bays of sash windows, the door in the middle under a stone-framed porch, big stacks at each end, a lamp over the door, a boot scraper.
    for (const x of [-4.4, -2.2, 2.2, 4.4]) {
      windowAt(f, m, { x, y: 1.6, w: 1.0, h: 1.25, face: 1, wallZ: front, lintel, flowers: x === 2.2 });
      windowAt(f, m, { x, y: 3.55, w: 1.0, h: 1.1, face: 1, wallZ: front, lintel });
    }
    windowAt(f, m, { x: 0, y: 3.55, w: 1.0, h: 1.1, face: 1, wallZ: front, lintel });
    doorAt(f, m, { x: 0, w: 1.0, h: 2.1, wallZ: front, face: 1, colour: b.door, number: null, fanlight: true });
    porch(f, m, { x: 0, wallZ: front, face: 1, roofMat: roof });
    doorTubs(f, M, 0, front, index);
    for (const sx of [-1, 1]) chimney(f, b, m, sx * (b.halfX - 0.9), { pots: 3, rise: 1.5, w: 1.2, d: 0.85 });
    dormers([-3.3, 3.3]);
    plainSides(f, m, b, { lintel });
    f.box(0.3, 0.2, 0.12, M.iron, 1.5, 0.1, front + 0.2, 0.6); // the boot scraper
    f.box(0.04, 0.3, 0.04, M.iron, 1.5, 0.3, front + 0.2, 0.6);
  }
  backGarden(ctx, f, b, ctx.S.gardenDepth(b));
  if (b.approach && b.design !== 'farmhouse') frontGarden(ctx, f, b, { depth: 8.5, doorX, reach: 11.5 });
  return f;
}
