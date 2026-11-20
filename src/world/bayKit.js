// The barn's two working bays, built the way a farm would mark them (#404, #817): a precast concrete wheel stop at the back and a low kerb at each corner with its faces
// striped hazard yellow and black and worn through, in place of lines painted on the floor, with an oil stain where the engine drips and a steel drip tray at the front.
// Drawn in the barn's own frame (x along the barn, z across it) from the numbers in `layout.bay` and `layout.bay2`; nothing here has a collider, so a quad drives over the kerbs.

import * as THREE from 'three';
import { canvasTexture, worldBox } from './outbuildingProps.js';
import { bag, put, concreteTexture, galvanisedTexture } from './yardKit.js';

export const KERB = { h: 0.07, w: 0.12, arm: 0.75 }; // a corner kerb's height, width and the length of each arm of its L
export const STOP = { h: 0.1, w: 0.16, share: 0.72 }; // a wheel stop's height, width and its share of the bay's width

/** Concrete with diagonal hazard stripes in yellow and black, the paint gone from the corners and the top where tyres have scuffed it. */
export function hazardTexture(random) {
  return canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = 'rgb(60,58,54)'; // the black
    ctx.fillRect(0, 0, w, h);
    for (let x = -h; x < w; x += 32) {
      ctx.fillStyle = 'rgb(206,170,38)';
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + 16, h);
      ctx.lineTo(x + 16 + h, 0);
      ctx.lineTo(x + h, 0);
      ctx.fill();
    }
    for (let i = 0; i < 500; i++) { // worn: grit and scuffs back to bare concrete
      ctx.fillStyle = `rgba(${random() > 0.4 ? '150,148,142' : '40,38,34'},${0.15 + random() * 0.4})`;
      ctx.fillRect(random() * w, random() * h, 1 + random() * 4, 1 + random() * 2);
    }
    ctx.fillStyle = 'rgba(138,136,130,0.5)'; // and the top edge scuffed back to concrete
    ctx.fillRect(0, 0, w, 6);
  });
}

