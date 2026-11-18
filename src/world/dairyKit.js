// A small British dairy farm's yard, built from boxes and tubes (#569): the milking parlour with its row of high windows, extractor fan, roller shutter and
// pressure washer; the collecting yard in front of it with its galvanised rails, backing gate, scraped concrete, muck channel and hosepipe; the bulk milk
// tank's room with the stainless tank seen through its door and the pipe stub for the tanker's hose; and the slurry store with its ladder and warning board.
// Every builder takes the piece's shape (neighbourFarm.js), the ground height `y0` of her levelled yard and the shared materials (`dairyMaterials`), and
// returns a group of meshes placed in game metres, for the yard to merge by material with the house and the barn (neighbourFarmProps.js `mergeStatic`);
// `fixedBox(x, y, z, hx, hy, hz, yaw)` makes each collider.

import * as THREE from 'three';
import { corrugatedTexture, blockTexture, worldBox } from './outbuildingProps.js';
import { paintedTexture, doorTexture, barrelTexture, woodTexture } from './neighbourTextures.js';
import { galvanisedTexture, stainlessTexture, scrapedConcreteTexture, slurryWallTexture, slurryCrustTexture, rollerShutterTexture, lettered } from './dairyTextures.js';

/** The materials every piece shares, so the yard merges them to one mesh each. `concrete` is the yard's own slab, for the slab under the tank room. */
export function dairyMaterials(random, concrete) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const cementTop = std({ map: corrugatedTexture(random, '#a6aaa4', 0.08), roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide });
  return {
    concrete,
    block: std({ map: blockTexture(random), roughness: 0.9 }),
    cement: cementTop,
    galv: std({ map: galvanisedTexture(random), metalness: 0.55, roughness: 0.45 }),
    stainless: std({ map: stainlessTexture(random), metalness: 0.85, roughness: 0.28 }),
    scraped: std({ map: scrapedConcreteTexture(random), roughness: 0.95 }),
    white: std({ map: paintedTexture(random, '#e6e4da'), roughness: 0.6 }),
    green: std({ map: paintedTexture(random, '#2f5a3e'), roughness: 0.55 }),
    door: std({ map: doorTexture(random, '#365c44'), roughness: 0.5 }),
    glass: std({ color: 0x1b2429, roughness: 0.15, metalness: 0.3 }),
    dark: std({ color: 0x151412, roughness: 0.95 }),
    rubber: std({ color: 0x202020, roughness: 0.9 }),
    hose: std({ color: 0x2c7a3c, roughness: 0.6 }),
    drum: std({ map: barrelTexture(), color: 0x2a5aa0, roughness: 0.5 }),
    washer: std({ color: 0xc8312c, roughness: 0.5 }),
    muck: std({ color: 0x2b2216, roughness: 0.35 }),
    timber: std({ map: woodTexture(random, [128, 120, 108]), roughness: 0.95 }),
    shutter: std({ map: rollerShutterTexture(random), metalness: 0.4, roughness: 0.5 }),
    slurryWall: std({ map: slurryWallTexture(random), roughness: 0.95, side: THREE.DoubleSide }),
    slurryCrust: std({ map: slurryCrustTexture(random), roughness: 0.6 }),
    danger: std({ map: lettered(['DANGER', 'SLURRY', 'Gas. Deep. Keep out'], { sizes: [46, 40, 17] }), roughness: 0.6 }),
    collect: std({ map: lettered(['MILK', 'COLLECTION', 'POINT'], { ground: '#e9e6dc', sizes: [36, 30, 30], w: 256, h: 160 }), roughness: 0.6 }),
    label: std({ map: lettered(['TEAT', 'DIP'], { ground: '#f4f2ea', ink: '#1d4f8c', sizes: [30, 30], w: 128, h: 96 }), roughness: 0.6 }),
  };
}

