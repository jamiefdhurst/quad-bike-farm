import * as THREE from 'three';
import { buildTop, buildInset, buttonShape, slitShape, layOnCloth, poloFields, tuckSleeves, logoThread, POLO, JUMPER, COAT, PLAID, PLAID_OVER, PLAID_OPEN, OVER_POLO, SHIRT, SHIRT_OVER, SHIRT_ROLLED, SHIRT_ROLLED_OVER } from './polo.js';
import { buildTie } from './tie.js';
import { shirtButtonsUndone } from './outfits.js';
import { buildCropTop } from './crop.js';
import { buildShorts, SHORTS } from './shorts.js';
import { buildCollar, COLLAR, COAT_COLLAR, SHIRT_COLLAR, SHIRT_UNDER_COLLAR, OVER_COLLAR, POINT_COLLAR, POLO_UNDER_SHIRT_COLLAR } from './collar.js';
import { buildHood, lowerHood, intoHood, chestShare, tartan } from './hood.js';
import { COAT_COLLAR_COLOUR } from './coats.js';
import { measureHead, RIM_BELOW_CROWN } from './helmetView.js';
import { buildTail, strand, merge } from './ponytail.js';
import { PonytailSwing } from './ponytailView.js';
import { unskin, smoothNormals, blendWeights, vec } from './garmentMesh.js';

// Outfits for the companion. The Quaternius model is textured from a tiny palette (one flat colour per band), so her hair and the
// body under her clothes are recoloured by swapping palette entries. Her clothes are garments over the body: the polo, its collar,
// the jumper and the shorts are cut from her own mesh along smooth lines and skinned to her skeleton (polo.js, collar.js,
// shorts.js, on garmentMesh.js), and the wellies are shells fitted round her legs and attached to bones. See docs/decisions/girls.md, "The
// polo as a garment" and its follow-ups.

// Palette colours in the source texture.
export const PALETTE = {
  skin: [231, 189, 145],
  dark: [41, 41, 41],
  hair: [209, 194, 112],
  shirt: [231, 101, 92],
  trousers: [97, 135, 211],
  shoes: [240, 71, 47],
};

export const OUTFITS = {
  original: {},
  farmPolo: {
    // Bare legs: the jeans band becomes skin, and shorts go on as a garment. The shirt band is painted the polo's colour under it.
    colors: { shirt: '#3a5690', shoes: '#2f4a2c', trousers: 'skin' },
    polo: '#3a5690', // her polo, and its colour (her favourite quad's, once she has one)
    wellies: '#2f4a2c',
    shorts: '#56739f',
  },
  // Jess: black hair, a burgundy polo, black wellies and darker shorts.
  jessPolo: {
    colors: { hair: '#2a221d', shirt: '#8e2238', shoes: '#262626', trousers: 'skin' },
    polo: '#8e2238',
    wellies: '#262626',
    shorts: '#3f4f6e',
  },
};

function recolourTexture(texture, colors) {
  const img = texture.image;
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  // A colour is a hex, or the name of another palette band (e.g. 'skin' for bare legs). The shirt band is the colour as it is, to
  // match the polo over it; the others keep their old, darker reading (the linear value written as the pixel), which their
  // colours were chosen for.
  const swaps = Object.entries(colors).map(([band, hex]) => {
    if (PALETTE[hex]) return { from: PALETTE[band], to: PALETTE[hex] };
    const c = new THREE.Color(hex);
    if (band === 'shirt') {
      const h = c.getHex();
      return { from: PALETTE[band], to: [(h >> 16) & 255, (h >> 8) & 255, h & 255] };
    }
    return { from: PALETTE[band], to: [c.r * 255, c.g * 255, c.b * 255].map(Math.round) };
  });
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    for (const { from, to } of swaps) {
      if (Math.abs(d[i] - from[0]) < 3 && Math.abs(d[i + 1] - from[1]) < 3 && Math.abs(d[i + 2] - from[2]) < 3) {
        d[i] = to[0];
        d[i + 1] = to[1];
        d[i + 2] = to[2];
      }
    }
  }
  ctx.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  for (const key of ['flipY', 'colorSpace', 'wrapS', 'wrapT', 'magFilter', 'minFilter', 'generateMipmaps']) tex[key] = texture[key];
  tex.needsUpdate = true;
  return tex;
}

/** The character's skinned body mesh. */
export function bodyMesh(rig) {
  let mesh = null;
  rig.model.traverse((o) => {
    if (o.isSkinnedMesh && !mesh) mesh = o;
  });
  return mesh;
}

/** Root-space position of a bone. */
function bonePos(rig, name) {
  return rig.root.worldToLocal(rig.bones[name].getWorldPosition(new THREE.Vector3()));
}

const raycaster = new THREE.Raycaster();

/**
 * A plain mesh of the body posed as it is now, for the fitting's rays. Casting at the skinned mesh itself re-poses every vertex of
 * every triangle on every ray (about 4 s of loading for the two girls); this poses them once. Same triangles, same transform and
 * material (so the same sides count), so every ray hits exactly where it would have.
 */
function posedCopy(mesh) {
  const src = mesh.geometry;
  const pos = src.attributes.position;
  const posed = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    mesh.getVertexPosition(i, v);
    posed[i * 3] = v.x;
    posed[i * 3 + 1] = v.y;
    posed[i * 3 + 2] = v.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posed, 3));
  // The rest as they are: a hit's uv and normal come from these, as on the skinned mesh.
  for (const [name, attr] of Object.entries(src.attributes)) if (name !== 'position') geo.setAttribute(name, attr);
  if (src.index) geo.setIndex(src.index);
  for (const g of src.groups) geo.addGroup(g.start, g.count, g.materialIndex);
  const copy = new THREE.Mesh(geo, mesh.material);
  copy.matrixAutoUpdate = false;
  copy.matrixWorld.copy(mesh.matrixWorld);
  return cullRays(copy);
}

const toLocal = new THREE.Matrix4();
const localRay = new THREE.Ray();

/** Whether a ray (origin `o`, direction `d`, as far as `far`) crosses the box at `at` in `boxes` (min xyz, max xyz). */
function crossesBox(boxes, at, o, d, far) {
  let near = 0;
  let out = Infinity;
  for (let axis = 0; axis < 3 && near <= out; axis++) {
    const lo = boxes[at + axis];
    const hi = boxes[at + 3 + axis];
    const origin = axis === 0 ? o.x : axis === 1 ? o.y : o.z;
    const dir = axis === 0 ? d.x : axis === 1 ? d.y : d.z;
    if (dir === 0) {
      if (origin < lo || origin > hi) out = -1;
    } else {
      const t1 = (lo - origin) / dir;
      const t2 = (hi - origin) / dir;
      near = Math.max(near, Math.min(t1, t2));
      out = Math.min(out, Math.max(t1, t2));
    }
  }
  return !(near > out || out < 0 || near > far * 1.0001);
}

const RUN = 16; // triangles boxed together, near each other, so a ray skips most of her at once

/**
 * Makes a ray at `mesh` test only the triangles whose box it crosses, then hand those to three's own test, so a hit is exactly what it was
 * and a ray no longer walks every triangle of the body (about 0.2 s of loading for the two girls). The triangles are put in order along a
 * curve through space and boxed in runs as well, so a ray tests a run's box before its triangles': with her body split at load
 * (smoothBody.js) there are four times as many. Needs one material and an index.
 */
