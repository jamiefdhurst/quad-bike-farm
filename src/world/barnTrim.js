// The barn's roof trim (#817, #818), what the barn was missing to read as a farm building and not a box with a lid: fascia and barge boards along the roof's edges,
// and half-round gutters on both long eaves with downpipes and swan necks to the walls. Drawn in the barn's own frame (as barnBuild.js does), no colliders.

import * as THREE from 'three';
import { worldBox } from './outbuildingProps.js';
import { paintedTexture } from './neighbourTextures.js';
import { bag, put, galvanisedTexture, ironTexture } from './yardKit.js';

const GUTTER = { depth: 0.075, width: 0.12, bracketEvery: 0.9 };
const PIPE = { r: 0.04, wallGap: 0.06 };

/**
 * The trim for the one-building barn's roof (#818, barnWide.js): a fascia and a half-round gutter on each long eave with a downpipe at each end of it and a swan neck back to the
 * wall, barge boards up the rake of each gable, and a lead flashing at the ridge. `roof` is barnWide.js's `roofOf`. Drawn in the barn's own frame, no colliders.
 */
export function buildWideTrim({ shape, floorY, roof, random }) {
  const { outer } = shape;
  const sizeZ = outer.maxZ - outer.minZ;
  const roofLen = sizeZ + 0.8;
  const white = new THREE.MeshStandardMaterial({ map: paintedTexture(random, '#e4e1d6'), roughness: 0.8 });
  const steel = new THREE.MeshStandardMaterial({ map: galvanisedTexture(random), roughness: 0.5, metalness: 0.5 });
  const pipeMat = new THREE.MeshStandardMaterial({ map: ironTexture(random), roughness: 0.55, metalness: 0.4 });
  const b = bag();
  for (const side of [-1, 1]) {
    const ex = shape.x + side * roof.eaveX;
    const gx = ex + side * 0.05; // the gutter hangs just proud of the fascia
    b.add(white, put(worldBox(0.03, 0.2, roofLen, 1), ex + side * 0.01, floorY + roof.eaveY - 0.07, shape.z));
    b.add(steel, put(worldBox(GUTTER.width, 0.012, roofLen - 0.1, 1), gx, floorY + roof.eaveY - 0.15, shape.z)); // the gutter's bottom
    b.add(steel, put(worldBox(0.012, GUTTER.depth, roofLen - 0.1, 1), gx + side * (GUTTER.width / 2), floorY + roof.eaveY - 0.11, shape.z)); // its front lip, rolled
    for (let z = outer.minZ - 0.3; z <= outer.maxZ + 0.3; z += GUTTER.bracketEvery) b.add(steel, put(worldBox(GUTTER.width + 0.04, 0.014, 0.02, 1), gx, floorY + roof.eaveY - 0.145, z));
    for (const z of [outer.minZ - 0.4, outer.maxZ + 0.4]) b.add(steel, put(worldBox(GUTTER.width, GUTTER.depth, 0.012, 1), gx, floorY + roof.eaveY - 0.11, z)); // the stop ends
    // A downpipe at each end of the gutter: a swan neck back to the wall, then straight down on clips to a shoe above the ground.
    const wallX = side < 0 ? outer.minX : outer.maxX;
    const px = wallX + side * (PIPE.r + PIPE.wallGap);
    for (const z of [outer.minZ + 0.9, outer.maxZ - 0.9]) {
      const top = floorY + roof.eaveY - 0.16;
      const neck = Math.hypot(gx - px, 0.25);
      b.add(pipeMat, put(new THREE.CylinderGeometry(PIPE.r, PIPE.r, neck, 8), (gx + px) / 2, top - 0.12, z, 0, 0, -side * Math.atan2(Math.abs(gx - px), 0.25)));
      const bottom = floorY + 0.28;
      b.add(pipeMat, put(new THREE.CylinderGeometry(PIPE.r, PIPE.r, top - 0.25 - bottom, 8), px, (top - 0.25 + bottom) / 2, z));
      for (const cy of [bottom + 0.5, bottom + 1.8, bottom + 3.0]) {
        if (cy > top - 0.4) continue;
        b.add(steel, put(new THREE.CylinderGeometry(PIPE.r + 0.007, PIPE.r + 0.007, 0.03, 8), px, floorY + cy, z)); // a clip round the pipe
        b.add(steel, put(worldBox(PIPE.wallGap + 0.02, 0.02, 0.025, 1), px - side * (PIPE.r + 0.01), floorY + cy, z)); // its stalk into the wall
      }
      b.add(pipeMat, put(new THREE.CylinderGeometry(PIPE.r, PIPE.r * 1.25, 0.2, 8), px, bottom - 0.08, z)); // the shoe, flared
      b.add(pipeMat, put(new THREE.CylinderGeometry(PIPE.r * 1.25, PIPE.r * 1.25, 0.05, 8), px + side * 0.02, floorY + 0.075, z)); // and its mouth at the ground
    }
  }
  // Barge boards up the rake of each gable, standing a little proud of the tin.
  for (const side of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const board = worldBox(roof.slopeLen, 0.18 + (side > 0 ? 0.02 : 0), 0.03, 1);
      board.rotateZ(-side * roof.slope);
      b.add(white, board.translate(shape.x + side * roof.eaveX / 2, floorY + (roof.eaveY + shape.ridge) / 2 + 0.04, shape.z + sz * (roofLen / 2 + (side > 0 ? 0.009 : 0.004))));
    }
  }
  return b.group();
}