/** A builder's scratchpad: a group and shorthands that place things by height above the yard's ground (`y` is a centre, `y0` the ground). */
function piece(y0, name) {
  const group = new THREE.Group();
  group.name = name;
  const add = (geo, mat, x, y, z, ry = 0, rx = 0, rz = 0) => {
    const o = new THREE.Mesh(geo, mat);
    o.position.set(x, y0 + y, z);
    o.rotation.order = 'YXZ';
    o.rotation.set(rx, ry, rz);
    group.add(o);
    return o;
  };
  const box = (w, h, d, mat, x, y, z, tile = 2, ry = 0) => add(worldBox(w, h, d, tile), mat, x, y, z, ry);
  /** A flat sheet `w` (along x) by `d` (along z), one-sided (a double-sided material shows its underside): for a roof, whose thickness nobody sees. Textured `tileU` by `tileV` m a tile. */
  const sheet = (w, d, mat, x, y, z, tileU = 1.2, tileV = 3) => {
    const geo = new THREE.PlaneGeometry(w, d, Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(d / 3)));
    geo.rotateX(-Math.PI / 2);
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tileU, (uv.getY(i) * d) / tileV);
    return add(geo, mat, x, y, z);
  };
  /** A cylinder along `axis` ('y' up, 'x' or 'z' along the ground), radius `r`, length `len`, `r2` at the far end if it tapers. */
  const tube = (r, len, mat, x, y, z, axis = 'y', r2 = r, seg = 10) => {
    const geo = new THREE.CylinderGeometry(r2, r, len, seg, 1);
    return add(geo, mat, x, y, z, 0, axis === 'z' ? Math.PI / 2 : 0, axis === 'x' ? Math.PI / 2 : 0);
  };
  /** A tube from (x0, y0, z0) to (x1, y1, z1) in game metres with `y` above the ground, radius r. */
  const between = (a, b, r, mat, seg = 6) => {
    const va = new THREE.Vector3(a[0], y0 + a[1], a[2]);
    const vb = new THREE.Vector3(b[0], y0 + b[1], b[2]);
    const geo = new THREE.CylinderGeometry(r, r, va.distanceTo(vb), seg, 1);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()));
    const mid = va.clone().add(vb).multiplyScalar(0.5);
    const o = new THREE.Mesh(geo, mat);
    o.position.copy(mid);
    group.add(o);
    return o;
  };
  return { group, add, box, sheet, tube, between, y0 };
}

/** A gable's triangle `width` wide and `rise` high, or with `wedge` a lean-to's end: the rise all on the +u side (north, once turned), none on the other. */
const gableShape = (width, rise, wedge) => {
  const s = new THREE.Shape();
  s.moveTo(-width / 2, 0);
  s.lineTo(width / 2, 0);
  s.lineTo(wedge ? width / 2 : 0, rise);
  s.closePath();
  return s;
};

/** A gable end's triangle in `mat` at (x, z), standing on y = `base` above the ground, spanning z by `width`, `rise` high and 0.2 thick, with its texture 1.2 m a tile. */
function gable(P, mat, x, base, z, width, rise, wedge = false) {
  const geo = new THREE.ExtrudeGeometry(gableShape(width, rise, wedge), { depth: 0.2, bevelEnabled: false });
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.2, uv.getY(i) / 3);
  geo.translate(0, 0, -0.1);
  geo.rotateY(Math.PI / 2);
  return P.add(geo, mat, x, base, z);
}

/** The parlour's roof: two sheets of fibre cement over a ridge cap, eaves and gable overhang, fascias, and gutters on both long sides with a downpipe at each end. */
function longRoof(P, m, c) {
  const { x, z, halfX, halfZ, wallHeight: wh, ridge } = c;
  const over = halfZ + 0.35;
  const drop = (ridge - wh) * (over / halfZ);
  const slope = Math.hypot(over, drop);
  const pitch = Math.atan2(drop, over);
  for (const side of [-1, 1]) {
    const sheet = P.sheet(halfX * 2 + 0.5, slope, m.cement, x, ridge + 0.02 - drop / 2, z + (side * over) / 2);
    sheet.rotation.x = side * pitch;
    P.box(halfX * 2 + 0.5, 0.2, 0.06, m.white, x, wh - 0.05, z + side * (over + 0.02), 0.6); // the fascia board along the eaves
    P.box(halfX * 2 + 0.3, 0.1, 0.16, m.galv, x, wh - 0.22, z + side * (over + 0.1), 1); // the gutter
  }
  P.box(halfX * 2 + 0.5, 0.1, 0.34, m.galv, x, ridge + 0.1, z, 1); // the ridge cap
  for (const side of [-1, 1]) for (const e of [-1, 1]) P.tube(0.045, wh - 0.4, m.galv, x + e * (halfX - 0.2), (wh - 0.4) / 2, z + side * (over + 0.1), 'y', 0.045, 8); // the downpipes
}

/**
 * The milking parlour (`p`: x, z, halfX, halfZ, wallHeight, ridge): a long low building in block to 2.2 m and fibre-cement sheeting above, a row of small
 * high windows down both long sides, two cow gates and a green man's door on the side facing the collecting yard (the south), a roller shutter and vents
 * in the west gable, the extractor fan in the east gable, and a pressure washer and a stack of teat-dip drums by the man's door.
 */
