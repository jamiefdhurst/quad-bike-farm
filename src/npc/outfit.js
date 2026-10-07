import * as THREE from 'three';

// Outfits for the companion. The Quaternius model is textured from a tiny
// palette (one flat colour per band), so recolouring clothes is a matter of
// swapping palette entries. Extra garment parts (a collar, boot shafts) are
// small meshes attached to bones so they follow the animations.

// Palette colours in the source texture.
const PALETTE = {
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
    // Bare legs: the jeans band becomes skin, and shorts go on as a garment.
    colors: { shirt: '#3a5690', shoes: '#2f4a2c', trousers: 'skin' },
    collar: '#3a5690',
    wellies: '#2f4a2c',
    shorts: '#56739f',
  },
  // Jess: black hair, a burgundy polo, black wellies and darker shorts.
  jessPolo: {
    colors: { hair: '#2a221d', shirt: '#8e2238', shoes: '#262626', trousers: 'skin' },
    collar: '#8e2238',
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
  // A colour is a hex, or the name of another palette band (e.g. 'skin' for bare legs).
  const swaps = Object.entries(colors).map(([band, hex]) => {
    if (PALETTE[hex]) return { from: PALETTE[band], to: PALETTE[hex] };
    const c = new THREE.Color(hex);
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
function bodyMesh(rig) {
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
  const hits = raycaster.intersectObject(mesh, false);
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

/**
 * A garment made from part of her own body mesh: the triangles `wear` picks,
 * pushed out along the surface by `offset` metres, and skinned to the same
 * skeleton, so it bends exactly as she does (walking, sitting, her figure).
 * `wear(p, bone, i)` and `offset(p, bone)` get root-space rest-pose positions; `bone`
 * is the name of the bone the vertex follows most and `i` its index in the body mesh.
 */
function skinnedGarment(rig, name, color, wear, offset, { smooth = false, soft = false, shape = null, shade = null } = {}) {
  const body = bodyMesh(rig);
  if (!body) return null;
  const g = body.geometry;
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const si = g.attributes.skinIndex;
  const sw = g.attributes.skinWeight;
  const boneNames = body.skeleton.bones.map((b) => b.name);
  const root = rig.root;
  const toRoot = (v) => root.worldToLocal(body.localToWorld(v.clone()));
  const fromRoot = (v) => body.worldToLocal(root.localToWorld(v.clone()));
  // Mesh units per metre of root space, for the offset.
  const unit = 1 / toRoot(new THREE.Vector3(1, 0, 0)).sub(toRoot(new THREE.Vector3())).length();
  const n = pos.count;
  const rootPos = [];
  const keep = [];
  const boneOf = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const p = toRoot(v.fromBufferAttribute(pos, i));
    rootPos.push(p);
    let best = 0;
    for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k;
    boneOf.push(boneNames[si.getComponent(i, best)] ?? '');
    keep.push(wear(p, boneOf[i], i));
  }
  // The body is flat shaded, so the vertices on a corner each carry their own face's normal. A big offset along those pulls
  // the faces apart into cracks; `smooth` pushes every vertex at the same spot along their average instead.
  const pushDir = [];
  const key = (i) => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
  if (smooth || soft) {
    const sums = new Map();
    for (let i = 0; i < n; i++) {
      const k = key(i);
      const sum = sums.get(k) ?? new THREE.Vector3();
      sum.add(v.fromBufferAttribute(nrm, i));
      sums.set(k, sum);
    }
    for (let i = 0; i < n; i++) pushDir.push(sums.get(key(i)).clone().normalize());
  }
  const index = g.index ? g.index.array : [...Array(n).keys()];
  const tris = [];
  for (let t = 0; t < index.length; t += 3) {
    const [a, b, c] = [index[t], index[t + 1], index[t + 2]];
    if (keep[a] && keep[b] && keep[c]) tris.push(a, b, c);
  }
  if (!tris.length) return null;
  // Compact the vertices used, pushed out along their normals. A `soft` garment welds the corners that share a spot into one
  // vertex, so it's one smooth shell shaded softly rather than a set of facets; `shape` then moves each vertex in root space
  // (to drape it) and `shade` darkens or lightens it (ribbing).
  const remap = new Map();
  const P = [];
  const N = [];
  const C = [];
  const SI = [];
  const SW = [];
  const out = [];
  const tint = new THREE.Color(color);
  for (const i of tris) {
    const id = soft ? key(i) : i;
    if (!remap.has(id)) {
      remap.set(id, P.length / 3);
      const d = offset(rootPos[i], boneOf[i]) * unit;
      const push = smooth || soft ? pushDir[i] : { x: nrm.getX(i), y: nrm.getY(i), z: nrm.getZ(i) };
      let q = new THREE.Vector3(pos.getX(i) + push.x * d, pos.getY(i) + push.y * d, pos.getZ(i) + push.z * d);
      if (shape) q = fromRoot(shape(toRoot(q), rootPos[i], boneOf[i]));
      P.push(q.x, q.y, q.z);
      N.push(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
      if (shade) {
        const k = shade(rootPos[i], boneOf[i]);
        C.push(tint.r * k, tint.g * k, tint.b * k);
      }
      for (let k = 0; k < 4; k++) {
        SI.push(si.getComponent(i, k));
        SW.push(sw.getComponent(i, k));
      }
    }
    out.push(remap.get(id));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  if (shade) geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
  geo.setIndex(out);
  if (soft) geo.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color: shade ? 0xffffff : color, vertexColors: !!shade, roughness: soft ? 0.97 : 0.88, side: THREE.DoubleSide, flatShading: !soft });
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

const isArm = (bone) => /Arm|Hand|Shoulder/.test(bone);
const smooth01 = (t) => {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
};

/**
 * Which of the body mesh's vertices are shirt, read from its (recoloured) texture,
 * with their root-space rest-pose positions. `hex` is the shirt colour the palette was swapped to.
 */
function shirtVertices(rig, body, hex) {
  const map = body.material.map;
  if (!map?.image) return null;
  const img = map.image;
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  // The recolour writes the linear value as the pixel, so that is what to look for.
  const want = new THREE.Color(hex).toArray().map((c) => c * 255);
  const uv = body.geometry.attributes.uv;
  const pos = body.geometry.attributes.position;
  const root = rig.root;
  const positions = [];
  const shirt = [];
  for (let i = 0; i < pos.count; i++) {
    positions.push(root.worldToLocal(body.localToWorld(new THREE.Vector3().fromBufferAttribute(pos, i))));
    const x = Math.min(canvas.width - 1, Math.floor(uv.getX(i) * canvas.width));
    const y = Math.min(canvas.height - 1, Math.floor((map.flipY ? 1 - uv.getY(i) : uv.getY(i)) * canvas.height));
    const k = (y * canvas.width + x) * 4;
    shirt.push(Math.abs(px[k] - want[0]) < 6 && Math.abs(px[k + 1] - want[1]) < 6 && Math.abs(px[k + 2] - want[2]) < 6);
  }
  return { positions, shirt };
}

const NECKLINE_LIFT = 0.03; // how far above the neck bone the shirt may reach up her neck before it turns to skin

/** The palette cell (uv) of a band in the model's original texture: the first vertex whose texel is that colour. */
function paletteUv(body) {
  const img = (body.material.userData.baseMap ?? body.material.map)?.image;
  if (!img) return null;
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const map = body.material.userData.baseMap ?? body.material.map;
  const uv = body.geometry.attributes.uv;
  const texel = (i) => {
    const x = Math.min(canvas.width - 1, Math.floor(uv.getX(i) * canvas.width));
    const y = Math.min(canvas.height - 1, Math.floor((map.flipY ? 1 - uv.getY(i) : uv.getY(i)) * canvas.height));
    return (y * canvas.width + x) * 4;
  };
  return { texel, px, is: (i, c) => { const k = texel(i); return Math.abs(px[k] - c[0]) < 3 && Math.abs(px[k + 1] - c[1]) < 3 && Math.abs(px[k + 2] - c[2]) < 3; } };
}

/**
 * The model's shirt comes up her neck like a roll neck, to within a few centimetres of her jaw, so the polo collar fitted to its
 * top sat far too high. The model is low-poly: those triangles run from the tops of her shoulders up on to her neck. Any that
 * touches her neck and reaches more than NECKLINE_LIFT above the neck bone takes the skin's palette cell instead, so the shirt,
 * and the collar on it, stop where her neck leaves her shoulders; the collar's flap covers the shoulder ends of those
 * triangles. Only at the front and sides: behind, they reach too far over her shoulders for the flap to hide, and a polo collar
 * sits higher at the back anyway. Once per body geometry: the girls share it.
 */
function lowerNeckline(rig, body) {
  const g = body.geometry;
  if (g.userData.necklineLowered || !rig.bones.Neck) return;
  const pal = paletteUv(body);
  if (!pal) return;
  const uv = g.attributes.uv;
  const pos = g.attributes.position;
  let skin = -1;
  for (let i = 0; i < uv.count && skin < 0; i++) if (pal.is(i, PALETTE.skin)) skin = i;
  if (skin < 0) return;
  const neck = bonePos(rig, 'Neck');
  const root = rig.root;
  const at = (i) => root.worldToLocal(body.localToWorld(new THREE.Vector3().fromBufferAttribute(pos, i)));
  const index = g.index ? g.index.array : [...Array(pos.count).keys()];
  for (let t = 0; t < index.length; t += 3) {
    const tri = [index[t], index[t + 1], index[t + 2]];
    if (!tri.every((i) => pal.is(i, PALETTE.shirt))) continue;
    const ps = tri.map(at);
    const r = ps.map((q) => Math.hypot(q.x - neck.x, q.z - neck.z));
    const z = (ps[0].z + ps[1].z + ps[2].z) / 3;
    if (z > neck.z - 0.015 && Math.min(...r) < 0.075 && Math.max(...r) < 0.105 && Math.max(...ps.map((q) => q.y)) > neck.y + NECKLINE_LIFT) {
      for (const i of tri) uv.setXY(i, uv.getX(skin), uv.getY(skin));
    }
  }
  uv.needsUpdate = true;
  g.userData.necklineLowered = true;
}

/** The shirt's own colour as a material colour (the texture holds the linear value as if it were sRGB). */
function shirtColour(hex) {
  const lin = new THREE.Color(hex);
  return new THREE.Color().setRGB(lin.r, lin.g, lin.b, THREE.SRGBColorSpace);
}

const COLLAR_GAP = 0.22; // half-angle of the opening at the front, radians

/**
 * Cross-section of the folded collar: [height above the neckline, distance off the body], from the
 * neck outwards: up the stand, over the crease and back down on to the shirt. `tip` (0 to 1) is how
 * close to the front opening it is: the flap runs longer there, so it ends in a point.
 */
export function collarSection(tip) {
  return [
    [0, 0.004], // inside, hugging the neck at the neckline
    [0.012, 0.007], // top of the stand
    [0.016, 0.014], // the crease
    [0.004, 0.026], // outer face coming down
    [-0.032 - 0.036 * tip, 0.016], // the flap resting on the shirt
  ];
}

// How much lighter than the shirt each row is: the stand is close to it, the flap lighter so the fold shows.
const COLLAR_SHADE = [1.3, 1.3, 1.7, 1.9, 1.9];

/**
 * A polo collar: the shirt's own neckline thickened into a band, and a folded collar round it,
 * a stand and a flap that lies back on the shirt and ends in points either side of the opening.
 */
function addCollar(rig, color) {
  const body = bodyMesh(rig);
  if (!body || !rig.bones.Neck || !rig.bones.Spine2) return;
  const info = shirtVertices(rig, body, color);
  if (!info) return;
  const neck = bonePos(rig, 'Neck');
  // The neckline is the top of the shirt up the middle of the neck, not the neck bone.
  let top = -Infinity;
  let frontTop = -Infinity; // the neckline dips at the front, and that is where the placket starts
  info.positions.forEach((p, i) => {
    if (!info.shirt[i] || Math.abs(p.x - neck.x) >= 0.07 || Math.hypot(p.x - neck.x, p.z - neck.z) >= 0.1) return;
    top = Math.max(top, p.y);
    if (p.z > neck.z && Math.abs(p.x - neck.x) < 0.025) frontTop = Math.max(frontTop, p.y);
  });
  if (!Number.isFinite(top)) return;

  const shirt = shirtColour(color);
  skinnedGarment(
    rig,
    'collar',
    shirt,
    (p, bone, i) => info.shirt[i] && !isArm(bone) && p.y > top - 0.035 && Math.hypot(p.x - neck.x, p.z - neck.z) < (p.z > neck.z ? 0.12 : 0.1),
    (p) => 0.003 + 0.006 * smooth01((p.y - (top - 0.035)) / 0.035),
  );

  const segments = 30;
  const rows = collarSection(0).length;
  const positions = [];
  const colors = [];
  const angleAt = (i) => COLLAR_GAP + (i / segments) * (Math.PI * 2 - 2 * COLLAR_GAP);
  // The neckline's height all the way round: the top of the shirt within a slice of angle, smoothed, so the collar sits low at
  // the front and a little higher at the back, as a polo collar does.
  let heights = [];
  for (let i = 0; i <= segments; i++) {
    const ang = angleAt(i);
    let h = -Infinity;
    info.positions.forEach((p, k) => {
      if (!info.shirt[k] || Math.hypot(p.x - neck.x, p.z - neck.z) >= 0.1) return;
      const d = Math.atan2(Math.sin(Math.atan2(p.x - neck.x, p.z - neck.z) - ang), Math.cos(Math.atan2(p.x - neck.x, p.z - neck.z) - ang));
      if (Math.abs(d) < 0.45) h = Math.max(h, p.y);
    });
    heights.push(Number.isFinite(h) ? h : top);
  }
  for (let pass = 0; pass < 3; pass++) heights = heights.map((h, i) => (heights[Math.max(0, i - 1)] + 2 * h + heights[Math.min(segments, i + 1)]) / 4);
  for (let i = 0; i <= segments; i++) {
    const ang = angleAt(i);
    const dir = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
    // 1 at the ends beside the opening, falling to 0 a little way round.
    const edge = Math.min(ang - COLLAR_GAP, Math.PI * 2 - COLLAR_GAP - ang);
    const tip = 1 - smooth01(edge / 0.6);
    const base = heights[i];
    // Radius of the neck at the neckline, used up the stand; the flap follows the shoulders and chest.
    const neckR = surfaceDistance(rig, body, new THREE.Vector3(neck.x, base, neck.z), dir) ?? 0.05;
    for (const [dy, off] of collarSection(tip)) {
      const y = base + dy;
      const r = dy > 0 ? neckR : surfaceDistance(rig, body, new THREE.Vector3(neck.x, y, neck.z), dir) ?? neckR;
      positions.push(neck.x + dir.x * (r + off), y, neck.z + dir.z * (r + off));
    }
    for (const k of COLLAR_SHADE) colors.push(shirt.r * k, shirt.g * k, shirt.b * k);
  }
  const index = [];
  for (let i = 0; i < segments; i++) {
    for (let r = 0; r < rows - 1; r++) {
      const p0 = i * rows + r;
      const p1 = (i + 1) * rows + r;
      index.push(p0, p1, p0 + 1, p1, p1 + 1, p0 + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const fold = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide, flatShading: true }));
  fold.name = 'collarFold';
  fold.castShadow = true;
  rig.root.add(fold);
  rig.bones.Spine2.attach(fold);
  rig.outfitParts.push(fold);
  return Number.isFinite(frontTop) ? frontTop : top;
}

/**
 * Shorts: her hips and the tops of her thighs, a little off the skin and
 * flaring at a hem a bit above the knee.
 */
function addShorts(rig, color) {
  if (!rig.bones.Hips || !rig.bones.LeftUpLeg || !rig.bones.LeftLeg) return;
  const waist = (rig.bones.Spine ? bonePos(rig, 'Spine') : bonePos(rig, 'Hips')).y + 0.01;
  const hip = bonePos(rig, 'LeftUpLeg').y;
  const knee = bonePos(rig, 'LeftLeg').y;
  const hem = hip - (hip - knee) * 0.56;
  skinnedGarment(
    rig,
    'shorts',
    color,
    (p, bone) => !isArm(bone) && p.y <= waist && p.y >= hem,
    // Snug at the waist, looser down the leg and flared at the hem.
    (p) => 0.006 + 0.012 * smooth01((hip - p.y) / (hip - hem)),
  );
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
 * Point and surface normal on the front of the body at a height above the
 * character root, found by casting a ray back at the skinned mesh in its rest pose.
 */
function chestPoint(rig, mesh, x, y) {
  const root = rig.root;
  const origin = root.localToWorld(new THREE.Vector3(x, y, 0.6));
  const dir = new THREE.Vector3(0, 0, -1).transformDirection(root.matrixWorld);
  const hit = new THREE.Raycaster(origin, dir, 0, 1).intersectObject(mesh, false)[0];
  if (!hit) return null;
  const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).transformDirection(root.matrixWorld.clone().invert());
  return { point: root.worldToLocal(hit.point.clone()), normal };
}

/**
 * A buttoned placket from the neckline down the chest. It is laid as a ribbon along the
 * surface, lifted off it along the normal, so the bust doesn't swallow it. Carried by the upper spine.
 */
function addPoloFront(rig, color, neckline) {
  const spine = rig.bones.Spine2;
  const mesh = bodyMesh(rig);
  if (!spine || !mesh || neckline === undefined) return;
  const root = rig.root;
  const samples = 10;
  const lift = 0.007;
  const half = 0.011;
  const top = neckline - 0.03; // the neck rises almost vertically above this, so a higher start would run up it
  const length = 0.12;
  const hits = [];
  for (let k = 0; k <= samples; k++) {
    const hit = chestPoint(rig, mesh, 0, top - (k / samples) * length);
    if (!hit) return;
    hits.push(hit);
  }

  const placketColor = shirtColour(color).multiplyScalar(1.9);
  const group = new THREE.Group();
  group.name = 'poloFront';
  const positions = [];
  const index = [];
  hits.forEach(({ point, normal }, k) => {
    const c = point.clone().addScaledVector(normal, lift);
    positions.push(c.x - half, c.y, c.z, c.x + half, c.y, c.z);
    if (k) index.push(2 * k - 2, 2 * k - 1, 2 * k, 2 * k - 1, 2 * k + 1, 2 * k);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  group.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: placketColor, roughness: 0.85, side: THREE.DoubleSide })));

  // Three buttons, one right at the top, standing on the ribbon.
  const buttonMat = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.4 });
  for (const t of [0.12, 0.45, 0.78]) {
    const f = t * samples;
    const k = Math.min(samples - 1, Math.floor(f));
    const a = hits[k];
    const b = hits[k + 1];
    const point = a.point.clone().lerp(b.point, f - k);
    const normal = a.normal.clone().lerp(b.normal, f - k).normalize();
    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.003, 10), buttonMat);
    button.position.copy(point).addScaledVector(normal, lift + 0.002);
    button.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    group.add(button);
  }

  // Everything above was built in character-root space; hand it to the spine bone.
  group.traverse((o) => (o.castShadow = o.isMesh));
  root.add(group);
  spine.attach(group);
  rig.outfitParts.push(group);
}