export function cullRays(mesh) {
  const geo = mesh.geometry;
  const pos = geo.attributes.position.array;
  if (!geo.index || Array.isArray(mesh.material)) return mesh;
  const index = geo.index.array.slice(); // its own: the index is shared with the real body, which must keep every triangle
  const count = index.length / 3;
  const boxes = new Float32Array(count * 6);
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let t = 0; t < count; t++) {
    for (let axis = 0; axis < 3; axis++) {
      const a = pos[index[t * 3] * 3 + axis];
      const b = pos[index[t * 3 + 1] * 3 + axis];
      const c = pos[index[t * 3 + 2] * 3 + axis];
      boxes[t * 6 + axis] = Math.min(a, b, c) - 1e-5;
      boxes[t * 6 + 3 + axis] = Math.max(a, b, c) + 1e-5;
      lo[axis] = Math.min(lo[axis], boxes[t * 6 + axis]);
      hi[axis] = Math.max(hi[axis], boxes[t * 6 + 3 + axis]);
    }
  }
  // In order along a Morton curve through their middles, so each run of RUN is a small patch of her.
  const cell = (t, axis) => Math.min(1023, Math.floor(((boxes[t * 6 + axis] + boxes[t * 6 + 3 + axis]) / 2 - lo[axis]) / (hi[axis] - lo[axis] || 1) * 1024));
  const spread = (x) => {
    let k = 0;
    for (let bit = 0; bit < 10; bit++) k += ((x >> bit) & 1) * 2 ** (bit * 3);
    return k;
  };
  const order = Array.from({ length: count }, (_, t) => t);
  const code = order.map((t) => spread(cell(t, 0)) + 2 * spread(cell(t, 1)) + 4 * spread(cell(t, 2)));
  order.sort((a, b) => code[a] - code[b]);
  const runs = Math.ceil(count / RUN);
  const runBoxes = new Float32Array(runs * 6);
  for (let r = 0; r < runs; r++) {
    runBoxes.fill(Infinity, r * 6, r * 6 + 3);
    runBoxes.fill(-Infinity, r * 6 + 3, r * 6 + 6);
    for (let k = r * RUN; k < Math.min(count, (r + 1) * RUN); k++) {
      for (let axis = 0; axis < 6; axis++) {
        const v = boxes[order[k] * 6 + axis];
        runBoxes[r * 6 + axis] = axis < 3 ? Math.min(runBoxes[r * 6 + axis], v) : Math.max(runBoxes[r * 6 + axis], v);
      }
    }
  }
  const full = Uint32Array.from(index);
  geo.setIndex(new THREE.BufferAttribute(index, 1)); // the list three walks: the first `3 * kept` entries are the triangles in play
  const raycast = THREE.Mesh.prototype.raycast;
  mesh.raycast = function (raycaster, intersects) {
    toLocal.copy(this.matrixWorld).invert();
    localRay.copy(raycaster.ray).applyMatrix4(toLocal);
    const { origin: o, direction: d } = localRay;
    const far = raycaster.far;
    // Kept in their first order, so hits that tie come out as they did.
    const hit = [];
    for (let r = 0; r < runs; r++) {
      if (!crossesBox(runBoxes, r * 6, o, d, far)) continue;
      for (let k = r * RUN; k < Math.min(count, (r + 1) * RUN); k++) if (crossesBox(boxes, order[k] * 6, o, d, far)) hit.push(order[k]);
    }
    hit.sort((a, b) => a - b);
    hit.forEach((t, kept) => {
      index[kept * 3] = full[t * 3];
      index[kept * 3 + 1] = full[t * 3 + 1];
      index[kept * 3 + 2] = full[t * 3 + 2];
    });
    geo.setDrawRange(0, hit.length * 3);
    raycast.call(this, raycaster, intersects);
  };
  return mesh;
}

/** What the fitting casts at: the posed copy while one is in use (`withPosedBody`), otherwise the mesh. */
const castAt = (rig, mesh) => (rig.posedBody?.source === mesh ? rig.posedBody.copy : mesh);

/** Runs the garment fitting with the body posed once for all its rays. */
function withPosedBody(rig, fn) {
  const body = bodyMesh(rig);
  rig.root.updateMatrixWorld(true);
  rig.posedBody = body ? { source: body, copy: posedCopy(body) } : null;
  try {
    fn();
  } finally {
    rig.posedBody?.copy.geometry.dispose();
    rig.posedBody = null;
  }
}

/**
 * Distance from an axis point out to the body surface in a given direction,
 * found by casting a ray inward from `reach` away. By default the last hit
 * before the axis is used, so hair in front of the surface is ignored;
 * `outermost` takes the first hit instead, to wrap over loose clothing.
 */
function surfaceDistance(rig, mesh, centre, dir, reach = 0.3, outermost = false) {
  const root = rig.root;
  const origin = root.localToWorld(centre.clone().addScaledVector(dir, reach));
  const target = root.localToWorld(centre.clone());
  raycaster.set(origin, target.clone().sub(origin).normalize());
  raycaster.far = origin.distanceTo(target);
  const hits = raycaster.intersectObject(castAt(rig, mesh), false);
  if (!hits.length) return null;
  return raycaster.far - hits[outermost ? 0 : hits.length - 1].distance;
}

/**
 * A shell that follows the body around a line from `a` to `b` (root space).
 * At each fraction t in `rings`, rays find the body's outline around the line
 * and `offset(t, radius)` gives the shell's radius there. Angles in `skip`
 * (radians, 0 = the character's front) are left open. Returns geometry in root space.
 */
function fittedShell(
  rig,
  mesh,
  a,
  b,
  rings,
  offset,
  { segments = 20, skip = null, capEnd = false, fallback = 0.04, reach = 0.3, outermost = false } = {},
) {
  const axis = b.clone().sub(a).normalize();
  // Perpendicular basis with u pointing as close to the character's front (+Z) as possible.
  const front = new THREE.Vector3(0, 0, 1);
  const u = front.clone().addScaledVector(axis, -front.dot(axis));
  if (u.lengthSq() < 1e-4) u.set(1, 0, 0).addScaledVector(axis, -axis.x);
  u.normalize();
  const v = new THREE.Vector3().crossVectors(axis, u).normalize();

  const angles = [];
  for (let i = 0; i <= segments; i++) {
    const ang = (i / segments) * Math.PI * 2;
    if (skip && Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang))) < skip) continue;
    angles.push(ang);
  }
  const positions = [];
  const rows = rings.map((t) => {
    const centre = a.clone().lerp(b, t);
    return angles.map((ang) => {
      const dir = u.clone().multiplyScalar(Math.cos(ang)).addScaledVector(v, Math.sin(ang));
      const r = offset(t, surfaceDistance(rig, mesh, centre, dir, reach, outermost) ?? fallback);
      const p = centre.clone().addScaledVector(dir, r);
      positions.push(p.x, p.y, p.z);
      return positions.length / 3 - 1;
    });
  });
  // The last angle duplicates the first (0 and 2pi), so a full ring closes itself.
  const index = [];
  for (let r = 0; r < rows.length - 1; r++) {
    for (let i = 0; i < angles.length - 1; i++) {
      const p0 = rows[r][i];
      const p1 = rows[r][i + 1];
      const q0 = rows[r + 1][i];
      const q1 = rows[r + 1][i + 1];
      index.push(p0, p1, q0, p1, q1, q0);
    }
  }
  if (capEnd) {
    const last = rows[rows.length - 1];
    const tip = b.clone().addScaledVector(axis, 0.002);
    positions.push(tip.x, tip.y, tip.z);
    const ti = positions.length / 3 - 1;
    for (let i = 0; i < last.length - 1; i++) index.push(last[i], last[i + 1], ti);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** Adds a root-space mesh and hands it to a bone, keeping it where it is. */
function attachToBone(rig, mesh, boneName) {
  mesh.castShadow = true;
  rig.root.add(mesh);
  rig.bones[boneName].attach(mesh);
  rig.outfitParts.push(mesh);
}

const NECK_SPAN = 0.14; // metres of height the neckline strip covers, half below the neckline and half above

/** Reads a body vertex's colour in the model's original texture: `is(i, rgb)` says whether vertex i is that palette colour. */
function paletteUv(body) {
  const map = body.material.userData.baseMap ?? body.material.map;
  const img = map?.image;
  if (!img) return null;
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const uv = body.geometry.attributes.uv;
  const texel = (i) => {
    const x = Math.min(canvas.width - 1, Math.floor(uv.getX(i) * canvas.width));
    const y = Math.min(canvas.height - 1, Math.floor((map.flipY ? 1 - uv.getY(i) : uv.getY(i)) * canvas.height));
    return (y * canvas.width + x) * 4;
  };
  return {
    is: (i, c) => {
      const k = texel(i);
      return Math.abs(px[k] - c[0]) < 3 && Math.abs(px[k + 1] - c[1]) < 3 && Math.abs(px[k + 2] - c[2]) < 3;
    },
  };
}

const strips = new WeakMap(); // original texture -> a copy twice as wide, with the neckline strip in its right half
const stripTextures = new WeakSet();
// Geometries already cut. Not a flag in geometry.userData: a cloned geometry shares that object with the one it came from.
const cutGeometries = new WeakSet();

/**
 * The texture with a strip added beside it: shirt colour in one half of its height and skin in the other. A triangle mapped
 * across the strip by height changes from shirt to skin exactly where the neckline crosses it, however coarse the triangle.
 * The colours are the original palette's, so recolouring the shirt recolours the strip too.
 */
function withNecklineStrip(texture) {
  if (stripTextures.has(texture)) return texture;
  if (strips.has(texture)) return strips.get(texture);
  const img = texture.image;
  const w = img.width;
  const h = img.height;
  const canvas = document.createElement('canvas');
  canvas.width = w * 2;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  // Below the neckline (v under 0.5) is shirt; which rows that is depends on flipY.
  const shirtRows = texture.flipY ? [Math.ceil(h / 2), h] : [0, Math.floor(h / 2)];
  ctx.fillStyle = `rgb(${PALETTE.skin.join(',')})`;
  ctx.fillRect(w, 0, w, h);
  ctx.fillStyle = `rgb(${PALETTE.shirt.join(',')})`;
  ctx.fillRect(w, shirtRows[0], w, shirtRows[1] - shirtRows[0]);
  const tex = new THREE.CanvasTexture(canvas);
  for (const key of ['flipY', 'colorSpace', 'wrapS', 'wrapT', 'magFilter', 'minFilter', 'generateMipmaps']) tex[key] = texture[key];
  tex.needsUpdate = true;
  strips.set(texture, tex);
  stripTextures.add(tex);
  return tex;
}

/**
 * The body's paint under the polo. The model's shirt comes up her neck like a roll neck, to within a few centimetres of her jaw,
 * and the model is too coarse for whole triangles to give a clean line lower down. So the texture gets a neckline strip
 * (withNecklineStrip), every other UV is squeezed into its left half, and each shirt triangle round her neck that reaches the
 * polo's neckline (`line.above(i)`, poloNeckPaint) is mapped across the strip by its height above it: shirt below, skin above,
 * so no paint shows above the polo. Once per geometry; each girl has her own.
 */
function cutNeckline(rig, body, line) {
  const original = body.material.userData.baseMap ?? body.material.map;
  if (!original?.image || !line) return;
  const strip = withNecklineStrip(original);
  // Every mesh on that texture (her hair can be its own mesh on the same material), found before any is changed.
  const users = [];
  rig.model.traverse((o) => {
    if (o.isMesh && (o.material.userData.baseMap ?? o.material.map) === original) users.push(o);
  });
  for (const o of users) {
    const g = o.geometry;
    if (!cutGeometries.has(g)) {
      const uv = g.attributes.uv;
      // Which triangles to cut, read from the original texture and UVs.
      const cut = [];
      if (o === body) {
        const pal = paletteUv(body);
        const pos = g.attributes.position;
        const index = g.index ? g.index.array : [...Array(pos.count).keys()];
        for (let t = 0; t < index.length; t += 3) {
          const tri = [index[t], index[t + 1], index[t + 2]];
          if (!tri.every((i) => pal.is(i, PALETTE.shirt))) continue;
          // The polo's own neckline (`above(i)` is vertex i's height above it, worked out where she stands).
          const d = tri.map(line.above);
          if (tri.some(line.near) && Math.max(...d) > -0.01) tri.forEach((i, k) => cut.push([i, d[k]]));
        }
      }
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) / 2);
      for (const [i, d] of cut) uv.setXY(i, 0.75, 0.5 + Math.max(-0.49, Math.min(0.49, d / NECK_SPAN)));
      uv.needsUpdate = true;
      cutGeometries.add(g);
    }
  }
  for (const o of users) {
    o.material.userData.baseMap = strip;
    o.material.map = strip;
  }
}

