// The barn's roof and second-span trim (#817), what the barn was missing to read as a farm building and not a box with a lid: fascia and barge boards along the roof's edges,
// half-round gutters on both outer eaves with downpipes and swan necks to the walls, the valley gutter's end stops and a drop at its west end, a rain hood and cover battens over the
// second span's door, and pads and knee braces at the posts that stand where the wall between the spans would be. Drawn in the barn's own frame (as barnBuild.js does), no colliders.

import * as THREE from 'three';
import { worldBox } from './outbuildingProps.js';
import { paintedTexture, woodTexture } from './neighbourTextures.js';
import { bag, put, galvanisedTexture, ironTexture, concreteTexture } from './yardKit.js';

const GUTTER = { depth: 0.075, width: 0.12, bracketEvery: 0.9 };
const PIPE = { r: 0.04, wallGap: 0.06 };

/** The x of each downpipe along a span's outer eave: near each end of the wall, clear of the corner post. */
export function pipeXs(outer) {
  return [outer.minX + 0.9, outer.maxX - 0.9];
}

/**
 * The trim for the barn's roof. `r` holds what barnBuild.js worked out for its roof: `shape` (barnShape), `floorY`, `eaveZ` (the eave's distance from a span's middle), `eaveY` (its height
 * above the floor), `posts` (barn.js `dividerPosts`). Returns a group in the barn's frame.
 */