export function buildParlour(p, y0, m, { fixedBox } = {}) {
  const P = piece(y0, 'parlour');
  const { x, z, halfX, halfZ, wallHeight: wh } = p;
  const t = 0.25;
  const low = 2.2;
  // `out` is the way the wall faces ([x, z] unit): the cladding laps 1.5 cm over the block on the outside only, so no two walls' faces share a plane at the corners.
  const wall = (cx, cz, w, d, out) => {
    P.box(w, low + 0.4, d, m.block, cx, (low - 0.4) / 2, cz, 1.8); // the block, sunk 0.4 m
    P.box(w + Math.abs(out[0]) * 0.015, wh - low, d + Math.abs(out[1]) * 0.015, m.cement, cx + out[0] * 0.0075, low + (wh - low) / 2, cz + out[1] * 0.0075, 1.2);
  };
  wall(x, z - halfZ + t / 2, halfX * 2, t, [0, -1]);
  wall(x, z + halfZ - t / 2, halfX * 2, t, [0, 1]);
  wall(x - halfX + t / 2, z, t, halfZ * 2 - 2 * t, [-1, 0]);
  wall(x + halfX - t / 2, z, t, halfZ * 2 - 2 * t, [1, 0]);
  for (const e of [-1, 1]) gable(P, m.cement, x + e * (halfX - 0.1), wh, z, halfZ * 2, p.ridge - wh);
  longRoof(P, m, p);

  // The row of small high windows, 0.9 by 0.45 m at 2.45 m, with a white frame and a cill, on both long walls.
  for (let k = 0; k < 9; k++) {
    const wx = x - 12 + k * 3;
    for (const side of [-1, 1]) {
      if (side > 0 && (k === 1 || k === 3)) continue; // the cow gates are under these two: no window over them
      const wz = z + side * halfZ;
      P.box(1.02, 0.57, 0.08, m.white, wx, 2.7, wz + side * 0.05, 0.6);
      P.box(0.9, 0.45, 0.06, m.glass, wx, 2.7, wz + side * 0.1, 1);
      P.box(1.12, 0.06, 0.16, m.galv, wx, 2.38, wz + side * 0.1, 1); // the cill
      P.box(0.04, 0.45, 0.07, m.white, wx, 2.7, wz + side * 0.11, 0.3); // the glazing bar
    }
  }

  // Two cow gates on the collecting yard's side: a dark doorway under a concrete lintel between galvanised posts, shut with a four-rail gate.
  const southZ = z + halfZ;
  for (const gx of [x - 9, x - 3]) {
    P.box(2.5, 2.3, 0.05, m.dark, gx, 1.15, southZ + 0.035, 1);
    for (const e of [-1, 1]) P.tube(0.06, 2.4, m.galv, gx + e * 1.3, 1.2, southZ + 0.1, 'y', 0.06, 8);
    P.box(2.9, 0.22, 0.2, m.scraped, gx, 2.4, southZ + 0.08, 1); // the lintel
    for (const ry of [0.4, 0.75, 1.1, 1.45]) P.tube(0.025, 2.5, m.galv, gx, ry, southZ + 0.16, 'x', 0.025, 8);
    for (const e of [-1, 1]) P.tube(0.03, 1.55, m.galv, gx + e * 1.22, 0.78, southZ + 0.16, 'y', 0.03, 8);
  }
  // The man's door, painted green with a frame, a step and a lamp over it.
  const dx = x + 10;
  P.box(1.24, 2.18, 0.08, m.white, dx, 1.11, southZ + 0.04, 0.6);
  P.box(1.0, 2.03, 0.06, m.door, dx, 1.05, southZ + 0.09, 1);
  P.box(1.4, 0.19, 0.5, m.scraped, dx, 0.085, southZ + 0.3, 1.5); // the step, a hair into the ground
  P.box(0.16, 0.12, 0.16, m.galv, dx + 0.9, 2.45, southZ + 0.1, 0.3); // the lamp, off by day
  // The roller shutter in the west gable, for the tractor and the scraper: slats in a steel box with guides each side.
  const westX = x - halfX;
  P.box(0.06, 2.8, 3.2, m.shutter, westX - 0.05, 1.4, z, 1);
  P.box(0.3, 0.3, 3.5, m.galv, westX - 0.15, 2.95, z, 1); // the roller's box
  for (const e of [-1, 1]) P.box(0.1, 2.9, 0.12, m.galv, westX - 0.07, 1.45, z + e * 1.7, 0.5);
  // Vents in the gable above it, and the extractor fan in the east gable: a round housing with a four-blade fan behind a guard of bars.
  for (const e of [-1, 1]) P.box(0.05, 0.4, 0.9, m.galv, westX - 0.04, wh + 0.9, z + e * 1.3, 0.5);
  const eastX = x + halfX;
  P.add(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 24, 1, true), m.galv, eastX + 0.175, wh + 0.8, z, 0, 0, Math.PI / 2); // the housing, open at both ends
  P.tube(0.46, 0.04, m.dark, eastX + 0.06, wh + 0.8, z, 'x', 0.46, 20); // the dark of the shaft behind
  for (let k = 0; k < 4; k++) P.box(0.03, 0.4, 0.12, m.rubber, eastX + 0.17 + k * 0.012, wh + 0.8, z, 0.3).rotation.x = (k * Math.PI) / 4 + 0.3; // the four blades, each a hair behind the last so they share no plane
  for (const s of [-1, 1]) P.box(0.02, 0.04, 0.96, m.galv, eastX + 0.34, wh + 0.8 + s * 0.2, z, 0.5); // the guard's bars
  P.box(0.02, 0.96, 0.04, m.galv, eastX + 0.36, wh + 0.8, z, 0.5); // the upright, a hair proud of the cross bars

  // By the man's door: a pressure washer on a little frame with its hose coiled and its lance leaning on the wall, and teat-dip drums on a pallet.
  const wx0 = dx - 2.2;
  P.box(0.6, 0.06, 0.45, m.galv, wx0, 0.25, southZ + 0.55, 1);
  for (const e of [-1, 1]) P.tube(0.03, 0.25, m.galv, wx0 + e * 0.26, 0.12, southZ + 0.55, 'y', 0.03, 6);
  P.box(0.5, 0.4, 0.34, m.washer, wx0, 0.5, southZ + 0.55, 0.6); // the body
  P.box(0.52, 0.05, 0.38, m.dark, wx0, 0.72, southZ + 0.55, 0.3); // its lid, a little bigger than the body
  P.add(new THREE.TorusGeometry(0.2, 0.025, 6, 16), m.hose, wx0, 0.6, southZ + 0.34); // the hose, coiled on its front
  P.between([wx0 + 0.28, 0.7, southZ + 0.5], [wx0 + 0.42, 1.55, southZ + 0.1], 0.018, m.dark); // the lance
  const px = dx + 2.3;
  for (const dz of [-0.4, 0, 0.4]) P.box(1.3, 0.04, 0.12, m.timber, px, 0.12, southZ + 0.7 + dz, 0.6); // the pallet's boards
  for (const dxp of [-0.55, 0, 0.55]) P.box(0.1, 0.1, 1.0, m.timber, px + dxp, 0.05, southZ + 0.7, 0.4);
  for (const [ox, oz] of [[-0.33, -0.2], [0.33, -0.2], [0, 0.32]]) {
    P.tube(0.27, 0.8, m.drum, px + ox, 0.56, southZ + 0.7 + oz, 'y', 0.27, 16);
    P.tube(0.285, 0.06, m.dark, px + ox, 0.975, southZ + 0.7 + oz, 'y', 0.285, 16); // its lid, sunk a little into the drum
    P.box(0.25, 0.18, 0.02, m.label, px + ox, 0.6, southZ + 0.7 + oz + 0.275, 0.3); // the label (flat, on its front)
  }

  fixedBox?.(x, y0 + wh / 2, z, halfX, wh / 2 + 0.5, halfZ);
  return P.group;
}