/** Rubber boots: a shaft fitted round each shin and a chunky foot over the shoe. */
function addWellies(rig, color) {
  const mesh = bodyMesh(rig);
  if (!mesh) return;
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.42, side: THREE.DoubleSide });
  for (const side of ['Left', 'Right']) {
    if (!rig.bones[`${side}Leg`] || !rig.bones[`${side}Foot`]) continue;
    const knee = bonePos(rig, `${side}Leg`);
    const ankle = bonePos(rig, `${side}Foot`);
    // Shaft from a little below the knee to just past the ankle, flared at the top
    // so the jeans tuck in rather than poke out.
    const shaft = new THREE.Mesh(
      fittedShell(
        rig,
        mesh,
        knee,
        ankle.clone().addScaledVector(ankle.clone().sub(knee).normalize(), 0.065),
        [0.24, 0.3, 0.45, 0.6, 0.75, 0.88, 0.95, 1.0],
        // Flared at the top; widening again at the bottom to meet the boot foot.
        (t, r) => Math.min(r, 0.075) + 0.006 + (t < 0.32 ? 0.012 * (1 - (t - 0.24) / 0.08) : 0) + (t > 0.85 ? 0.018 * (t - 0.85) / 0.15 : 0),
        // Short reach so the other leg isn't caught; outermost so the jeans hem tucks inside.
        { segments: 16, fallback: 0.05, reach: 0.1, outermost: true },
      ),
      mat,
    );
    shaft.name = `${side.toLowerCase()}Welly`;
    attachToBone(rig, shaft, `${side}Leg`);

    // Boot foot: from behind the heel to past the toe, a little proud of the shoe.
    const toeName = rig.bones[`${side}Toe_End`] ? `${side}Toe_End` : `${side}ToeBase`;
    if (!rig.bones[toeName]) continue;
    const toe = bonePos(rig, toeName);
    const along = toe.clone().sub(ankle);
    const heel = ankle.clone().addScaledVector(along, -0.28);
    heel.y = Math.min(heel.y, toe.y + 0.03);
    const foot = new THREE.Mesh(
      // Rounded toe: don't let the shell taper to a point at the front.
      fittedShell(rig, mesh, heel, toe, [0, 0.15, 0.4, 0.65, 0.85, 0.95, 1], (t, r) => Math.max(Math.min(r, 0.07), t > 0.6 ? 0.03 : 0) + 0.008 + (t < 0.3 ? 0.01 : 0) - (t > 0.95 ? 0.012 : 0), {
        segments: 14,
        capEnd: true,
        fallback: 0.035,
      }),
      mat,
    );
    foot.name = `${side.toLowerCase()}WellyFoot`;
    attachToBone(rig, foot, `${side}Foot`);
  }
}

/**
 * Dresses her: recolours the body's palette and fits the garments. `garments: false` leaves the fitting for later (refitOutfit),
 * for a girl whose shirt colour and buttons are dealt straight after she's made, so they're only fitted once.
 */
export function applyOutfit(rig, outfit, { garments = true } = {}) {
  rig.root.updateMatrixWorld(true);
  rig.outfitParts = [];
  const body = bodyMesh(rig);
  if (body && outfit.polo) cutNeckline(rig, body, poloNeckPaint(rig, body));
  rig.model.traverse((o) => {
    if (!o.isMesh) return;
    const mat = o.material;
    if (outfit.colors && mat.map) {
      mat.userData.baseMap ??= mat.map; // kept so the shirt can be recoloured later
      mat.map = recolourTexture(mat.userData.baseMap, bodyColours(outfit));
    }
    // The FBX conversion left the clothes slightly metallic; fabric isn't.
    mat.metalness = 0;
    mat.roughness = 0.85;
    mat.needsUpdate = true;
  });
  if (garments) addGarments(rig, outfit);
}

/** The outfit with the polo (and the shirt paint under it) in another colour, e.g. a number like a quad's 0xe9c21b. */
export function withShirt(outfit, color) {
  const hex = typeof color === 'number' ? `#${color.toString(16).padStart(6, '0')}` : color;
  return { ...outfit, colors: { ...outfit.colors, shirt: hex }, ...(outfit.polo ? { polo: hex } : {}) };
}

/**
 * The body's palette for an outfit: under a crop-top her shirt band is her skin (her top half is bare). Under anything worn over
 * or in place of the polo (a plaid buttoned or open, a second polo, a shirt and tie), it is the outer top's colour: where her
 * body comes through everything (round her armpits and the backs of her arms) that top is outermost, and wherever the polo
 * shows (down an open plaid's front, at the second polo's sleeves) the polo covers her.
 */
export function bodyColours(outfit) {
  const kind = outfit.style?.kind;
  if (kind === 'cropTop') return { ...outfit.colors, shirt: 'skin' };
  if (kind === 'plaid') return { ...outfit.colors, shirt: outfit.style.plaid[0] };
  if (kind === 'doublePolo' && outfit.style.over) return { ...outfit.colors, shirt: outfit.style.over };
  if (kind === 'shirtTie') return { ...outfit.colors, shirt: outfit.style.shirt ?? '#f4f3ef' };
  return outfit.colors;
}

/** Puts her in the day's outfit (outfits.js: what she has on top), repainting the body under it and refitting. */
export function restyle(rig, outfit, style) {
  const next = { ...outfit, style };
  repaint(rig, next);
  refitOutfit(rig, next);
  return next;
}

function repaint(rig, outfit) {
  rig.model.traverse((o) => {
    const base = o.isMesh && o.material.userData.baseMap;
    if (!base) return;
    o.material.map.dispose();
    o.material.map = recolourTexture(base, bodyColours(outfit));
    o.material.needsUpdate = true;
  });
}

/** The outfit with a jumper over it (a colour), or with it taken off (null). */
export function withJumper(outfit, color) {
  const { jumper, ...rest } = outfit;
  return color ? { ...rest, jumper: color } : rest;
}

/** The outfit with a wax jacket over it (a colour), or with it taken off (null). */
export function withCoat(outfit, color) {
  const { coat, ...rest } = outfit;
  return color ? { ...rest, coat: color } : rest;
}

/**
 * Her coat's hood up over her head, or down her back (no refit: both are built with the coat, one shown). Up, her hair is
 * squashed in under it (the hair's points moved inside the hood), and let out again when it comes down.
 */
