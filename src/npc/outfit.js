import * as THREE from 'three';
import { buildTop, buttonShape, poloFields, POLO, JUMPER } from './polo.js';
import { unskin } from './garmentMesh.js';

// Outfits for the companion. The Quaternius model is textured from a tiny
// palette (one flat colour per band), so recolouring clothes is a matter of
// swapping palette entries. Extra garment parts (a collar, boot shafts) are
// small meshes attached to bones so they follow the animations.

// The polo as a garment over her body instead of painted on (polo.js), while it's being tried out: ?polo=shell.
const POLO_SHELL = new URLSearchParams(globalThis.location?.search ?? '').get('polo') === 'shell';

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
  // The rest as they are: a hit's uv and normal come from these, as on the skinned mesh (shirtFrontTop reads the shirt's colour by uv).
  for (const [name, attr] of Object.entries(src.attributes)) if (name !== 'position') geo.setAttribute(name, attr);
  if (src.index) geo.setIndex(src.index);
  for (const g of src.groups) geo.addGroup(g.start, g.count, g.materialIndex);
  const copy = new THREE.Mesh(geo, mesh.material);
  copy.matrixAutoUpdate = false;
  copy.matrixWorld.copy(mesh.matrixWorld);
  return copy;
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

/**
 * A garment made from part of her own body mesh: the triangles `wear` picks,
 * pushed out along the surface by `offset` metres, and skinned to the same
 * skeleton, so it bends exactly as she does (walking, sitting, her figure).
 * `wear(p, bone, i)` and `offset(p, bone)` get root-space rest-pose positions; `bone`
 * is the name of the bone the vertex follows most and `i` its index in the body mesh.
 */