/**
 * The collecting yard in front of the parlour (`c`: minX, maxX, minZ, maxZ, and `gap`, the opening in the rails on the west side: z and width): a scraped
 * concrete slab a little above the yard's with a kerb round it, galvanised rails on posts round the open sides, a channel along the parlour wall under a
 * grating where the muck is scraped to, a drain, a backing gate hung on overhead rails and parked at the back, and a hosepipe on a reel on the parlour wall.
 */
export function buildCollectingYard(c, parlour, y0, m, { fixedBox } = {}) {
  const P = piece(y0, 'collectingYard');
  const nz = parlour.outer.maxZ; // the yard runs from the parlour's wall (a couple of metres north of the plan's rectangle) to its back
  const w = c.maxX - c.minX;
  const cx = (c.minX + c.maxX) / 2;
  const cz = (nz + c.maxZ) / 2;
  const kerb = 0.25;
  // The slab, a little over the yard's, with a kerb round the three open sides (one box each, meeting at the corners without overlapping), leaving the west gap.
  const channel = 0.75; // the strip along the parlour wall that is the muck channel
  P.box(w - 2 * kerb, 0.06, c.maxZ - kerb - nz - channel, m.scraped, cx, 0.045, (nz + channel + c.maxZ - kerb) / 2, 4);
  const gap0 = c.gap.z - c.gap.width / 2;
  const gap1 = c.gap.z + c.gap.width / 2;
  P.box(w, 0.16, kerb, m.scraped, cx, 0.1, c.maxZ - kerb / 2, 1);
  P.box(kerb, 0.16, c.maxZ - kerb - nz, m.scraped, c.maxX - kerb / 2, 0.1, (nz + c.maxZ - kerb) / 2, 1);
  P.box(kerb, 0.16, gap0 - nz, m.scraped, c.minX + kerb / 2, 0.1, (nz + gap0) / 2, 1);
  P.box(kerb, 0.16, c.maxZ - kerb - gap1, m.scraped, c.minX + kerb / 2, 0.1, (gap1 + c.maxZ - kerb) / 2, 1);
  // The rails: posts every 2.5 m with four rails between, on the east, south and the two stretches of the west side.
  const rails = (x0, z0, x1, z1, skipLast = false) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 2.5));
    for (let i = 0; i <= (skipLast ? n - 1 : n); i++) P.tube(0.055, 1.55, m.galv, x0 + ((x1 - x0) * i) / n, 0.78, z0 + ((z1 - z0) * i) / n, 'y', 0.055, 8);
    for (const ry of [0.35, 0.7, 1.05, 1.4]) P.between([x0, ry, z0], [x1, ry, z1], 0.027, m.galv, 8);
    fixedBox?.((x0 + x1) / 2, y0 + 0.8, (z0 + z1) / 2, Math.abs(x1 - x0) / 2 + 0.06, 0.8, Math.abs(z1 - z0) / 2 + 0.06);
  };
  rails(c.maxX - 0.15, nz + 0.2, c.maxX - 0.15, c.maxZ - 0.15, true); // (the corner's post is the south rail's)
  rails(c.minX + 0.15, c.maxZ - 0.15, c.maxX - 0.15, c.maxZ - 0.15);
  rails(c.minX + 0.15, nz + 0.2, c.minX + 0.15, gap0);
  rails(c.minX + 0.15, gap1, c.minX + 0.15, c.maxZ - 0.15, true);
  // The channel along the parlour wall: a dark wet trench the length of the yard, its floor 5 cm under the slab, under a grating of flat bars every 0.3 m.
  P.box(w - 2 * kerb, 0.02, channel, m.muck, cx, 0.02, nz + channel / 2, 1);
  for (let gx = c.minX + 0.5; gx < c.maxX - 0.4; gx += 0.3) P.box(0.04, 0.045, channel - 0.04, m.galv, gx, 0.098, nz + channel / 2, 0.3);
  P.box(w - 2 * kerb, 0.06, 0.05, m.galv, cx, 0.1, nz + 0.025, 0.5); // the grating's edge bars, along, a little taller than its bars
  P.box(w - 2 * kerb, 0.06, 0.05, m.galv, cx, 0.1, nz + channel - 0.025, 0.5);
  // A drain with its grating in the middle of the yard, where the slab falls to it.
  P.box(0.6, 0.03, 0.6, m.dark, cx - 4, 0.085, cz + 2, 1);
  for (let k = 0; k < 5; k++) P.box(0.05, 0.04, 0.64, m.galv, cx - 4.2 + k * 0.1, 0.105, cz + 2, 0.3);
  // The backing gate, hung from overhead rails along both sides on tall posts and parked 2.5 m from the back: a frame of rails with vertical bars.
  for (const [px, pz] of [[c.minX + 0.6, nz + 2], [c.minX + 0.6, c.maxZ - 0.6], [c.maxX - 0.6, nz + 2], [c.maxX - 0.6, c.maxZ - 0.6]]) P.tube(0.07, 2.6, m.galv, px, 1.3, pz, 'y', 0.07, 8);
  for (const px of [c.minX + 0.6, c.maxX - 0.6]) P.between([px, 2.55, nz + 2], [px, 2.55, c.maxZ - 0.6], 0.04, m.galv, 8);
  const gz = c.maxZ - 3;
  P.between([c.minX + 0.6, 1.25, gz], [c.maxX - 0.6, 1.25, gz], 0.035, m.galv, 8); // the top rail
  P.between([c.minX + 0.6, 0.7, gz], [c.maxX - 0.6, 0.7, gz], 0.03, m.galv, 8);
  P.between([c.minX + 0.6, 0.2, gz], [c.maxX - 0.6, 0.2, gz], 0.03, m.galv, 8);
  for (let bx = c.minX + 1.2; bx < c.maxX - 0.8; bx += 1.2) P.tube(0.016, 1.1, m.galv, bx, 0.72, gz, 'y', 0.016, 5);
  for (const px of [c.minX + 0.6, c.maxX - 0.6]) {
    P.between([px, 1.25, gz], [px, 2.55, gz], 0.03, m.galv, 6); // the hanger up to the overhead rail
    P.box(0.18, 0.12, 0.3, m.galv, px, 2.5, gz, 0.4); // its trolley
  }
  // The hosepipe on its reel on the parlour wall: a galvanised bracket, a green coil of hose and a length lying out across the concrete.
  const rx = cx + 6;
  const rz = nz + 0.02;
  P.box(0.5, 0.06, 0.2, m.galv, rx, 1.25, rz - 0.02, 0.5);
  P.add(new THREE.TorusGeometry(0.26, 0.04, 8, 20), m.hose, rx, 1.0, rz + 0.12);
  P.add(new THREE.TorusGeometry(0.2, 0.04, 8, 20), m.hose, rx, 1.0, rz + 0.17);
  P.add(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), m.galv, rx, 1.0, rz + 0.1, 0, Math.PI / 2, 0); // the reel's hub
  const bends = [[rx + 0.2, 0.9, rz + 0.3], [rx + 0.6, 0.05, rz + 1.1], [rx + 1.8, 0.07, rz + 1.9], [rx + 3.2, 0.07, rz + 1.6], [rx + 4.1, 0.07, rz + 2.6]];
  for (let k = 0; k < bends.length - 1; k++) P.between(bends[k], bends[k + 1], 0.03, m.hose, 8);
  P.tube(0.04, 0.12, m.galv, rx + 4.1, 0.07, rz + 2.6, 'x', 0.04, 8); // the nozzle
  return P.group;
}