export function setHood(rig, up) {
  if (!rig.hood) return;
  rig.hood.up.visible = !!up;
  rig.hood.down.visible = !up;
  if (rig.ponytail) rig.ponytail.pivot.visible = rig.ponytail.strands.visible = !up; // tucked in under the hood
  for (const { mesh, index, loose, squashed } of rig.hood.hair) {
    const pos = mesh.geometry.attributes.position;
    const from = up ? squashed : loose;
    for (let k = 0; k < index.length; k++) pos.setXYZ(index[k], from[k * 3], from[k * 3 + 1], from[k * 3 + 2]);
    pos.needsUpdate = true;
  }
}

/** Her hair's points (any of her own meshes painted hair) and where each goes squashed inside the hood (`shape`, hood.js). */
function hairUnderHood(rig, shape) {
  const out = [];
  const meshes = [];
  rig.model.traverse((o) => {
    if (o.isSkinnedMesh && !rig.outfitParts.includes(o)) meshes.push(o);
  });
  const v = new THREE.Vector3();
  for (const mesh of meshes) {
    const data = bodyData(rig, mesh);
    const index = [];
    const loose = [];
    const squashed = [];
    data.verts.forEach((q, i) => {
      if (data.paint(i) !== 'hair') return;
      const into = intoHood(q.rest, shape);
      if (Math.hypot(into[0] - q.rest[0], into[1] - q.rest[1], into[2] - q.rest[2]) < 1e-4) return;
      index.push(i);
      loose.push(...v.fromBufferAttribute(mesh.geometry.attributes.position, i).toArray());
      squashed.push(...v.fromArray(unskin(q.skin, into)).applyMatrix4(data.fromRoot).toArray());
    });
    if (!index.length) continue;
    // Her own copy of the geometry, so squashing her hair doesn't squash the other girl's (clones share it).
    if (!mesh.userData.ownGeometry) {
      mesh.geometry = mesh.geometry.clone();
      mesh.userData.ownGeometry = true;
    }
    out.push({ mesh, index, loose, squashed });
  }
  return out;
}

/** Puts her in the same outfit with a different shirt, once the colour is known. */
export function reshirt(rig, outfit, color) {
  const next = withShirt(outfit, color);
  repaint(rig, next);
  refitOutfit(rig, next);
  return next;
}

/**
 * Her body as plain data for polo.js: each vertex's position as stored (`bind`, a T-pose turned a quarter round) and as she
 * stands (`rest`), both in root space, its normal, skin weights and `skin`, the map from one to the other. Needs her in her
 * rest pose.
 */
export function bodyData(rig, body) {
  rig.root.updateMatrixWorld(true);
  body.skeleton.update();
  const g = body.geometry;
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const si = g.attributes.skinIndex;
  const sw = g.attributes.skinWeight;
  const toRoot = rig.root.matrixWorld.clone().invert().multiply(body.matrixWorld);
  const fromRoot = toRoot.clone().invert();
  const bm = body.skeleton.boneMatrices;
  const v = new THREE.Vector3();
  const sum = new THREE.Matrix4();
  const verts = [];
  for (let i = 0; i < pos.count; i++) {
    const bind = v.fromBufferAttribute(pos, i).applyMatrix4(toRoot).toArray();
    const normal = v.fromBufferAttribute(nrm, i).transformDirection(toRoot).toArray();
    const weights = [];
    const acc = new Array(16).fill(0);
    for (let k = 0; k < 4; k++) {
      const w = sw.getComponent(i, k);
      if (!w) continue;
      const b = si.getComponent(i, k);
      weights.push([b, w]);
      for (let e = 0; e < 16; e++) acc[e] += w * bm[b * 16 + e];
    }
    const e = sum.fromArray(acc).premultiply(body.bindMatrixInverse).multiply(body.bindMatrix).premultiply(toRoot).multiply(fromRoot).elements;
    const skin = [e[0], e[4], e[8], e[12], e[1], e[5], e[9], e[13], e[2], e[6], e[10], e[14]];
    const rest = body.getVertexPosition(i, v).applyMatrix4(toRoot).toArray(); // the matrices once, not per point
    verts.push({ bind, rest, normal, weights, skin });
  }
  const bones = {};
  for (const name of Object.keys(rig.bones)) bones[name] = bonePos(rig, name).toArray();
  const pal = paletteUv(body);
  const bands = Object.entries(PALETTE);
  const paint = (i) => bands.find(([, c]) => pal?.is(i, c))?.[0] ?? 'other';
  // The top of the shorts as she stands: where the old shorts' top (1 cm above her spine bone, in the stored pose) comes to.
  const waist = (rig.bones.Spine ? bonePos(rig, 'Spine') : bonePos(rig, 'Hips')).y - 0.012;
  const split = !!g.userData.split; // already split and rounded at load (smoothBody.js)
  return { verts, index: g.index ? [...g.index.array] : [...Array(pos.count).keys()], boneNames: body.skeleton.bones.map((b) => b.name), bones, paint, waist, fromRoot, split };
}

/** The body's paint under the polo garment: shirt up to a little below the garment's neckline, skin above, so none shows. */
function poloNeckPaint(rig, body) {
  if (!rig.bones.Neck || !rig.bones.LeftArm || !rig.bones.RightArm) return null;
  const data = bodyData(rig, body);
  const { neckField } = poloFields(data);
  const neck = data.bones.Neck;
  return {
    above: (i) => neckField(data.verts[i]) + 0.006,
    near: (i) => {
      const r = data.verts[i].rest;
      return Math.hypot(r[0] - neck[0], r[2] - neck[2]) < 0.12 && r[1] > neck[1] - 0.1;
    },
  };
}

/** Stitching for the placket, drawn once: tonal thread down both long edges and a box across the bottom. */
let placketStitchMap = null;
const STITCH_BASE = 0.8; // the texture's ground (sRGB); the material colour is divided by its linear value so the fabric matches the shirt
function placketStitches() {
  if (placketStitchMap) return placketStitchMap;
  const w = 64;
  const h = 360;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const ground = Math.round(255 * STITCH_BASE);
  ctx.fillStyle = `rgb(${ground},${ground},${ground})`;
  ctx.fillRect(0, 0, w, h);
  // A little shading towards the long edges, where it turns down.
  for (const [x, a] of [[0, 0.22], [2, 0.12], [w - 2, 0.12], [w - 1, 0.22]]) {
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fillRect(x, 0, 1, h);
  }
  ctx.strokeStyle = 'rgb(250,250,250)';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([4, 2.5]);
  const edge = 7;
  ctx.beginPath();
  ctx.moveTo(edge, 0);
  ctx.lineTo(edge, h - 9);
  ctx.lineTo(w - edge, h - 9);
  ctx.lineTo(w - edge, 0);
  ctx.moveTo(edge, h - 16);
  ctx.lineTo(w - edge, h - 16);
  ctx.stroke();
  // A shadow along the bottom where it sits on the shirt.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, h - 2, w, 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  placketStitchMap = tex;
  return tex;
}

