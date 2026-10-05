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
 * `wear(p, bone, i)` and `offset(p)` get root-space rest-pose positions; `bone`
 * is the name of the bone the vertex follows most and `i` its index in the body mesh.
 */
function skinnedGarment(rig, name, color, wear, offset) {
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
  // Mesh units per metre of root space, for the offset.
  const unit = 1 / toRoot(new THREE.Vector3(1, 0, 0)).sub(toRoot(new THREE.Vector3())).length();
  const n = pos.count;
  const rootPos = [];
  const keep = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const p = toRoot(v.fromBufferAttribute(pos, i));
    rootPos.push(p);
    let best = 0;
    for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k;
    keep.push(wear(p, boneNames[si.getComponent(i, best)] ?? '', i));
  }
  const index = g.index ? g.index.array : [...Array(n).keys()];
  const tris = [];
  for (let t = 0; t < index.length; t += 3) {
    const [a, b, c] = [index[t], index[t + 1], index[t + 2]];
    if (keep[a] && keep[b] && keep[c]) tris.push(a, b, c);
  }
  if (!tris.length) return null;
  // Compact the vertices used, pushed out along their normals.
  const remap = new Map();
  const P = [];
  const N = [];
  const SI = [];
  const SW = [];
  const out = [];
  for (const i of tris) {
    if (!remap.has(i)) {
      remap.set(i, P.length / 3);
      const d = offset(rootPos[i]) * unit;
      P.push(pos.getX(i) + nrm.getX(i) * d, pos.getY(i) + nrm.getY(i) * d, pos.getZ(i) + nrm.getZ(i) * d);
      N.push(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
      for (let k = 0; k < 4; k++) {
        SI.push(si.getComponent(i, k));
        SW.push(sw.getComponent(i, k));
      }
    }
    out.push(remap.get(i));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
  geo.setIndex(out);
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.88, side: THREE.DoubleSide, flatShading: true }));
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

/** The shirt's own colour as a material colour (the texture holds the linear value as if it were sRGB). */
function shirtColour(hex) {
  const lin = new THREE.Color(hex);
  return new THREE.Color().setRGB(lin.r, lin.g, lin.b, THREE.SRGBColorSpace);
}

const COLLAR_GAP = 0.3; // half-angle of the opening at the front, radians

/**
 * Cross-section of the folded collar: [height above the neckline, distance off the body], from the
 * neck outwards: up the stand, over the crease and back down on to the shirt. `tip` (0 to 1) is how
 * close to the front opening it is: the flap runs longer there, so it ends in a point.
 */
export function collarSection(tip) {
  return [
    [0, 0.004], // inside, hugging the neck at the neckline
    [0.02, 0.008], // top of the stand
    [0.023, 0.016], // the crease
    [0.01, 0.026], // outer face coming down
    [-0.014 - 0.034 * tip, 0.016], // the flap resting on the shirt
  ];
}

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
  info.positions.forEach((p, i) => {
    if (info.shirt[i] && Math.abs(p.x - neck.x) < 0.07 && Math.hypot(p.x - neck.x, p.z - neck.z) < 0.1) top = Math.max(top, p.y);
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
  for (let i = 0; i <= segments; i++) {
    const ang = COLLAR_GAP + (i / segments) * (Math.PI * 2 - 2 * COLLAR_GAP);
    const dir = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
    // 1 at the ends beside the opening, falling to 0 a little way round.
    const edge = Math.min(ang - COLLAR_GAP, Math.PI * 2 - COLLAR_GAP - ang);
    const tip = 1 - smooth01(edge / 0.5);
    // Radius of the neck at the neckline, used up the stand; the flap follows the shoulders and chest.
    const neckR = surfaceDistance(rig, body, new THREE.Vector3(neck.x, top, neck.z), dir) ?? 0.05;
    for (const [dy, off] of collarSection(tip)) {
      const y = top + dy;
      const r = dy > 0 ? neckR : surfaceDistance(rig, body, new THREE.Vector3(neck.x, y, neck.z), dir) ?? neckR;
      positions.push(neck.x + dir.x * (r + off), y, neck.z + dir.z * (r + off));
    }
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
  geo.setIndex(index);
  geo.computeVertexNormals();
  // A touch lighter than the shirt so the folds read against it.
  const fold = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: shirt.clone().multiplyScalar(1.6), roughness: 0.85, side: THREE.DoubleSide, flatShading: true }));
  fold.name = 'collarFold';
  fold.castShadow = true;
  rig.root.add(fold);
  rig.bones.Spine2.attach(fold);
  rig.outfitParts.push(fold);
  return top;
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
  const top = neckline - 0.016;
  const length = 0.14;
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
    if (outfit.colors && mat.map) mat.map = recolourTexture(mat.map, outfit.colors);
    // The FBX conversion left the clothes slightly metallic; fabric isn't.
    mat.metalness = 0;
    mat.roughness = 0.85;
    mat.needsUpdate = true;
  });
  addGarments(rig, outfit);
}

function addGarments(rig, outfit) {
  if (outfit.collar) {
    addPoloFront(rig, outfit.collar, addCollar(rig, outfit.collar));
  }
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