/**
 * The bulk milk tank's room (`r`: x, z, halfX, halfZ, wallHeight): a small block room with a lean-to roof of fibre-cement and a steel door open onto the
 * tanker's side (the south), a stainless horizontal tank on legs through the doorway with its manhole, agitator motor, dial and outlet valve, a milk
 * pipe in from the parlour, and outside by the door the pipe stub with a camlock coupling for the tanker's hose and a collection-point board.
 */
export function buildTankRoom(r, parlour, y0, m, { fixedBox } = {}) {
  const P = piece(y0, 'tankRoom');
  const { x, z, halfX, halfZ, wallHeight: wh } = r;
  const t = 0.25;
  const doorHalf = 0.62;
  const wall = (cx, cz, w, d, bottom = -0.3, top = wh) => {
    P.box(w, top - bottom, d, m.block, cx, (top + bottom) / 2, cz, 1.8);
    fixedBox?.(cx, y0 + (top + bottom) / 2, cz, w / 2, (top - bottom) / 2 + 0.3, d / 2);
  };
  P.box(halfX * 2 - 2 * t, 0.04, halfZ * 2 - 2 * t, m.scraped, x, 0.02, z, 3); // the floor, 4 cm up, flush with the doorway's step
  fixedBox?.(x, y0 + 0.02, z, halfX - t, 0.02, halfZ - t);
  wall(x, z - halfZ + t / 2, halfX * 2, t);
  wall(x - halfX + t / 2, z, t, halfZ * 2 - 2 * t);
  wall(x + halfX - t / 2, z, t, halfZ * 2 - 2 * t);
  const sz = z + halfZ - t / 2;
  wall(x - (halfX + doorHalf) / 2 - 0.0, sz, halfX - doorHalf, t); // the south wall either side of the door (the door is at the middle)
  wall(x + (halfX + doorHalf) / 2, sz, halfX - doorHalf, t);
  P.box(doorHalf * 2, wh - 2.15, t, m.block, x, 2.15 + (wh - 2.15) / 2, sz, 1.8); // over the door
  P.box(doorHalf * 2 + 0.4, 0.14, t + 0.12, m.scraped, x, 2.2, sz, 1); // the lintel
  for (const e of [-1, 1]) P.box(0.08, 2.15, t + 0.04, m.white, x + e * (doorHalf + 0.03), 1.07, sz, 0.5); // the frame, a centimetre proud of the jamb
  P.box(doorHalf * 2 + 0.3, 0.045, 0.55, m.scraped, x, 0.0225, sz + 0.35, 1.5); // the step, level with the floor (so there is nothing to catch a foot on)
  fixedBox?.(x, y0 + 0.0225, sz + 0.35, doorHalf + 0.15, 0.0225, 0.275);
  // The steel door, swung open against the wall on its east hinge: its leaf runs out from the south face.
  const leaf = P.box(0.06, 2.05, doorHalf * 2, m.door, x + doorHalf + 0.1, 1.04, sz + t / 2 + 0.02 + doorHalf, 1);
  leaf.rotation.y = 0;
  // Lean-to roof, high at the back (north): fibre-cement sheets over a fascia and a gutter on the front, a downpipe at the east corner.
  const rise = 0.5;
  const span = halfZ * 2 + 0.5;
  const roofLen = Math.hypot(span, rise);
  const sheet = P.sheet(halfX * 2 + 0.5, roofLen, m.cement, x, wh + rise / 2 + 0.05, z);
  sheet.rotation.x = Math.atan2(rise, span);
  P.box(halfX * 2 + 0.5, 0.18, 0.05, m.white, x, wh - 0.05, z + halfZ + 0.27, 0.6);
  P.box(halfX * 2 + 0.3, 0.1, 0.14, m.galv, x, wh - 0.22, z + halfZ + 0.33, 1);
  P.tube(0.04, wh - 0.35, m.galv, x + halfX - 0.1, (wh - 0.35) / 2, z + halfZ + 0.33, 'y', 0.04, 8);
  gable(P, m.block, x - halfX + 0.1, wh, z, halfZ * 2, 0.5, true); // the end walls rise to the roof's slope, high at the back
  gable(P, m.block, x + halfX - 0.1, wh, z, halfZ * 2, 0.5, true);

  // Inside: the stainless tank, lying along x on four legs, domed at both ends, set back so there is room to stand in the doorway.
  const tz = z - 0.45;
  const ty = 1.25;
  const tr = 0.78;
  const tank = P.tube(tr, 2.5, m.stainless, x - 0.4, ty, tz, 'x', tr, 24);
  void tank;
  for (const e of [-1, 1]) {
    const dome = P.add(new THREE.SphereGeometry(tr, 20, 10), m.stainless, x - 0.4 + e * 1.25, ty, tz);
    dome.scale.set(0.45, 1, 1);
  }
  for (const [lx, lz] of [[-1.5, -0.45], [-1.5, 0.45], [0.7, -0.45], [0.7, 0.45]]) P.tube(0.05, 0.46, m.stainless, x + lx, 0.27, tz + lz, 'y', 0.05, 8); // standing on the floor
  P.box(2.8, 0.06, 1.2, m.galv, x - 0.4, 0.5, tz, 0.5); // the frame the legs stand on
  P.tube(0.22, 0.12, m.stainless, x - 0.4, ty + tr + 0.05, tz, 'y', 0.22, 16); // the manhole's collar
  P.tube(0.2, 0.05, m.stainless, x - 0.4, ty + tr + 0.13, tz, 'y', 0.2, 16); // its lid
  P.box(0.04, 0.04, 0.3, m.galv, x - 0.4, ty + tr + 0.18, tz + 0.05, 0.3); // the handle
  P.box(0.36, 0.3, 0.32, m.green, x + 1.0, ty + 0.2, tz, 0.6); // the agitator motor on the east end
  P.tube(0.04, 0.4, m.galv, x + 0.85, ty + 0.2, tz, 'x', 0.04, 8);
  P.add(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 16), m.white, x - 0.4, ty + 0.2, tz + tr + 0.02, 0, Math.PI / 2, 0); // the temperature dial on the front
  P.add(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 16), m.dark, x - 0.4, ty + 0.2, tz + tr + 0.045, 0, Math.PI / 2, 0);
  // The outlet: a valve low at the front of the tank, a pipe along the inside of the south wall and out through it as the stub.
  const stubX = x + 1.4;
  const stubY = 0.95;
  P.between([x - 1.4, 0.82, tz + tr * 0.6], [x - 1.4, 0.55, sz - 0.5], 0.05, m.stainless, 8);
  P.between([x - 1.4, 0.55, sz - 0.5], [stubX, stubY, sz - 0.3], 0.05, m.stainless, 8);
  P.box(0.12, 0.1, 0.12, m.dark, x - 1.4, 0.62, tz + 0.55, 0.3); // the valve's handle
  // The milk line in from the parlour: a pipe through the west wall to the tank's top, with a bracket.
  const pipeY = 2.5;
  P.between([parlour.x + parlour.halfX + 0.1, pipeY, z], [x - halfX - 0.05, pipeY, z], 0.05, m.stainless, 8);
  P.between([x - halfX - 0.05, pipeY, z], [x - halfX + 0.5, pipeY, z], 0.05, m.stainless, 8);
  P.between([x - halfX + 0.5, pipeY, z], [x - 0.9, ty + tr, tz], 0.04, m.stainless, 8);
  P.box(0.08, 0.3, 0.08, m.galv, (parlour.x + parlour.halfX + x - halfX) / 2, pipeY + 0.17, z, 0.3);
  // Outside, by the door: the pipe stub through the south wall with its camlock coupling and dust cap, and the collection point's board.
  P.between([stubX, stubY, sz], [stubX, stubY, sz + 0.55], 0.05, m.stainless, 10);
  P.tube(0.07, 0.1, m.galv, stubX, stubY, sz + 0.6, 'z', 0.07, 10); // the coupling
  P.tube(0.06, 0.06, m.dark, stubX, stubY, sz + 0.68, 'z', 0.06, 10); // the dust cap
  P.box(0.5, 0.32, 0.03, m.collect, x - 1.45, 1.6, sz + t / 2 + 0.02, 0.5); // the collection point's board, on the wall's outer face
  fixedBox?.(x - 0.4, y0 + ty, tz, 1.5, tr + 0.4, tr); // the tank
  return P.group;
}