/** A skinned mesh from polo.js's arrays (bind frame, root space), bound to her skeleton like her body. */
function skinnedFromArrays(rig, body, data, name, { positions, normals, weights, colors, uvs, index }, material) {
  const P = [];
  const N = [];
  const SI = [];
  const SW = [];
  const v = new THREE.Vector3();
  positions.forEach((p, i) => {
    P.push(...v.fromArray(p).applyMatrix4(data.fromRoot).toArray());
    N.push(...v.fromArray(normals[i]).transformDirection(data.fromRoot).toArray());
    const w = weights[i];
    for (let k = 0; k < 4; k++) {
      SI.push(w[k]?.[0] ?? 0);
      SW.push(w[k]?.[1] ?? 0);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  if (colors) geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  if (uvs) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
  geo.setIndex(index);
  const mesh = new THREE.SkinnedMesh(geo, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  body.parent.add(mesh);
  mesh.position.copy(body.position);
  mesh.quaternion.copy(body.quaternion);
  mesh.scale.copy(body.scale);
  mesh.bind(body.skeleton, body.bindMatrix);
  rig.outfitParts.push(mesh);
  return mesh;
}

/**
 * A knitted top as a garment (polo.js): her torso and arms rounded and cut along smooth lines. The polo (POLO) has a round neck
 * at the base of hers, short sleeves and its hem tucked into her shorts, with a stitched placket and three buttons; the jumper
 * (JUMPER) goes over it, to her wrists and over the shorts.
 */
function addTop(rig, name, color, spec) {
  const body = bodyMesh(rig);
  const needs = ['Neck', 'Spine', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'LeftHand', 'RightHand'];
  if (!body || !needs.every((b) => rig.bones[b])) return;
  const data = bodyData(rig, body);
  const built = buildTop(data, spec);
  const { shell, shade, placket, vee } = built;
  const made = { data, built, spec };
  // The polo matches the shirt colour the body is painted under it; the jumper is its own colour, as before. A plaid's colour is
  // its check, drawn by its material, so its shading is all the vertices carry.
  const tint = new THREE.Color(spec.plaid ? '#ffffff' : color);
  const shading = [];
  for (const k of shade) shading.push(tint.r * k, tint.g * k, tint.b * k);
  const fabric = (cut = {}) =>
    spec.plaid
      ? plaidMaterial(color, data, { vertexColors: true, roughness: spec.roughness, side: THREE.DoubleSide }, cut)
      : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: spec.roughness ?? (spec === JUMPER ? 0.97 : 0.92), side: THREE.DoubleSide });
  made.fabric = fabric;
  made.tint = tint;
  made.mesh = skinnedFromArrays(
    rig,
    body,
    data,
    name,
    { positions: shell.verts.map((q) => q.bind), normals: shell.normals, weights: shell.verts.map((q) => q.weights), colors: shading, index: shell.tris.flat() },
    fabric(),
  );
  if (vee && spec.inset !== false) {
    // Her skin in the V of the open neck, her own flat faces in her skin's colour.
    const inset = buildInset(data, vee, spec);
    made.inset = inset;
    const [r, g, b] = PALETTE.skin.map((c) => c / 255);
    const skin = new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
    const shading = [];
    for (const k of inset.shade) shading.push(skin.r * k, skin.g * k, skin.b * k);
    skinnedFromArrays(
      rig,
      body,
      data,
      'poloVee',
      { positions: inset.verts.map((q) => q.bind), normals: inset.verts.map((q) => q.normal), weights: inset.verts.map((q) => q.weights), colors: shading, index: inset.tris.flat() },
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }),
    );
  }
  if (built.logo) addLogo(rig, body, data, built.logo, tint);
  if (built.pocket) {
    // A shirt's chest pocket, in the shirt's cloth, its edges and hem a shade darker.
    const pk = built.pocket;
    const shading = [];
    for (const k of pk.shade) shading.push(tint.r * k, tint.g * k, tint.b * k);
    const index = pk.tris.flat();
    const positions = pk.verts.map((q) => q.bind);
    skinnedFromArrays(rig, body, data, `${name}Pocket`, { positions, normals: smoothArrayNormals(positions, index), weights: pk.verts.map((q) => q.weights), colors: shading, index }, fabric());
  }
  if (!placket) return made;

  // The placket, stitched, and its buttons (a second mesh, the holes coloured in).
  const index = placket.tris.flat();
  skinnedFromArrays(
    rig,
    body,
    data,
    `${name}Placket`,
    { positions: placket.verts.map((q) => q.bind), normals: smoothArrayNormals(placket.verts.map((q) => q.bind), index), weights: placket.verts.map((q) => q.weights), uvs: placket.uv, index },
    spec.plaid
      ? plaidMaterial(color, data, { roughness: spec.roughness, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ color: tint.clone().multiplyScalar((spec.placketShade ?? 1) / new THREE.Color().setRGB(STITCH_BASE, 0, 0, THREE.SRGBColorSpace).r), map: placketStitches(), roughness: spec.roughness ?? 0.9, side: THREE.DoubleSide }),
  );
  const positions = [];
  const weights = [];
  const colors = [];
  const tris = [];
  // A shade darker than the shirt, as a polo's are; a coat's studs are brass.
  const face = spec.buttonColour ? new THREE.Color(spec.buttonColour) : tint.clone().multiplyScalar(spec.buttonShade);
  const hole = tint.clone().multiplyScalar(0.35);
  // Each point laid on the cloth under it, with its skin (polo.js, layOnCloth).
  const add = (lay, points, triangles, c) => {
    const base = positions.length;
    for (const q of lay(points)) {
      positions.push(q.bind);
      weights.push(q.weights);
      colors.push(c.r, c.g, c.b);
    }
    for (const t of triangles) tris.push(...t.map((i) => i + base));
  };
  for (const b of [...placket.buttons, ...built.cuffButtons]) {
    const { shape, lay } = layOnCloth(b, (centre, normal) => buttonShape(centre, normal, spec.buttonRadius));
    add(lay, shape.points, shape.tris, face);
    if (spec.buttonHoles !== false) add(lay, shape.holes, shape.holeTris, hole);
  }
  for (const h of spec.slits === false ? [] : placket.slits) {
    const { shape, lay } = layOnCloth(h, slitShape);
    add(lay, shape.points, shape.tris, hole);
  }
  skinnedFromArrays(
    rig,
    body,
    data,
    `${name}Buttons`,
    { positions, normals: smoothArrayNormals(positions, tris), weights, colors, index: tris },
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: spec.buttonMetal ?? (spec.buttonColour ? 0.6 : 0), side: THREE.DoubleSide }),
  );
  return made;
}

/**
 * The polo's logo: a leaping hare, embroidered (drawn here: the farm's own brand, not anyone's real one), in a coloured thread
 * that stands out from the shirt (polo.js, logoThread).
 */
let logoMap = null;
function hareLogo() {
  if (logoMap) return logoMap;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  const ellipse = (x, y, rx, ry, rot = 0) => {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    ctx.fill();
  };
  const limb = (x0, y0, x1, y1, w) => {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };
  ellipse(62, 52, 27, 12, -0.18); // body, stretched out mid-leap
  ellipse(40, 56, 14, 13); // haunch
  ellipse(26, 47, 5, 5); // tail
  ellipse(92, 39, 11, 8, -0.3); // head
  ellipse(97, 19, 4, 14, 0.45); // ears, laid back
  ellipse(89, 21, 3.5, 13, 0.3);
  limb(96, 52, 118, 64, 5); // front legs reaching
  limb(90, 55, 112, 70, 4);
  limb(34, 64, 8, 74, 6); // hind leg kicking off
  ctx.globalCompositeOperation = 'destination-out';
  ellipse(96, 37, 1.8, 1.8); // the eye, left as shirt
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  logoMap = tex;
  return tex;
}

function addLogo(rig, body, data, logo, tint) {
  const shirt = tint.clone().convertLinearToSRGB();
  const thread = new THREE.Color(logoThread([shirt.r, shirt.g, shirt.b]));
  const index = logo.tris.flat();
  const positions = logo.verts.map((q) => q.bind);
  skinnedFromArrays(
    rig,
    body,
    data,
    'poloLogo',
    { positions, normals: smoothArrayNormals(positions, index), weights: logo.verts.map((q) => q.weights), uvs: logo.uv, index },
    new THREE.MeshStandardMaterial({ color: thread, map: hareLogo(), alphaTest: 0.5, roughness: 0.75, side: THREE.DoubleSide }),
  );
}

/**
 * A collar (collar.js) on a top's neck edge, lying over `over` (whatever is outside the top there, and any collar under it).
 * Returns what it built, for a collar over it to lie on.
 */
function addCollar(rig, top, over, color, collarSpec = COLLAR, name = 'poloCollar') {
  const body = bodyMesh(rig);
  const { data, built, spec } = top;
  const collar = buildCollar(built.shell, data, { vee: built.vee, placketWidth: spec.placketWidth, over }, collarSpec);
  if (!collar) return null;
  const tint = spec.plaid ? new THREE.Color('#ffffff') : new THREE.Color(color);
  const colors = [];
  for (const k of collar.shade) colors.push(tint.r * k, tint.g * k, tint.b * k);
  skinnedFromArrays(
    rig,
    body,
    data,
    name,
    { positions: collar.verts.map((q) => q.bind), normals: smoothNormals(collar), weights: collar.verts.map((q) => q.weights), colors, uvs: collar.uv, index: collar.tris.flat() },
    top.fabric ? top.fabric({ along: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: THREE.DoubleSide }),
  );
  return collar;
}

/**
 * A plaid flannel's check, drawn on the cloth from the stored (bind) shape the garment is skinned from: in that pose her arms are
 * straight out, so each of three flat projections, blended by which way the cloth faces, runs the check straight across her
 * body and along and round her arms. `colours`: [ground, check, line]. Vertex colours (if any) shade it. `along`: a piece cut
 * on its own (a collar), its check drawn from its uv (in metres) instead, so it runs along the piece.
 */