export function applyOutfit(rig, outfit) {
  rig.root.updateMatrixWorld(true);
  rig.outfitParts = [];
  rig.model.traverse((o) => {
    if (!o.isMesh) return;
    const mat = o.material;
    if (outfit.colors && mat.map) {
      mat.userData.baseMap ??= mat.map; // kept so the shirt can be recoloured later
      mat.map = recolourTexture(mat.userData.baseMap, outfit.colors);
    }
    // The FBX conversion left the clothes slightly metallic; fabric isn't.
    mat.metalness = 0;
    mat.roughness = 0.85;
    mat.needsUpdate = true;
  });
  const body = bodyMesh(rig);
  if (body && outfit.collar) lowerNeckline(rig, body);
  addGarments(rig, outfit);
}

/** The outfit with the shirt (and its collar) in another colour, e.g. a number like a quad's 0xe9c21b. */
export function withShirt(outfit, color) {
  const hex = typeof color === 'number' ? `#${color.toString(16).padStart(6, '0')}` : color;
  return { ...outfit, colors: { ...outfit.colors, shirt: hex }, ...(outfit.collar ? { collar: hex } : {}) };
}

/** The outfit with a jumper over it (a colour), or with it taken off (null). */
export function withJumper(outfit, color) {
  const { jumper, ...rest } = outfit;
  return color ? { ...rest, jumper: color } : rest;
}