/**
 * The slurry store (`s`: x, z, r, height): a round tank of precast concrete panels 3.6 m high with a lipped top, a plinth and apron at its foot, a steel ladder
 * up the outside with a safety hoop at the top, a danger board on a post beside it, a loading pipe at the foot, and the dark crust of the slurry in the top.
 */
export function buildSlurryStore(s, y0, m, { fixedBox } = {}) {
  const P = piece(y0, 'slurryStore');
  const { x, z, r, height: h } = s;
  const wall = new THREE.CylinderGeometry(r, r, h + 0.4, 96, 3, true);
  const uv = wall.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ((2 * Math.PI * r) / 2.4), uv.getY(i) * ((h + 0.4) / 3.6)); // panels 2.4 m wide
  P.add(wall, m.slurryWall, x, (h - 0.4) / 2, z);
  P.add(new THREE.RingGeometry(0.01, r - 0.02, 96, 5), m.slurryCrust, x, h - 0.45, z, 0, -Math.PI / 2, 0); // the crust, 0.45 m below the lip
  P.add(new THREE.TorusGeometry(r - 0.05, 0.14, 8, 48), m.scraped, x, h + 0.02, z, 0, Math.PI / 2, 0).scale.set(1, 1, 1); // the lip
  const plinth = P.add(new THREE.CylinderGeometry(r + 0.25, r + 0.3, 0.3, 48, 1), m.scraped, x, 0.15, z); // the plinth at the foot
  void plinth;
  P.add(new THREE.RingGeometry(r + 0.28, r + 3.2, 96, 3), m.scraped, x, 0.03, z, 0, -Math.PI / 2, 0); // the apron round it
  // The ladder on the south side, up to the lip, with its safety hoop above 2.3 m and a gate across the top.
  const lx = x;
  const lz = z + r + 0.35;
  for (const e of [-1, 1]) P.between([lx + e * 0.22, 0.2, lz], [lx + e * 0.22, h + 0.9, lz], 0.025, m.galv, 8);
  for (let ry = 0.4; ry < h + 0.8; ry += 0.3) P.between([lx - 0.22, ry, lz], [lx + 0.22, ry, lz], 0.016, m.galv, 6);
  for (const ry of [0.6, 1.8, 3.0]) for (const e of [-1, 1]) P.box(0.05, 0.05, 0.4, m.galv, lx + e * 0.22, ry, lz - 0.2, 0.3); // the stand-off brackets
  for (const ry of [2.6, 3.1, 3.6]) {
    for (let a = -3; a <= 3; a++) P.between([lx + Math.sin((a * Math.PI) / 7) * 0.4, ry, lz + 0.2 - Math.cos((a * Math.PI) / 7) * 0.4 + 0.2], [lx + Math.sin(((a + 1) * Math.PI) / 7) * 0.4, ry, lz + 0.2 - Math.cos(((a + 1) * Math.PI) / 7) * 0.4 + 0.2], 0.015, m.galv, 5);
  }
  // The warning board on a post by the ladder: yellow, black-bordered, lettered, 0.8 by 0.6 m.
  P.tube(0.05, 2.0, m.galv, lx + 1.4, 1.0, lz + 0.4, 'y', 0.05, 8);
  P.box(0.8, 0.6, 0.03, m.danger, lx + 1.4, 1.8, lz + 0.43, 0.8);
  // The loading pipe: a galvanised elbow out of the wall near the foot to a valve with a wheel, for the tanker's pump.
  const px = x - 2.4;
  const pz = z + r + 0.1;
  P.between([px, 0.5, pz - 0.05], [px, 0.5, pz + 0.9], 0.09, m.galv, 10);
  P.between([px, 0.5, pz + 0.9], [px, 0.1, pz + 0.9], 0.08, m.galv, 10); // down to the valve, a little thinner than the run
  P.box(0.2, 0.2, 0.2, m.galv, px, 0.5, pz + 0.45, 0.4);
  P.add(new THREE.TorusGeometry(0.1, 0.012, 6, 14), m.dark, px, 0.72, pz + 0.45, 0, Math.PI / 2, 0); // the valve's wheel
  // Colliders: a ring of boxes along the wall.
  const n = 16;
  for (let k = 0; k < n; k++) {
    const a = ((k + 0.5) / n) * Math.PI * 2;
    fixedBox?.(x + Math.cos(a) * r, y0 + h / 2, z + Math.sin(a) * r, (Math.PI * r) / n + 0.1, h / 2, 0.2, -a + Math.PI / 2);
  }
  return P.group;
}
