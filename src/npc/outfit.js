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

/** Size in metres converted to the bone's local units. */
function toBoneUnits(bone, metres) {
  const s = bone.getWorldScale(new THREE.Vector3()).x;
  return metres / s;
}

/** Direction the character faces, expressed in a bone's local frame. */
function localForward(bone, root) {
  const rootQ = root.getWorldQuaternion(new THREE.Quaternion());
  const boneQ = bone.getWorldQuaternion(new THREE.Quaternion());
  return new THREE.Vector3(0, 0, 1).applyQuaternion(rootQ).applyQuaternion(boneQ.invert()).normalize();
}

/** A fold-down polo collar around the base of the neck, open at the front. */
function addCollar(rig, color) {
  const neck = rig.bones.Neck;
  if (!neck) return;
  const m = (v) => toBoneUnits(neck, v);
  const gap = 0.9; // radians open at the front
  const geo = new THREE.CylinderGeometry(m(0.074), m(0.11), m(0.05), 20, 1, true, gap / 2, Math.PI * 2 - gap);
  geo.translate(0, m(0.004), 0);
  const collar = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.8), roughness: 0.85, side: THREE.DoubleSide }),
  );
  collar.name = 'collar';
  // Cylinder theta starts at +Z; turn it so the opening faces the way she does.
  const fwd = localForward(neck, rig.root);
  collar.rotation.y = Math.atan2(fwd.x, fwd.z);
  collar.castShadow = true;
  neck.add(collar);
}

/** Rubber boot shafts from the ankle to just below the knee. */
function addWellies(rig, color) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
  for (const side of ['Left', 'Right']) {
    const shin = rig.bones[`${side}Leg`];
    const foot = rig.bones[`${side}Foot`];
    if (!shin || !foot) continue;
    const m = (v) => toBoneUnits(shin, v);
    const toAnkle = foot.position.clone();
    const len = toAnkle.length();
    const height = len * 0.62;
    const geo = new THREE.CylinderGeometry(m(0.062), m(0.052), height, 14);
    const boot = new THREE.Mesh(geo, mat);
    boot.name = `${side.toLowerCase()}Welly`;
    // Sit along the shin, ending at the ankle.
    boot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), toAnkle.clone().normalize());
    boot.position.copy(toAnkle).multiplyScalar(1 - (height / len) * 0.5 + 0.02);
    boot.castShadow = true;
    shin.add(boot);
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
    color: new THREE.Color(color).multiplyScalar(0.72),
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
    const inner = chestPoint(rig, mesh, sx * 0.012, neckY - 0.005);
    const tip = chestPoint(rig, mesh, sx * 0.05, neckY - 0.06);
    const outer = chestPoint(rig, mesh, sx * 0.07, neckY - 0.005);
    if (!inner || !tip || !outer) continue;
    const lift = new THREE.Vector3(0, 0, 0.006);
    const geo = new THREE.BufferGeometry().setFromPoints([inner.add(lift), tip.add(lift), outer.add(lift)]);
    geo.computeVertexNormals();
    group.add(new THREE.Mesh(geo, fabric));
  }

  // Everything above was built in character-root space; hand it to the spine bone.
  group.traverse((o) => (o.castShadow = o.isMesh));
  root.add(group);
  spine.attach(group);
}

export function applyOutfit(rig, outfit) {
  rig.root.updateMatrixWorld(true);
  rig.model.traverse((o) => {
    if (!o.isMesh) return;
    const mat = o.material;
    if (outfit.colors && mat.map) mat.map = recolourTexture(mat.map, outfit.colors);
    // The FBX conversion left the clothes slightly metallic; fabric isn't.
    mat.metalness = 0;
    mat.roughness = 0.85;
    mat.needsUpdate = true;
  });
  if (outfit.collar) {
    addCollar(rig, outfit.collar);
    addPoloFront(rig, outfit.collar);
  }
  if (outfit.wellies) addWellies(rig, outfit.wellies);
}
