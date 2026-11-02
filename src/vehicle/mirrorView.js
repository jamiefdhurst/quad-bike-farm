import * as THREE from 'three';

// Working mirrors (#61, was TODO 166). A glass is any mesh a vehicle's model names 'mirrorGlass' (its face looking back, along -Z).
// While you drive that vehicle, and look forward, a camera at each glass renders the world behind it, one mirror a pass, into a small
// texture laid over the glass. Every other vehicle keeps its dull static glass.

export const DEFAULT_MIRROR_PARAMS = {
  enabled: 1, // 1 draws the mirrors, 0 leaves the glass dull
  size: 160, // pixels across a glass's picture; the height follows the glass's shape
  every: 2, // a mirror is drawn on every this-many'th frame (one mirror a time, in turn); more is cheaper and choppier
  range: 120, // how far behind a mirror sees, in metres
  sideFov: 42, // degrees, top to bottom, of a door or wing mirror's picture
  interiorFov: 34, // and of the rear-view mirror's
  sideYaw: 9, // degrees a door or wing mirror looks outwards of straight back
  lookAngle: 75, // the mirrors are drawn only while you look within this many degrees of straight ahead
};

export const MIRROR_PARAM_RANGES = {
  enabled: [0, 1, 1],
  size: [64, 384, 16],
  every: [1, 8, 1],
  range: [30, 300, 10],
  sideFov: [20, 80, 1],
  interiorFov: [15, 70, 1],
  sideYaw: [0, 25, 1],
  lookAngle: [30, 120, 5],
};

/** The picture's size in pixels for a glass `w` by `h` metres, `size` across: kept in a sensible shape so a tall thin glass isn't huge. */
export function mirrorPictureSize(w, h, size) {
  const width = Math.max(16, Math.round(size));
  const height = Math.max(16, Math.min(width * 2, Math.round((width * h) / Math.max(w, 1e-6))));
  return [width, height];
}

/** A glass near the middle of the vehicle is the rear-view mirror; otherwise a door or wing mirror on the side `x` is on (+1 is +X). */
export function mirrorKind(localX) {
  if (Math.abs(localX) < 0.2) return { kind: 'interior', side: 0 };
  return { kind: 'side', side: localX > 0 ? 1 : -1 };
}

/** How far a mirror looks round from straight back, in radians (about Y; positive turns the view from -Z towards -X). */
export function mirrorYaw(kind, side, p = DEFAULT_MIRROR_PARAMS) {
  return kind === 'side' ? -side * THREE.MathUtils.degToRad(p.sideYaw) : 0;
}

/** True while the view (x, z) is within `maxDeg` of straight ahead (x, z) of the vehicle: you can't see a mirror from behind your head. */
export function lookingForward(view, ahead, maxDeg) {
  const vl = Math.hypot(view.x, view.z);
  const al = Math.hypot(ahead.x, ahead.z);
  if (vl < 1e-6 || al < 1e-6) return false;
  const cos = (view.x * ahead.x + view.z * ahead.z) / (vl * al);
  return cos >= Math.cos(THREE.MathUtils.degToRad(maxDeg));
}

/** Whether a point in the vehicle's own frame is inside its footprint (someone sat in it), `half` its half width and length in metres. */
export function insideFootprint(local, half) {
  return Math.abs(local.x) <= half.x && Math.abs(local.z) <= half.z;
}

/** Whether the mirrors are drawn on this frame, and which one (of `count`, in turn); null when none. */
export function mirrorTurn(frame, every, count) {
  if (count <= 0 || every < 1 || frame % every !== 0) return null;
  return Math.floor(frame / every) % count;
}

const _pos = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qYaw = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _box = new THREE.Box3();

export class MirrorView {
  /** `model` is the vehicle's model; its meshes named 'mirrorGlass' each get a live picture over their back face. */
  constructor(model, params = { ...DEFAULT_MIRROR_PARAMS }) {
    this.model = model;
    this.params = params;
    this.glasses = [];
    this.live = false;
    model.updateWorldMatrix(true, true);
    const inverse = new THREE.Matrix4().copy(model.matrixWorld).invert();
    model.traverse((o) => {
      if (o.name !== 'mirrorGlass' || !o.isMesh) return;
      _box.setFromObject(o).applyMatrix4(inverse);
      const { kind, side } = mirrorKind((_box.min.x + _box.max.x) / 2);
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox;
      const w = b.max.x - b.min.x;
      const h = b.max.y - b.min.y;
      // The picture is a plane just behind the glass's back face, on the glass mesh itself so it follows a swinging door. Turned to face
      // back, its u runs the way the camera looking back sees it, which is a mirror's picture: what is on your left behind you is on its left.
      const geo = new THREE.PlaneGeometry(w * 0.94, h * 0.9).rotateY(Math.PI);
      const mat = new THREE.MeshBasicMaterial({ color: 0xdfe6e6, toneMapped: true }); // shows a picture of the lit world, like a screen
      const plane = new THREE.Mesh(geo, mat);
      plane.name = 'mirrorPicture';
      plane.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, b.min.z - 0.0008);
      plane.visible = false;
      o.add(plane);
      this.glasses.push({ glass: o, plane, mat, kind, side, w, h, target: null, drawn: false });
    });
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.25, params.range);
  }

  get count() {
    return this.glasses.length;
  }

  /** Shows the pictures (while you drive this vehicle and look ahead) or the dull glass again. */
  setLive(on) {
    this.live = on;
    for (const g of this.glasses) g.plane.visible = on && g.drawn;
  }

  /** Draws the `index`th mirror's view. `hidden` are objects left out of the picture (the vehicle's own model and anyone sat in it). */
  render(renderer, scene, index, hidden) {
    const g = this.glasses[index];
    if (!g) return;
    const p = this.params;
    const [pw, ph] = mirrorPictureSize(g.w, g.h, p.size);
    if (!g.target || g.target.width !== pw || g.target.height !== ph) {
      g.target?.dispose();
      g.target = new THREE.WebGLRenderTarget(pw, ph, { depthBuffer: true });
      g.mat.map = g.target.texture;
      g.mat.needsUpdate = true;
    }
    const cam = this.camera;
    cam.aspect = pw / ph;
    cam.fov = g.kind === 'interior' ? p.interiorFov : p.sideFov;
    cam.far = p.range;
    cam.updateProjectionMatrix();
    // At the glass, looking back along the vehicle (its -Z), turned outwards a little for a door or wing mirror.
    g.plane.getWorldPosition(_pos);
    this.model.getWorldQuaternion(_q);
    _qYaw.setFromAxisAngle(_up, mirrorYaw(g.kind, g.side, p));
    cam.quaternion.copy(_q).multiply(_qYaw);
    cam.position.copy(_pos);
    cam.updateMatrixWorld(true);

    const was = hidden.map((o) => o.visible);
    for (const o of hidden) o.visible = false;
    g.plane.visible = false; // never looks at its own picture
    const previous = renderer.getRenderTarget();
    const shadows = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false; // the sun's shadows as the last full frame drew them
    renderer.setRenderTarget(g.target);
    renderer.render(scene, cam);
    renderer.setRenderTarget(previous);
    renderer.shadowMap.autoUpdate = shadows;
    hidden.forEach((o, i) => (o.visible = was[i]));
    g.drawn = true;
    g.plane.visible = this.live;
  }

  dispose() {
    for (const g of this.glasses) {
      g.target?.dispose();
      g.mat.dispose();
      g.plane.geometry.dispose();
      g.plane.removeFromParent();
    }
    this.glasses.length = 0;
  }
}