/** Puts her in the same outfit with a different shirt, once the colour is known. */
export function reshirt(rig, outfit, color) {
  const next = withShirt(outfit, color);
  rig.model.traverse((o) => {
    const base = o.isMesh && o.material.userData.baseMap;
    if (!base) return;
    o.material.map.dispose();
    o.material.map = recolourTexture(base, next.colors);
    o.material.needsUpdate = true;
  });
  refitOutfit(rig, next);
  return next;
}

/**
 * A jumper, a size too big: her torso and arms down to the wrist as one soft shell, with a crew neck low enough to show the
 * polo's collar and top button. It doesn't cling: below her bust it falls straight to a snug ribbed hem over her hips, and the
 * neck, cuffs and hem are ribbed bands a shade darker.
 */
function addJumper(rig, color, shirtHex) {
  const body = bodyMesh(rig);
  if (!body || !rig.bones.Neck || !rig.bones.Hips || !rig.bones.LeftUpLeg) return;
  const info = shirtHex ? shirtVertices(rig, body, shirtHex) : null;
  const neck = bonePos(rig, 'Neck');
  let top = neck.y + 0.02;
  if (info) {
    // The shirt's own neckline, up the middle of the neck, so the jumper's neck sits round the polo's.
    let found = -Infinity;
    info.positions.forEach((p, i) => {
      if (info.shirt[i] && Math.hypot(p.x - neck.x, p.z - neck.z) < 0.1) found = Math.max(found, p.y);
    });
    if (Number.isFinite(found)) top = found;
  }
  // The hem hangs over the shorts' waistband, which is at her spine bone.
  const hem = (rig.bones.Spine ? bonePos(rig, 'Spine') : bonePos(rig, 'Hips')).y - 0.1;
  const scoop = top - 0.045; // the crew neck at the front and back: just low enough to show the collar and the top button
  const wide = 0.08; // beyond this far from the middle of her neck it goes right up over the shoulders
  const band = 0.03; // depth of the ribbed neck and hem
  const sleeve = /Shoulder|Arm/; // Arm also matches ForeArm; the hand is left bare
  const hands = ['LeftHand', 'RightHand'].filter((n) => rig.bones[n]).map((n) => bonePos(rig, n));
  const nearHand = (p) => Math.min(...hands.map((h) => h.distanceTo(p)));
  const neckLine = (p) => (Math.abs(p.x - neck.x) > wide ? top : scoop);
  const rib = (p, bone) => {
    if (sleeve.test(bone)) return smooth01((0.11 - nearHand(p)) / 0.03); // the cuff, its last few centimetres
    return Math.max(smooth01((p.y - (neckLine(p) - band)) / 0.01), smooth01((hem + band - p.y) / 0.01));
  };

  // Where her bust stands furthest forward, across her chest, so the knit can fall straight down from it.
  const step = 0.02;
  const front = new Map(); // x bin -> { z, y } of the furthest-forward point of her chest
  const pos = body.geometry.attributes.position;
  const si = body.geometry.attributes.skinIndex;
  const sw = body.geometry.attributes.skinWeight;
  const torso = (i) => {
    let best = 0;
    for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k;
    return /Spine|Hips/.test(body.skeleton.bones[si.getComponent(i, best)]?.name ?? '');
  };
  for (let i = 0; i < pos.count; i++) {
    const p = rig.root.worldToLocal(body.localToWorld(new THREE.Vector3().fromBufferAttribute(pos, i)));
    if (!torso(i) || p.z <= neck.z || p.y > top - 0.08 || p.y < hem + 0.12 || Math.abs(p.x - neck.x) > 0.14) continue;
    const k = Math.round((p.x - neck.x) / step);
    const f = front.get(k);
    if (!f || p.z > f.z) front.set(k, { z: p.z, y: p.y });
  }
  // Across her chest the knit bridges between the two, so take the furthest-forward point a few bins either side.
  const ledge = (x) => {
    const k = Math.round((x - neck.x) / step);
    let best = null;
    for (let d = -3; d <= 3; d++) {
      const f = front.get(k + d);
      if (f && (!best || f.z > best.z)) best = f;
    }
    return best;
  };

  skinnedGarment(
    rig,
    'jumper',
    color,
    (p, bone) => (sleeve.test(bone) ? nearHand(p) > 0.075 : !/Leg|Foot|Toe|Hand|Head|Neck/.test(bone) && p.y <= neckLine(p) && p.y >= hem),
    (p, bone) => {
      const r = rib(p, bone);
      if (sleeve.test(bone)) return 0.021 - 0.012 * r; // loose sleeves gathered into a snug cuff
      return 0.026 - 0.01 * smooth01((hem + band - p.y) / band) + 0.004 * smooth01((p.y - (neckLine(p) - band)) / band);
    },
    {
      soft: true,
      // Below the bust the front hangs straight, easing back a little towards the hem, instead of following her under it.
      shape: (q, p, bone) => {
        if (!/Spine|Hips/.test(bone) || q.z <= neck.z || Math.abs(p.x - neck.x) > 0.14) return q;
        const f = ledge(p.x);
        if (!f || p.y >= f.y) return q;
        const hang = f.z + 0.02 - 0.18 * (f.y - p.y) - 0.012 * smooth01((hem + band - p.y) / band);
        const sides = 1 - smooth01((Math.abs(p.x - neck.x) - 0.1) / 0.06); // not at her sides, which are already vertical
        return q.z < hang ? new THREE.Vector3(q.x, q.y, q.z + Math.min(0.05, hang - q.z) * sides) : q;
      },
      shade: (p, bone) => 1 - 0.24 * rib(p, bone),
    },
  );
}

function addGarments(rig, outfit) {
  if (outfit.collar) addPoloFront(rig, outfit.collar, addCollar(rig, outfit.collar));
  if (outfit.jumper) addJumper(rig, outfit.jumper, outfit.colors?.shirt);
  if (outfit.shorts) addShorts(rig, outfit.shorts);
  if (outfit.wellies) addWellies(rig, outfit.wellies);
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
  rig.outfitParts = [];
  rig.withRestPose(() => addGarments(rig, outfit));
}