function plaidMaterial(colours, data, options = {}, { along = false } = {}) {
  const mat = new THREE.MeshStandardMaterial(options);
  const [ground, check, line] = colours.map((c) => new THREE.Color(c));
  // About 9 cm a repeat, in the mesh's own units.
  const perUnit = 11 / new THREE.Vector3().setFromMatrixScale(data.fromRoot).x;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { plaidGround: { value: ground }, plaidCheck: { value: check }, plaidLine: { value: line }, plaidScale: { value: perUnit }, plaidAlong: { value: 11 } });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPlaidPos;\nvarying vec3 vPlaidNormal;\nvarying vec2 vPlaidUv;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvPlaidPos = position;\nvPlaidNormal = normal;\nvPlaidUv = ${along ? 'uv' : 'vec2(0.0)'};`);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vPlaidPos;
varying vec3 vPlaidNormal;
varying vec2 vPlaidUv;
uniform vec3 plaidGround;
uniform vec3 plaidCheck;
uniform vec3 plaidLine;
uniform float plaidScale;
uniform float plaidAlong;
vec3 plaidAt(vec2 q) {
  vec2 f = fract(q);
  float bx = step(f.x, 0.42);
  float by = step(f.y, 0.42);
  vec3 c = mix(plaidGround, plaidCheck, 0.5 * (bx + by));
  float l = max(step(abs(f.x - 0.71), 0.022), step(abs(f.y - 0.71), 0.022));
  return mix(c, plaidLine, 0.8 * l);
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
${
  along
    ? 'diffuseColor.rgb *= plaidAt(vPlaidUv * plaidAlong);'
    : `vec3 w = pow(abs(normalize(vPlaidNormal)), vec3(4.0));
  w /= (w.x + w.y + w.z);
  vec3 p = vPlaidPos * plaidScale;
  diffuseColor.rgb *= plaidAt(p.yz) * w.x + plaidAt(p.xz) * w.y + plaidAt(p.xy) * w.z;`
}
}`,
      );
  };
  mat.customProgramCacheKey = () => (along ? 'plaidAlong' : 'plaid');
  return mat;
}

/** Jess's string crop-top (crop.js), on her bare top half. */
function addCrop(rig, color) {
  const body = bodyMesh(rig);
  if (!body || !rig.bones.Neck) return;
  const data = bodyData(rig, body);
  const built = buildCropTop(data);
  if (!built) return;
  const tint = new THREE.Color(color);
  const colors = [];
  for (const k of built.shade) colors.push(tint.r * k, tint.g * k, tint.b * k);
  skinnedFromArrays(
    rig,
    body,
    data,
    'cropTop',
    { positions: built.shell.verts.map((q) => q.bind), normals: built.shell.normals, weights: built.shell.verts.map((q) => q.weights), colors, index: built.shell.tris.flat() },
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }),
  );
  const g = built.groove;
  if (g) {
    // Her cleavage, drawn on in her skin's colour as the open polo's is.
    const [r, gr, b] = PALETTE.skin.map((c) => c / 255);
    const skin = new THREE.Color().setRGB(r, gr, b, THREE.SRGBColorSpace);
    const shading = [];
    for (const k of g.shade) shading.push(skin.r * k, skin.g * k, skin.b * k);
    skinnedFromArrays(
      rig,
      body,
      data,
      'cropGroove',
      { positions: g.verts.map((q) => q.bind), normals: g.verts.map((q) => q.normal), weights: g.verts.map((q) => q.weights), colors: shading, index: g.tris.flat() },
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }),
    );
  }
}

/**
 * The wax jacket (COAT) over everything else on top, its corduroy collar on its neck edge, and its hood: one up over her head
 * (on her head bone, as her helmet is) and one pushed back down her back (on her chest bone), only one of them shown (setHood).
 */
function addCoat(rig, color) {
  const coat = addTop(rig, 'coat', color, COAT);
  if (!coat) return;
  const body = bodyMesh(rig);
  const { data, built } = coat;
  const collar = buildCollar(built.shell, data, { vee: built.vee, placketWidth: COAT.placketWidth, over: [built.shell] }, COAT_COLLAR);
  if (collar) {
    const cord = new THREE.Color(COAT_COLLAR_COLOUR);
    const colors = [];
    for (const k of collar.shade) colors.push(cord.r * k, cord.g * k, cord.b * k);
    skinnedFromArrays(
      rig,
      body,
      data,
      'coatCollar',
      { positions: collar.verts.map((q) => q.bind), normals: smoothNormals(collar), weights: collar.verts.map((q) => q.weights), colors, index: collar.tris.flat() },
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
    );
  }
  addHood(rig, data, built.shell, new THREE.Color(color));
}

function addHood(rig, data, shell, tint) {
  const head = measureHead(rig);
  const neck = data.bones.Neck;
  const body = bodyMesh(rig);
  // A point of her body her head carries (near enough) alone, and one her chest does: the hood is skinned between the two.
  const anchor = (name) => {
    let best = null;
    let most = 0;
    for (const v of data.verts) {
      const w = v.weights.reduce((s, [b, k]) => s + (data.boneNames[b] === name ? k : 0), 0);
      if (w > most) [best, most] = [v, w];
    }
    return best;
  };
  const headAt = anchor('Head');
  const chestAt = anchor('Spine2') ?? anchor('Spine1');
  if (!head || !headAt || !chestAt) return;
  // The coat's neck edge round the back and sides: how high it is and how far out from the middle of her neck.
  const edge = shell.verts.filter((v) => v.edge === 'neck' && !v.apart && v.rest[2] < neck[2] + 0.02);
  if (edge.length < 4) return;
  const y = edge.reduce((s, v) => s + v.rest[1], 0) / edge.length;
  const radius = edge.reduce((s, v) => s + Math.hypot(v.rest[0] - neck[0], v.rest[2] - neck[2]), 0) / edge.length;
  // Up, it comes down over the collar on to her shoulders, just beyond the collar's fall, so it plainly joins the coat.
  const up = buildHood(head, { y: y - 0.01, radius: radius + COAT_COLLAR.out + 0.008, x: neck[0], z: neck[2] });
  // The coat's back down her middle, 1 cm at a time, for the hood lying on it.
  const back = new Map();
  for (const v of shell.verts) {
    if (v.apart || Math.abs(v.rest[0] - neck[0]) > 0.07 || v.rest[2] > neck[2]) continue;
    const k = Math.round(v.rest[1] * 100);
    back.set(k, Math.min(back.get(k) ?? Infinity, v.rest[2]));
  }
  const backAt = (yy) => {
    const k = Math.round(yy * 100);
    for (let d = 0; d < 6; d++) for (const j of [k - d, k + d]) if (back.has(j)) return back.get(j);
    return neck[2] - radius;
  };
  // Pushed back, it's the hood as it would be gathered inside the collar (the wide bottom of the one up would stand up behind
  // her head once turned over), lying on her back.
  const collarTop = y + COAT_COLLAR.stand * 0.6;
  const gathered = buildHood(head, { y: collarTop, radius: radius - COAT_COLLAR.lean - 0.012, x: neck[0], z: neck[2] });
  const down = lowerHood(gathered, [neck[0], collarTop, neck[2] - radius], backAt);
  const edgeTint = tint.clone().multiplyScalar(0.7);
  const mesh = (hood, name, share) => {
    const positions = [];
    const weights = [];
    const colors = [];
    hood.points.forEach((pt, i) => {
      const k = share(pt);
      const skin = vec.lerp(headAt.skin, chestAt.skin, k);
      positions.push(unskin(skin, pt));
      weights.push(blendWeights(headAt.weights, chestAt.weights, k));
      const c = hood.kind[i] === 'wax' ? tint : hood.kind[i] === 'edge' ? edgeTint : null;
      colors.push(...(c ? [c.r, c.g, c.b] : tartan(hood.uv[i])));
    });
    const index = hood.tris.flat();
    return skinnedFromArrays(
      rig,
      body,
      data,
      name,
      { positions, normals: smoothArrayNormals(positions, index), weights, colors, index },
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: COAT.roughness, side: THREE.DoubleSide }),
    );
  };
  rig.hood = {
    up: mesh(up, 'hoodUp', (pt) => chestShare(pt[1], up.shape)),
    down: mesh(down, 'hoodDown', () => 1),
    hair: hairUnderHood(rig, up.shape),
  };
  setHood(rig, rig.hoodIsUp);
}

/** Her hair as it was before it was tied back (each mesh's own copy of its points), put back for a refit. */
function letHairDown(rig) {
  for (const { mesh, loose } of rig.hairTied ?? []) {
    mesh.geometry.attributes.position.array.set(loose);
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  }
  rig.hairTied = null;
  rig.ponytail = null;
}

/**
 * A ponytail (ponytail.js): her hair pulled in tight to her head and up off the back of her neck, then a band and a tail on her head
 * bone, hanging down her back from a pivot the rig turns each frame (PonytailSwing), and a few loose strands at her temples and nape.
 * In the rest pose, with the posed body for rays.
 */