/** A dark oil stain with a ragged edge: a soft pool with a few drips running off it, on a transparent ground. */
export function oilStainTexture(random) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const pool = (x, y, r, a) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(14,12,10,${a})`);
      g.addColorStop(0.65, `rgba(20,16,12,${a * 0.7})`);
      g.addColorStop(1, 'rgba(20,16,12,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    pool(w / 2, h / 2, 34, 0.75);
    for (let i = 0; i < 7; i++) pool(w / 2 + (random() - 0.5) * 60, h / 2 + (random() - 0.5) * 60, 6 + random() * 14, 0.45 + random() * 0.3);
    for (let i = 0; i < 18; i++) pool(random() * w, random() * h, 1.5 + random() * 3, 0.5); // the drips
  });
}

/**
 * Where each piece of a bay's kit goes, in the barn's frame: `back` is the wheel stop's middle (the bay's west end, the end a quad nose-in from the door reaches), `corners`
 * the four kerb corners as { x, z, sx, sz } (the corner and which way each arm runs into the bay), `stain` the oil patch's middle and `tray` the drip tray's.
 */
export function bayPlaces(bay) {
  const x0 = bay.x - bay.halfX;
  const x1 = bay.x + bay.halfX;
  const z0 = bay.z - bay.halfZ;
  const z1 = bay.z + bay.halfZ;
  return {
    back: { x: x0 + STOP.w / 2 + 0.3, z: bay.z, width: bay.halfZ * 2 * STOP.share },
    corners: [[x0, z0, 1, 1], [x0, z1, 1, -1], [x1, z0, -1, 1], [x1, z1, -1, -1]].map(([x, z, sx, sz]) => ({ x, z, sx, sz })),
    stain: { x: bay.x - bay.halfX * 0.25, z: bay.z - bay.halfZ * 0.62 },
    tray: { x: bay.x + bay.halfX * 0.55, z: bay.z + bay.halfZ * 0.68 },
  };
}

/** The kit for each bay of `bays` (layout.bay, layout.bay2), on a floor at `floorY`. Returns a group in the barn's frame. */
export function buildBayKit({ bays, floorY, random }) {
  const concrete = new THREE.MeshStandardMaterial({ map: concreteTexture(random), roughness: 0.95 });
  const hazard = new THREE.MeshStandardMaterial({ map: hazardTexture(random), roughness: 0.9 });
  const steel = new THREE.MeshStandardMaterial({ map: galvanisedTexture(random), roughness: 0.5, metalness: 0.5 });
  const oil = new THREE.MeshStandardMaterial({ color: 0x0c0b0a, roughness: 0.25, metalness: 0.1 });
  const stain = new THREE.MeshStandardMaterial({
    map: oilStainTexture(random), transparent: true, depthWrite: false, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
  });
  const b = bag();
  const group = new THREE.Group();
  group.name = 'bayKit';
  for (const bay of bays) {
    const p = bayPlaces(bay);
    // The wheel stop: a precast block with a chamfered top edge, hazard-striped on its face, two bolts through it.
    const { x, z, width } = p.back;
    b.add(concrete, put(worldBox(STOP.w, STOP.h - 0.02, width, 1), x, floorY + (STOP.h - 0.02) / 2 - 0.005, z));
    b.add(hazard, put(worldBox(STOP.w - 0.02, 0.025, width - 0.04, 1), x + 0.002, floorY + STOP.h - 0.0125, z)); // the top, stepped in from the edges (no shared planes)
    b.add(hazard, put(worldBox(0.012, STOP.h - 0.04, width - 0.06, 1), x + STOP.w / 2 + 0.002, floorY + (STOP.h - 0.04) / 2 + 0.005, z)); // the face a wheel meets
    for (const dz of [-1, 1]) {
      b.add(steel, put(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 8), x, floorY + STOP.h + 0.012, z + dz * (width / 2 - 0.2))); // a coach bolt head
      b.add(steel, put(new THREE.CylinderGeometry(0.035, 0.035, 0.004, 8), x, floorY + STOP.h + 0.004, z + dz * (width / 2 - 0.2))); // and its washer
    }
    // A kerb at each corner, an L of two arms in precast concrete painted hazard yellow and black and worn.
    for (const c of p.corners) {
      b.add(hazard, put(worldBox(KERB.arm, KERB.h, KERB.w, 1), c.x + (c.sx * KERB.arm) / 2, floorY + KERB.h / 2 - 0.004, c.z + c.sz * KERB.w / 2));
      b.add(hazard, put(worldBox(KERB.w - 0.015, KERB.h - 0.01, KERB.arm - KERB.w, 1), c.x + c.sx * (KERB.w / 2 + 0.0075), floorY + (KERB.h - 0.01) / 2 - 0.004, c.z + c.sz * (KERB.w + (KERB.arm - KERB.w) / 2)));
    }
    // The oil stain on the floor where the engine sits, and a steel drip tray near the front with its rim and a skin of oil in it.
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), stain);
    plane.rotation.x = -Math.PI / 2;
    plane.rotation.z = random() * Math.PI;
    plane.position.set(p.stain.x, floorY + 0.006, p.stain.z);
    plane.receiveShadow = true;
    group.add(plane);
    const t = p.tray;
    b.add(steel, put(worldBox(0.7, 0.012, 0.44, 1), t.x, floorY + 0.007, t.z)); // its floor
    for (const [sx, sy, sz, dx, y, dz] of [[0.7, 0.06, 0.014, 0, 0.027, -0.223], [0.7, 0.06, 0.014, 0, 0.027, 0.223], [0.014, 0.072, 0.44, -0.353, 0.028, 0]]) { // and its walls, the ends a little taller and deeper than the sides
      b.add(steel, put(worldBox(sx, sy, sz, 1), t.x + dx, floorY + y, t.z + dz));
      if (dx) b.add(steel, put(worldBox(sx, sy, sz, 1), t.x - dx, floorY + y, t.z + dz));
    }
    b.add(oil, put(new THREE.BoxGeometry(0.66, 0.004, 0.4), t.x, floorY + 0.015, t.z)); // the oil lying in it
  }
  group.add(b.group());
  return group;
}