function skinnedGarment(rig, name, color, wear, offset, { smooth = false, soft = false, shape = null, shade = null, smoothEdge = null } = {}) {
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
  // Smooth an open edge (`smoothEdge(rootPos)` picks which): the garment stops at whole triangles of a coarse body, so its edge
  // saw-tooths. Each point on that edge moves towards the middle of its two neighbours along it, a few times over.
  if (smoothEdge && soft) {
    const edges = new Map();
    for (let t = 0; t < out.length; t += 3) {
      for (const [a, b] of [[out[t], out[t + 1]], [out[t + 1], out[t + 2]], [out[t + 2], out[t]]]) {
        const k = a < b ? `${a},${b}` : `${b},${a}`;
        edges.set(k, (edges.get(k) ?? 0) + 1);
      }
    }
    const ids = [...remap.keys()];
    const restOf = (v) => rootPos[tris.find((i) => (soft ? key(i) : i) === ids[v])];
    const along = new Map();
    for (const [k, n] of edges) {
      if (n !== 1) continue;
      const [a, b] = k.split(',').map(Number);
      if (!smoothEdge(restOf(a)) || !smoothEdge(restOf(b))) continue;
      along.set(a, [...(along.get(a) ?? []), b]);
      along.set(b, [...(along.get(b) ?? []), a]);
    }
    for (let pass = 0; pass < 6; pass++) {
      const next = new Map();
      for (const [v, ns] of along) {
        if (ns.length !== 2) continue;
        const [a, b] = ns;
        next.set(v, [0, 1, 2].map((c) => 0.5 * P[v * 3 + c] + 0.25 * (P[a * 3 + c] + P[b * 3 + c])));
      }
      for (const [v, q] of next) for (let c = 0; c < 3; c++) P[v * 3 + c] = q[c];
    }
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

// The polo's neckline: how high it sits above her neck bone round the sides and back, where her neck meets her shoulders, and
// how much lower it dips at the front, where the placket starts. A gentle dip: a deeper one cuts across a ledge of the model's
// old roll neck at her throat and breaks up into a slash of skin.
const NECK_SIDE = 0.036;
const NECK_DIP = 0.015;
const NECK_SPAN = 0.14; // metres of height the neckline strip covers, half below the neckline and half above

/** Height of the neckline at an angle round her neck (0 is the front). */
function necklineAt(neck, ang) {
  return neck.y + NECK_SIDE - NECK_DIP * Math.max(0, Math.cos(ang)) ** 1.5;
}

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
 * The model's shirt comes up her neck like a roll neck, to within a few centimetres of her jaw, and the model is too coarse for
 * whole triangles to give a clean line lower down. So the texture gets a neckline strip (withNecklineStrip), every other UV is
 * squeezed into its left half, and each shirt triangle round her neck that reaches the neckline is mapped across the strip by
 * its height above the neckline at that angle: shirt below, skin above. Once per geometry; each girl has her own.
 */
function cutNeckline(rig, body, line = null) {
  const original = body.material.userData.baseMap ?? body.material.map;
  if (!original?.image || !rig.bones.Neck) return;
  const strip = withNecklineStrip(original);
  const neck = bonePos(rig, 'Neck');
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
        const at = (i) => rig.root.worldToLocal(body.localToWorld(new THREE.Vector3().fromBufferAttribute(pos, i)));
        const index = g.index ? g.index.array : [...Array(pos.count).keys()];
        for (let t = 0; t < index.length; t += 3) {
          const tri = [index[t], index[t + 1], index[t + 2]];
          if (!tri.every((i) => pal.is(i, PALETTE.shirt))) continue;
          if (line) {
            // The polo garment's own neckline (`above(i)` is vertex i's height above it, worked out where she stands).
            const d = tri.map(line.above);
            if (tri.some(line.near) && Math.max(...d) > -0.01) tri.forEach((i, k) => cut.push([i, d[k]]));
            continue;
          }
          const ps = tri.map(at);
          const r = ps.map((q) => Math.hypot(q.x - neck.x, q.z - neck.z));
          // Height above the neckline; anything further out than her neck counts as further below it, so the line stays round
          // her neck and the tops of her shoulders stay shirt.
          const d = ps.map((q, k) => q.y - necklineAt(neck, Math.atan2(q.x - neck.x, q.z - neck.z)) - 5 * Math.max(0, r[k] - 0.065));
          if (Math.min(...r) < 0.075 && Math.max(...r) < 0.15 && Math.max(...d) > -0.01) tri.forEach((i, k) => cut.push([i, d[k]]));
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

/** The shirt's own colour as a material colour (the texture holds the linear value as if it were sRGB). */
function shirtColour(hex) {
  const lin = new THREE.Color(hex);
  return new THREE.Color().setRGB(lin.r, lin.g, lin.b, THREE.SRGBColorSpace);
}

/**
 * Where the polo's placket starts: where the shirt meets her skin down the middle of her front. Measured, not worked out from
 * the neckline: walking down her front, the first point whose colour on the body is the shirt's. (The cut's line is bent by
 * how far out from her neck each corner is, so at the front the boundary sits below necklineAt.)
 */
function shirtFrontTop(rig, hex) {
  const body = bodyMesh(rig);
  if (!body || !rig.bones.Neck || !body.material.map?.image) return undefined;
  const neck = bonePos(rig, 'Neck');
  const img = body.material.map.image;
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const flip = body.material.map.flipY;
  // The recolour writes the linear value as the pixel, so that is what to look for.
  const want = new THREE.Color(hex).toArray().map((c) => c * 255);
  const isShirt = (uv) => {
    const x = Math.min(canvas.width - 1, Math.floor(uv.x * canvas.width));
    const y = Math.min(canvas.height - 1, Math.floor((flip ? 1 - uv.y : uv.y) * canvas.height));
    const k = (y * canvas.width + x) * 4;
    return Math.abs(px[k] - want[0]) < 6 && Math.abs(px[k + 1] - want[1]) < 6 && Math.abs(px[k + 2] - want[2]) < 6;
  };
  const root = rig.root;
  const back = new THREE.Vector3(0, 0, -1).transformDirection(root.matrixWorld);
  for (let y = necklineAt(neck, 0) + 0.02; y > neck.y - 0.1; y -= 0.0015) {
    raycaster.set(root.localToWorld(new THREE.Vector3(neck.x, y, 0.6)), back);
    raycaster.far = 1;
    const hit = raycaster.intersectObject(castAt(rig, body), false)[0];
    if (hit?.uv && isShirt(hit.uv)) return y;
  }
  return necklineAt(neck, 0);
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
  const hit = new THREE.Raycaster(origin, dir, 0, 1).intersectObject(castAt(rig, mesh), false)[0];
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
  const top = neckline - 0.001; // from where the shirt meets her skin
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

  // Three buttons standing on the ribbon, all done up: the top one just under the neckline.
  const buttonMat = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.4 });
  for (const t of [0.1, 0.45, 0.8]) {
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
  const body = bodyMesh(rig);
  if (body && outfit.collar) cutNeckline(rig, body, POLO_SHELL ? poloNeckPaint(rig, body) : null);
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
  const band = 0.03; // depth of the ribbed neck and hem
  const sleeve = /Shoulder|Arm/; // Arm also matches ForeArm; the hand is left bare
  const hands = ['LeftHand', 'RightHand'].filter((n) => rig.bones[n]).map((n) => bonePos(rig, n));
  const nearHand = (p) => Math.min(...hands.map((h) => h.distanceTo(p)));
  // A round neck: a smooth curve round her neck, lowest at the front, a little low at the back, up over the shoulders between.
  const neckLine = (p) => {
    const c = Math.cos(Math.atan2(p.x - neck.x, p.z - neck.z));
    return top - 0.01 - (top - 0.01 - scoop) * Math.max(0, c) ** 1.5 - 0.012 * Math.max(0, -c) ** 2;
  };
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
      smoothEdge: (p) => p.y > hem + 0.1 && Math.hypot(p.x - neck.x, p.z - neck.z) < 0.16,
    },
  );
}

/**
 * Her body as plain data for polo.js: each vertex's position as stored (`bind`, a T-pose turned a quarter round) and as she
 * stands (`rest`), both in root space, its normal, skin weights and `skin`, the map from one to the other. Needs her in her
 * rest pose.
 */
function bodyData(rig, body) {
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
    const rest = rig.root.worldToLocal(body.localToWorld(body.getVertexPosition(i, v))).toArray();
    verts.push({ bind, rest, normal, weights, skin });
  }
  const bones = {};
  for (const name of Object.keys(rig.bones)) bones[name] = bonePos(rig, name).toArray();
  const pal = paletteUv(body);
  const bands = Object.entries(PALETTE);
  const paint = (i) => bands.find(([, c]) => pal?.is(i, c))?.[0] ?? 'other';
  const waist = (rig.bones.Spine ? bonePos(rig, 'Spine') : bonePos(rig, 'Hips')).y + 0.01; // as the shorts
  return { verts, index: g.index ? [...g.index.array] : [...Array(pos.count).keys()], boneNames: body.skeleton.bones.map((b) => b.name), bones, paint, waist, fromRoot };
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
 * (JUMPER) goes over it, to her wrists and over the shorts. ?polo=shell.
 */
function addTop(rig, name, color, spec) {
  const body = bodyMesh(rig);
  const needs = ['Neck', 'Spine', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'LeftHand', 'RightHand'];
  if (!body || !needs.every((b) => rig.bones[b])) return;
  const data = bodyData(rig, body);
  const { shell, shade, placket } = buildTop(data, spec);
  // The polo matches the shirt colour the body is painted under it; the jumper is its own colour, as before.
  const tint = spec === POLO ? shirtColour(color) : new THREE.Color(color);
  const shading = [];
  for (const k of shade) shading.push(tint.r * k, tint.g * k, tint.b * k);
  skinnedFromArrays(
    rig,
    body,
    data,
    name,
    { positions: shell.verts.map((q) => q.bind), normals: shell.normals, weights: shell.verts.map((q) => q.weights), colors: shading, index: shell.tris.flat() },
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: spec === JUMPER ? 0.97 : 0.92, side: THREE.DoubleSide }),
  );
  if (!placket) return;

  // The placket, stitched, and its buttons (a second mesh, the holes coloured in).
  const index = placket.tris.flat();
  skinnedFromArrays(
    rig,
    body,
    data,
    'poloPlacket',
    { positions: placket.verts.map((q) => q.bind), normals: smoothArrayNormals(placket.verts.map((q) => q.bind), index), weights: placket.verts.map((q) => q.weights), uvs: placket.uv, index },
    new THREE.MeshStandardMaterial({ color: tint.clone().multiplyScalar(1 / new THREE.Color().setRGB(STITCH_BASE, 0, 0, THREE.SRGBColorSpace).r), map: placketStitches(), roughness: 0.9, side: THREE.DoubleSide }),
  );
  const positions = [];
  const weights = [];
  const colors = [];
  const tris = [];
  const ivory = new THREE.Color(0xebe7dc);
  const hole = tint.clone().multiplyScalar(0.35);
  const add = (points, triangles, anchor, c) => {
    const base = positions.length;
    for (const pt of points) {
      positions.push(unskin(anchor.skin, pt));
      weights.push(anchor.weights);
      colors.push(c.r, c.g, c.b);
    }
    for (const t of triangles) tris.push(...t.map((i) => i + base));
  };
  for (const b of placket.buttons) {
    const shape = buttonShape(b.centre, b.normal, POLO.buttonRadius);
    add(shape.points, shape.tris, b.anchor, ivory);
    add(shape.holes, shape.holeTris, b.anchor, hole);
  }
  skinnedFromArrays(
    rig,
    body,
    data,
    'poloButtons',
    { positions, normals: smoothArrayNormals(positions, tris), weights, colors, index: tris },
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, side: THREE.DoubleSide }),
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
  if (outfit.collar && POLO_SHELL) addTop(rig, 'polo', outfit.collar, POLO);
  else if (outfit.collar) addPoloFront(rig, outfit.collar, shirtFrontTop(rig, outfit.collar));
  if (outfit.jumper && POLO_SHELL) addTop(rig, 'jumper', outfit.jumper, JUMPER);
  else if (outfit.jumper) addJumper(rig, outfit.jumper, outfit.colors?.shirt);
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