function addPonytail(rig, style) {
  const body = bodyMesh(rig);
  const b = rig.bones;
  const head = measureHead(rig);
  if (!body || !head || !b.Head || !b.Neck || !b.Spine2 || !b.LeftToeBase || !b.RightToeBase) return;
  const root = rig.root;
  const data = bodyData(rig, body);
  const Hb = bonePos(rig, 'Head');
  const up = new THREE.Vector3(0, 1, 0);
  // Her frame from her feet: forward is where her toes point.
  const forward = bonePos(rig, 'LeftToeBase').add(bonePos(rig, 'RightToeBase')).sub(bonePos(rig, 'LeftFoot')).sub(bonePos(rig, 'RightFoot'));
  forward.y = 0;
  forward.normalize();
  const back = forward.clone().negate();
  const right = forward.clone().cross(up).normalize();
  const k = (head.top - Hb.y) / 0.22; // her head against the one this was measured on
  const C = Hb.clone().addScaledVector(up, 0.07 * k); // the middle of her skull
  // How far from C her scalp is that way (her skin, not her hair), in root space, or null where there's none (the top of her head).
  const toWorld = (pt) => root.localToWorld(pt.clone());
  const cWorld = toWorld(C);
  const scalp = (dir) => {
    const end = toWorld(C.clone().addScaledVector(dir, 0.3));
    raycaster.set(cWorld, end.clone().sub(cWorld).normalize());
    raycaster.far = cWorld.distanceTo(end);
    for (const h of raycaster.intersectObject(castAt(rig, body), false)) {
      if (data.paint(h.face.a) === 'hair') continue;
      return root.worldToLocal(h.point.clone()).distanceTo(C);
    }
    return null;
  };
  const margin = 0.005 * k;
  // Below these heights her hair is lifted: the nape at the back, over her ears at the side, the hairline at the front.
  const floorAt = (dir) => {
    const h = dir.clone().addScaledVector(up, -dir.dot(up));
    const front = h.lengthSq() > 1e-8 ? h.normalize().dot(forward) : 0;
    // Over and behind her ears the line rises quickly from the nape, so her ears show.
    const lift = front < -0.4 ? THREE.MathUtils.lerp(0.045, -0.02, (-front - 0.4) / 0.6) : front < 0 ? THREE.MathUtils.lerp(0.1, 0.045, -front / 0.4) : THREE.MathUtils.lerp(0.1, 0.15, front);
    return Hb.y + lift * k;
  };

  // Her hair pulled in, in each of her meshes painted hair (her own copy of the geometry: the girls' clones share it).
  const tied = [];
  const meshes = [];
  rig.model.traverse((o) => {
    if (o.isSkinnedMesh && !rig.outfitParts.includes(o)) meshes.push(o);
  });
  const p = new THREE.Vector3();
  for (const mesh of meshes) {
    const md = mesh === body ? data : bodyData(rig, mesh);
    const moves = [];
    md.verts.forEach((q, i) => {
      if (md.paint(i) !== 'hair') return;
      p.fromArray(q.rest);
      const dir = p.clone().sub(C).normalize();
      p.y = Math.max(p.y, floorAt(dir));
      dir.copy(p).sub(C).normalize();
      const s = scalp(dir);
      if (s != null) p.copy(C).addScaledVector(dir, s + margin);
      moves.push([i, unskin(q.skin, p.toArray())]);
    });
    if (!moves.length) continue;
    if (!mesh.userData.ownGeometry) {
      mesh.geometry = mesh.geometry.clone();
      mesh.userData.ownGeometry = true;
    }
    const attr = mesh.geometry.attributes.position;
    tied.push({ mesh, loose: attr.array.slice() });
    for (const [i, at] of moves) p.fromArray(at).applyMatrix4(md.fromRoot).toArray(attr.array, i * 3);
    attr.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  }
  rig.hairTied = tied;

  // Her hair's colour: the body's own texture at one of her hair's points, so it matches whatever colour hers is.
  const hairAt = data.verts.findIndex((_, i) => data.paint(i) === 'hair');
  const uv = body.geometry.attributes.uv;
  const hairUv = hairAt >= 0 ? [uv.getX(hairAt), uv.getY(hairAt)] : [0, 0];
  const hairMat = new THREE.MeshStandardMaterial({ map: body.material.map, vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  const geometryOf = (part) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(part.points.flat(), 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(part.shade.flatMap((s) => [s, s, s]), 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(part.points.flatMap(() => hairUv), 2));
    geo.setIndex(part.tris.flat());
    geo.computeVertexNormals();
    return geo;
  };

  // The band: high at the back of her crown.
  const bandAt = (el, out) => {
    const dir = back.clone().multiplyScalar(Math.cos(el)).addScaledVector(up, Math.sin(el));
    const s = scalp(dir);
    return C.clone().addScaledVector(dir, (s != null ? s + margin : 0.145 * k) + out * k);
  };
  const band = bandAt(0.62, 0.004);
  // Under a helmet: just below its rim at the back.
  const rimY = head.top - RIM_BELOW_CROWN - 0.04 * k;
  const low = bandAt(Math.asin(THREE.MathUtils.clamp((rimY - C.y) / (0.11 * k), -0.9, 0.9)), 0.003);
  // Her back as the tail falls down it: how far back of the band her body is, `d` below it, down her middle.
  const backAt = (d) => {
    const at = band.clone().addScaledVector(up, -d);
    const from = toWorld(at.clone().addScaledVector(back, 0.3));
    const to = toWorld(at.clone().addScaledVector(back, -0.15));
    raycaster.set(from, to.clone().sub(from).normalize());
    raycaster.far = from.distanceTo(to);
    for (const h of raycaster.intersectObject(castAt(rig, body), false)) {
      if (data.paint(h.face.a) === 'hair') continue;
      return root.worldToLocal(h.point.clone()).sub(band).dot(back);
    }
    return null;
  };
  // Long enough to fall between her shoulder blades.
  const blades = data.bones.Spine2[1] + 0.25 * (data.bones.Neck[1] - data.bones.Spine2[1]);
  const tail = buildTail(band.y - blades, backAt);
  const pivot = new THREE.Group();
  pivot.name = 'ponytail';
  pivot.position.copy(band);
  pivot.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, back));
  const hair = new THREE.Mesh(geometryOf(tail.hair), hairMat);
  hair.castShadow = true;
  const elastic = new THREE.Mesh(geometryOf(tail.band), new THREE.MeshStandardMaterial({ color: style.band ?? '#151515', vertexColors: true, roughness: 0.6 }));
  pivot.add(hair, elastic);
  root.add(pivot);
  b.Head.attach(pivot);
  rig.outfitParts.push(pivot);
  const lowLocal = b.Head.worldToLocal(toWorld(low));

  // A few loose strands: one at each temple falling beside her face, and two short wisps at her nape. Each kept off her skin.
  const off = (pt, clear) => {
    const at = new THREE.Vector3().fromArray(pt);
    const dir = at.clone().sub(C).normalize();
    const s = scalp(dir);
    const need = s == null ? 0 : s + clear - at.distanceTo(C);
    return need > 0 ? dir.multiplyScalar(need).toArray() : [0, 0, 0];
  };
  const down = up.clone().negate().toArray();
  const pieces = [];
  for (const side of [1, -1]) {
    const dir = forward.clone().multiplyScalar(0.55).addScaledVector(right, side * 0.83).addScaledVector(up, 0.42).normalize();
    const rootPt = C.clone().addScaledVector(dir, (scalp(dir) ?? 0.1 * k) + margin + 0.002);
    pieces.push(strand(rootPt.toArray(), down, forward.clone().multiplyScalar(0.4).addScaledVector(right, side * 0.15).toArray(), 0.075 * k, { out: (pt) => off(pt, 0.004 * k) }));
  }
  for (const side of [1, -1]) {
    const at = C.clone().addScaledVector(right, side * 0.018 * k);
    at.y = floorAt(back);
    const dir = at.clone().sub(C).normalize();
    const rootPt = C.clone().addScaledVector(dir, (scalp(dir) ?? 0.09 * k) + margin);
    pieces.push(strand(rootPt.toArray(), down, right.clone().multiplyScalar(side * 0.3).addScaledVector(back, 0.2).toArray(), 0.035 * k, { r0: 0.0016, out: (pt) => off(pt, 0.003 * k) }));
  }
  const strands = new THREE.Mesh(geometryOf(merge(pieces)), hairMat);
  strands.name = 'ponytailStrands';
  attachToBone(rig, strands, 'Head');

  rig.ponytail = { pivot, strands, swing: new PonytailSwing(pivot, { low: lowLocal, chest: b.Spine2, params: rig.ponytailParams }) };
  rig.ponytail.swing.underHelmet = !!rig.underHelmet;
}

/** The shorts as a garment (shorts.js), with the polo tucked into them. */
function addBottom(rig, color, coat = false) {
  const body = bodyMesh(rig);
  if (!body || !['Spine', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg'].every((b) => rig.bones[b])) return;
  const data = bodyData(rig, body);
  // Under a coat the seat hangs no further off her than the coat does, or it shows through below the coat's back.
  const { shell, shade } = buildShorts(data, coat ? { ...SHORTS, seatMax: 0.018 } : SHORTS);
  const tint = new THREE.Color(color);
  const colors = [];
  for (const k of shade) colors.push(tint.r * k, tint.g * k, tint.b * k);
  skinnedFromArrays(
    rig,
    body,
    data,
    'shorts',
    { positions: shell.verts.map((q) => q.bind), normals: shell.normals, weights: shell.verts.map((q) => q.weights), colors, index: shell.tris.flat() },
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, side: THREE.DoubleSide }),
  );
}

