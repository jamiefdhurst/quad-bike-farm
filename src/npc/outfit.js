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
    colors: { shirt: '#3a5690', shoes: '#2f4a2c' },
    collar: '#3a5690',
    wellies: '#2f4a2c',
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
  const swaps = Object.entries(colors).map(([band, hex]) => {
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
 * A polo collar: a short band hugging the neck just above the neckline, open
 * at the front, with its top edge folded a little outwards.
 */
function addCollar(rig, color) {
  const mesh = bodyMesh(rig);
  if (!mesh || !rig.bones.Neck) return;
  const neck = bonePos(rig, 'Neck');
  const a = neck.clone().add(new THREE.Vector3(0, 0.008, 0));
  const b = neck.clone().add(new THREE.Vector3(0, 0.036, 0));
  const geo = fittedShell(
    rig,
    mesh,
    a,
    b,
    [0, 0.5, 1],
    // Hug the neck, never balloon onto the shoulders, flare slightly at the fold.
    (t, r) => Math.min(r, 0.05) + 0.005 + 0.006 * t,
    { segments: 24, skip: 0.42, fallback: 0.035 },
  );
  const collar = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.62), roughness: 0.9, side: THREE.DoubleSide }),
  );
  collar.name = 'collar';
  attachToBone(rig, collar, 'Neck');
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
 * Point on the front of the body at a height above the character root, found
 * by casting a ray back at the skinned mesh in its rest pose.
 */
function chestPoint(rig, mesh, x, y) {
  const root = rig.root;
  const origin = root.localToWorld(new THREE.Vector3(x, y, 0.6));
  const dir = new THREE.Vector3(0, 0, -1).transformDirection(root.matrixWorld);
  const hit = new THREE.Raycaster(origin, dir, 0, 1).intersectObject(mesh, false)[0];
  return hit ? root.worldToLocal(hit.point.clone()) : null;
}

/** Collar points and a buttoned placket, laid on the chest and carried by the upper spine. */
function addPoloFront(rig, color) {
  const spine = rig.bones.Spine2;
  const neck = rig.bones.Neck;
  let mesh = null;
  rig.model.traverse((o) => {
    if (o.isSkinnedMesh && !mesh) mesh = o;
  });
  if (!spine || !neck || !mesh) return;
  const root = rig.root;
  const neckY = root.worldToLocal(neck.getWorldPosition(new THREE.Vector3())).y;
  const top = chestPoint(rig, mesh, 0, neckY - 0.015);
  const bottom = chestPoint(rig, mesh, 0, neckY - 0.1);
  if (!top || !bottom) return;

  // Separate pieces catch more sky light than the shirt itself, so they're a shade darker to match.
  const fabric = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).multiplyScalar(0.62),
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  const placketColor = new THREE.Color(color).multiplyScalar(0.62);
  const group = new THREE.Group();
  group.name = 'poloFront';

  // Placket strip with two buttons, following the slope of the chest.
  const along = bottom.clone().sub(top);
  const length = along.length();
  const placket = new THREE.Mesh(
    new THREE.BoxGeometry(0.022, length, 0.004),
    new THREE.MeshStandardMaterial({ color: placketColor, roughness: 0.85 }),
  );
  placket.position.copy(top).add(bottom).multiplyScalar(0.5);
  placket.position.z += 0.004;
  placket.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), along.clone().normalize());
  group.add(placket);
  const buttonMat = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.4 });
  for (const t of [0.3, 0.75]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.003, 10), buttonMat);
    b.rotation.x = Math.PI / 2;
    b.position.copy(top).lerp(bottom, t);
    b.position.z += 0.008;
    group.add(b);
  }

  // Two pointed collar tips falling either side of the opening.
  for (const sx of [-1, 1]) {
    const inner = chestPoint(rig, mesh, sx * 0.01, neckY + 0.008);
    const tip = chestPoint(rig, mesh, sx * 0.032, neckY - 0.03);
    const outer = chestPoint(rig, mesh, sx * 0.042, neckY + 0.006);
    if (!inner || !tip || !outer) continue;
    const lift = new THREE.Vector3(0, 0, 0.004);
    const geo = new THREE.BufferGeometry().setFromPoints([inner.add(lift), tip.add(lift), outer.add(lift)]);
    geo.computeVertexNormals();
    group.add(new THREE.Mesh(geo, fabric));
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
    addCollar(rig, outfit.collar);
    addPoloFront(rig, outfit.collar);
  }
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