export function buildBarnTrim({ shape, floorY, eaveZ, eaveY, posts = [], random }) {
  const { outer, annex, wallHeight, ridge } = shape;
  const sizeX = outer.maxX - outer.minX;
  const white = new THREE.MeshStandardMaterial({ map: paintedTexture(random, '#e4e1d6'), roughness: 0.8 });
  const steel = new THREE.MeshStandardMaterial({ map: galvanisedTexture(random), roughness: 0.5, metalness: 0.5 });
  const pipeMat = new THREE.MeshStandardMaterial({ map: ironTexture(random), roughness: 0.55, metalness: 0.4 });
  const timber = new THREE.MeshStandardMaterial({ map: woodTexture(random, [74, 55, 38]), roughness: 0.92 });
  const concrete = new THREE.MeshStandardMaterial({ map: concreteTexture(random), roughness: 0.95 });
  const b = bag();
  const span = [{ z: shape.z, outerSide: -1 }];
  if (annex) span.push({ z: annex.z, outerSide: 1 });
  const roofLen = sizeX + 0.8;

  for (const { z: zc, outerSide } of span) {
    // Along the outer eave: a fascia board on the panel's lower edge and a half-round gutter hung on it, tipped a little to fall to its outlet at the west end.
    const ez = zc + outerSide * eaveZ;
    const gz = ez + outerSide * 0.05; // the gutter hangs just proud of the fascia
    b.add(white, put(worldBox(roofLen, 0.2, 0.03, 1), shape.x, floorY + eaveY - 0.07, ez + outerSide * 0.01));
    b.add(steel, put(worldBox(roofLen - 0.1, 0.012, GUTTER.width, 1), shape.x, floorY + eaveY - 0.15, gz)); // the gutter's bottom
    b.add(steel, put(worldBox(roofLen - 0.1, GUTTER.depth, 0.012, 1), shape.x, floorY + eaveY - 0.11, gz + outerSide * (GUTTER.width / 2))); // its front lip, rolled
    for (let x = outer.minX - 0.3; x <= outer.maxX + 0.3; x += GUTTER.bracketEvery) b.add(steel, put(worldBox(0.02, 0.014, GUTTER.width + 0.04, 1), x, floorY + eaveY - 0.145, gz)); // a bracket every metre
    for (const x of [outer.minX - 0.4, outer.maxX + 0.4]) b.add(steel, put(worldBox(0.012, GUTTER.depth, GUTTER.width, 1), x, floorY + eaveY - 0.11, gz)); // the stop ends
    // The downpipes: a swan neck back to the wall, then straight down on clips to a shoe above the ground.
    const wallZ = outerSide < 0 ? outer.minZ : annex.outer.maxZ;
    const px = pipeXs(outer);
    for (const x of [px[0]]) { // the gutter falls to the west end, so the pipe stands there
      const top = floorY + eaveY - 0.16;
      const pz = wallZ + outerSide * (PIPE.r + PIPE.wallGap);
      const neck = Math.hypot(gz - pz, 0.25);
      b.add(pipeMat, put(new THREE.CylinderGeometry(PIPE.r, PIPE.r, neck, 8), x, top - 0.12, (gz + pz) / 2, 0, Math.atan2(gz - pz, 0.25) * 1)); // the swan neck's slant
      const bottom = floorY + 0.28;
      b.add(pipeMat, put(new THREE.CylinderGeometry(PIPE.r, PIPE.r, top - 0.25 - bottom, 8), x, (top - 0.25 + bottom) / 2, pz));
      for (const cy of [bottom + 0.5, bottom + 1.8, bottom + 3.0]) {
        if (cy > top - 0.4) continue;
        b.add(steel, put(new THREE.CylinderGeometry(PIPE.r + 0.007, PIPE.r + 0.007, 0.03, 8), x, floorY + cy, pz)); // a clip round the pipe
        b.add(steel, put(worldBox(0.025, 0.02, PIPE.wallGap + 0.02, 1), x, floorY + cy, pz - outerSide * (PIPE.r + 0.01))); // its stalk into the wall
      }
      b.add(pipeMat, put(new THREE.CylinderGeometry(PIPE.r, PIPE.r * 1.25, 0.2, 8), x, bottom - 0.08, pz)); // the shoe, flared
      b.add(pipeMat, put(new THREE.CylinderGeometry(PIPE.r * 1.25, PIPE.r * 1.25, 0.05, 8), x, floorY + 0.075, pz + outerSide * 0.02)); // and its mouth at the ground
    }
  }

  // Barge boards along the roof's slopes at the gable ends, one to each end of each panel, standing a little proud of the tin.
  for (const { z: zc } of span) {
    for (const side of [-1, 1]) {
      const valley = annex && side === (zc === shape.z ? 1 : -1);
      const eZ = valley ? (outer.maxZ - outer.minZ) / 2 : eaveZ; // the valley side stops at the wall line
      const eY = valley ? wallHeight : eaveY;
      const len = Math.hypot(eZ, ridge - eY);
      for (const sx of [-1, 1]) {
        const board = worldBox(0.03, 0.18 + (side > 0 ? 0.02 : 0), len, 1);
        board.rotateX(side * Math.atan2(ridge - eY, eZ));
        b.add(white, board.translate(shape.x + sx * (roofLen / 2 + (side > 0 ? 0.009 : 0.004)), floorY + (eY + ridge) / 2 + 0.04, zc + (side * eZ) / 2));
      }
    }
  }

  // The valley gutter between the spans: end stops, and an outlet and drop at the west end where the pipe stands off the post on two arms.
  if (annex) {
    const vz = outer.maxZ;
    for (const x of [shape.x - (sizeX + 0.8) / 2 - 0.006, shape.x + (sizeX + 0.8) / 2 + 0.006]) b.add(steel, put(worldBox(0.012, 0.16, 0.34, 1), x, floorY + wallHeight + 0.06, vz));
    const x = outer.minX - 0.3;
    b.add(steel, put(new THREE.CylinderGeometry(0.06, 0.04, 0.12, 8), x, floorY + wallHeight - 0.04, vz)); // the outlet hopper
    b.add(pipeMat, put(new THREE.CylinderGeometry(PIPE.r, PIPE.r, wallHeight - 0.4, 8), x, floorY + 0.28 + (wallHeight - 0.4) / 2 - 0.1, vz));
    for (const dy of [0.7, 2.1]) b.add(steel, put(worldBox(0.3, 0.02, 0.03, 1), x + 0.14, floorY + dy, vz)); // arms back to the white post
    b.add(pipeMat, put(new THREE.CylinderGeometry(PIPE.r, PIPE.r * 1.25, 0.2, 8), x, floorY + 0.2, vz));
  }

  // The second span's door: a rain hood over the header and cover battens over the board joints above it.
  if (annex) {
    const ad = annex.door;
    const w = ad.maxZ - ad.minZ;
    const hood = worldBox(0.55, 0.05, w + 0.5, 1);
    hood.rotateZ(0.32);
    b.add(timber, hood.translate(ad.x + 0.28, floorY + ad.height + 0.55, annex.z));
    for (const dz of [-1, 1]) b.add(timber, put(worldBox(0.05, 0.4, 0.05, 1), ad.x + 0.14, floorY + ad.height + 0.36, annex.z + dz * (w / 2 + 0.2), 0, 0, -0.5)); // a bracket under each end
    const aboveA = wallHeight - ad.height - 0.28;
    for (let i = -2; i <= 2; i++) b.add(timber, put(worldBox(0.03, aboveA - 0.7, 0.07, 1), ad.x + 0.015 + 0.002, floorY + ad.height + 0.28 + (aboveA + 0.7) / 2, annex.z + i * (w / 5))); // battens
  }

  // Where the spans meet inside, each post stands on a concrete pad with a knee brace up to the beam across the barn.
  for (const p of posts) {
    b.add(concrete, put(worldBox(0.5, 0.08, 0.5, 1), p.x, floorY + 0.036, p.z));
    for (const dir of [-1, 1]) {
      const len = Math.hypot(0.55, 0.55);
      const brace = worldBox(0.09, len, dir > 0 ? 0.1 : 0.11, 1);
      brace.rotateZ(-dir * Math.PI / 4);
      b.add(timber, brace.translate(p.x + dir * 0.28, floorY + wallHeight - 0.72, p.z)); // 45 degrees, from the post out along the beam
    }
  }
  return b.group();
}