/** Per-vertex normals for plain arrays (each vertex the sum of its faces). */
function smoothArrayNormals(positions, index) {
  const sums = positions.map(() => new THREE.Vector3());
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let t = 0; t < index.length; t += 3) {
    a.fromArray(positions[index[t]]);
    b.fromArray(positions[index[t + 1]]);
    c.fromArray(positions[index[t + 2]]);
    const n = b.clone().sub(a).cross(c.clone().sub(a));
    for (let k = 0; k < 3; k++) sums[index[t + k]].add(n);
  }
  return sums.map((s) => s.normalize().toArray());
}

function addGarments(rig, outfit) {
  withPosedBody(rig, () => addEachGarment(rig, outfit));
}

function addEachGarment(rig, outfit) {
  // The day's outfit (outfits.js): her polo; a plaid shirt buttoned or open over it; a second polo over hers; or a crop-top. Then
  // the jumper over whatever she has on, then the collars from the inside out, each lying over everything outside its top and the
  // collar under it; under a buttoned plaid, her polo's collar is worn out over the plaid's instead.
  const style = outfit.style ?? {};
  const kind = style.kind ?? 'polo';
  const open = outfit.poloOpen ?? 0;
  // Under a jumper an open collar keeps its done-up points: longer, they crumpled over the jumper's ribbed neck.
  const pop = (spec) => ({ ...spec, ...(style.popped ? { popped: true } : {}), ...(outfit.jumper ? { openPoints: null } : {}) });
  let polo = null;
  let outer = null;
  const shirtTie = kind === 'shirtTie';
  if (style.ponytail) addPonytail(rig, style); // first: the hood squashes her hair as the ponytail leaves it
  if (kind === 'cropTop') addCrop(rig, style.crop);
  else if (outfit.polo && (!shirtTie || style.shirtOverPolo)) polo = addTop(rig, 'polo', outfit.polo, { ...POLO, open: kind === 'doublePolo' ? style.underOpen ?? 0 : shirtTie ? 0 : open }); // done up under a shirt and tie, so its placket and collar show in the shirt's open neck
  if (kind === 'doublePolo') outer = addTop(rig, 'overPolo', style.over, { ...OVER_POLO, open });
  const shut = { ...(polo ? PLAID_OVER : PLAID), open: shirtButtonsUndone(style) };
  if (kind === 'plaid') outer = addTop(rig, 'plaid', style.plaid, style.plaidOpen ? PLAID_OPEN : shut);
  if (shirtTie) {
    // Done right up (cuffs at the wrist), or loosened: the top one or two undone and the sleeves rolled to the elbow.
    const spec = style.tieLoose ? (polo ? SHIRT_ROLLED_OVER : SHIRT_ROLLED) : polo ? SHIRT_OVER : SHIRT;
    outer = addTop(rig, 'shirt', style.shirt ?? '#f4f3ef', { ...spec, open: shirtButtonsUndone(style) });
  }
  if (polo && outer) tuckUnder(polo, outer);
  const jumper = outfit.jumper ? addTop(rig, 'jumper', outfit.jumper, JUMPER) : null;
  // A collar lies on its own top and on the jumper over everything (its neck is low enough for collars to come out over it), never
  // on a shirt worn over its top: under that it's hidden but for where it shows at the neck and down the front.
  const knit = jumper ? [jumper.built.shell] : [];
  if (shirtTie && outer) {
    // The polo's collar lies close on the polo, under the shirt; the tie goes on the shirt (and in an open neck on what shows in
    // it); then the shirt's collar over the tie, so its points cover the knot's sides.
    const under = polo ? addCollar(rig, polo, [polo.built.shell], outfit.polo, POLO_UNDER_SHIRT_COLLAR) : null;
    const tie = addTie(rig, outer, polo, under, outfit.polo ?? outfit.colors?.shirt ?? '#3a5690', style);
    // On the polo's collar too, so where the polo's comes up under the shirt's neck at the back, the shirt's lies over it.
    addCollar(rig, outer, [outer.built.shell, ...(tie ? [tie] : []), ...(under ? [under] : []), ...knit], style.shirt, pop(POINT_COLLAR), 'shirtCollar');
  } else if (kind === 'plaid' && polo) {
    // Over her polo, buttoned or open: the plaid's collar first, a lower stand on its lower neck, then hers folded out over it and
    // the shirt (under an open plaid's, hers was hidden by its fronts and came through it in places). Popped, only hers stands up:
    // the plaid's popped too came up round the outside of hers and hid it.
    const shirt = addCollar(rig, outer, [outer.built.shell, ...knit], style.over, SHIRT_UNDER_COLLAR, 'plaidCollar');
    addCollar(rig, polo, [polo.built.shell, outer.built.shell, ...knit, ...(shirt ? [shirt] : [])], outfit.polo, pop({ ...COLLAR, clear: 0.005 })); // a little further off, over the plaid's collar's fold
  } else {
    // Under a second polo hers keeps its done-up points, and stands lower at the front: open, its longer points and the ends of its
    // stand came up through the ends of the second polo's collar.
    const mine = kind === 'doublePolo' ? { ...COLLAR, openPoints: null, standFront: 0.006 } : COLLAR;
    const under = polo ? addCollar(rig, polo, [polo.built.shell, ...knit], outfit.polo, pop(mine)) : null;
    if (outer) addCollar(rig, outer, [outer.built.shell, ...knit, ...(under ? [under] : [])], style.over, pop(kind === 'plaid' ? SHIRT_COLLAR : { ...OVER_COLLAR, clear: 0.005 }), `${kind}Collar`);
  }
  if (outfit.coat) addCoat(rig, outfit.coat);
  if (outfit.shorts) addBottom(rig, outfit.shorts, !!outfit.coat);
  if (outfit.wellies) addWellies(rig, outfit.wellies);
}

/**
 * The tie (tie.js) on a shirt, in her polo's colour: laid on the shirt and its placket, and in a loosened shirt's open neck on her
 * skin there or on the polo, its placket and its collar. Returns what it built, for the shirt's collar to lie on.
 */
function addTie(rig, shirt, polo, poloCollar, color, style) {
  const body = bodyMesh(rig);
  const { data, built } = shirt;
  if (!built.placket) return null;
  const ground = [built.shell, built.placket];
  if (shirt.inset) ground.push(shirt.inset);
  if (polo) ground.push(polo.built.shell, ...(polo.built.placket ? [polo.built.placket] : []), ...(poloCollar ? [poloCollar] : []));
  const tie = buildTie(data, { top: built.placket.top, ground, loose: !!style.tieLoose, drop: style.tieDrop ?? 0.025, vee: built.vee, placketWidth: shirt.spec.placketWidth, buttons: built.placket.buttons });
  if (!tie) return null;
  const tint = new THREE.Color(color);
  const colors = [];
  for (const k of tie.shade) colors.push(tint.r * k, tint.g * k, tint.b * k);
  skinnedFromArrays(
    rig,
    body,
    data,
    'tie',
    { positions: tie.verts.map((q) => q.bind), normals: smoothNormals(tie), weights: tie.verts.map((q) => q.weights), colors, index: tie.tris.flat() },
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }), // woven silk has a little sheen
  );
  return tie;
}

/** Her polo's sleeves pulled back inside the top over it (polo.js, tuckSleeves), and its mesh moved to match. */
function tuckUnder(polo, outer) {
  if (!polo.mesh || !tuckSleeves(polo.built.shell, outer.built.shell, polo.data)) return;
  const attr = polo.mesh.geometry.attributes.position;
  const v = new THREE.Vector3();
  polo.built.shell.verts.forEach((q, i) => v.fromArray(q.bind).applyMatrix4(polo.data.fromRoot).toArray(attr.array, i * 3));
  attr.needsUpdate = true;
  polo.mesh.geometry.computeBoundingSphere();
}

/**
 * Rebuilds the fitted garments after the body has changed shape. They're
 * fitted in the rest pose, whatever she's doing at the moment.
 */
export function refitOutfit(rig, outfit) {
  for (const part of rig.outfitParts ?? []) {
    part.removeFromParent();
    part.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
  }
  if (rig.hood) setHood(rig, false); // her hair let out before anything is measured again
  letHairDown(rig);
  rig.outfitParts = [];
  rig.hood = null;
  rig.withRestPose(() => {
    addGarments(rig, outfit);
    rig.onDressed?.(); // mud and dust on what she has on (effects/girlMud.js), while the clothes are at rest
  });
}
