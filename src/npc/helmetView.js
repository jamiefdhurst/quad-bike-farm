import * as THREE from 'three';
import { buildHelmet } from './helmetModel.js';

// The helmets as you see them: one on each girl's head bone (shown while she wears it, tipped back on the head when she is on foot and
// has the goggles-up sort), and the loose ones lying on a seat or on the ground where npc/headgear.js says. Pure state lives there; this is
// only Three.js.

const _v = new THREE.Vector3();
const RIM_BELOW_CROWN = 0.105; // metres from the top of her head to the helmet's rim

/** Sorted values' percentile. */
function pct(values, q) {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
}

/**
 * Where a girl's head is, in her root's frame (metres): the top of her head, its width and its middle, from the vertices her Head bone
 * moves most. Her ponytail or fringe is left out by measuring the band just under the crown and ignoring the outliers.
 */
export function measureHead(rig) {
  rig.model.updateMatrixWorld(true);
  const pts = [];
  rig.model.traverse((o) => {
    if (!o.isSkinnedMesh || !o.skeleton) return;
    o.skeleton.update();
    const idx = o.geometry.attributes.skinIndex;
    const wt = o.geometry.attributes.skinWeight;
    if (!idx || !wt) return;
    for (let i = 0; i < idx.count; i++) {
      let best = 0;
      for (let k = 1; k < 4; k++) if (wt.getComponent(i, k) > wt.getComponent(i, best)) best = k;
      if (o.skeleton.bones[idx.getComponent(i, best)]?.name !== 'Head') continue;
      o.getVertexPosition(i, _v);
      pts.push(rig.root.worldToLocal(o.localToWorld(_v.clone())));
    }
  });
  if (!pts.length) return null;
  const top = pct(pts.map((p) => p.y), 0.995);
  const band = pts.filter((p) => p.y > top - 0.09);
  const xs = band.map((p) => p.x);
  const zs = band.map((p) => p.z);
  // The skull's axis is the Head bone's, not the middle of the hair (a bob or a ponytail pulls that backwards).
  const axis = rig.root.worldToLocal(rig.bones.Head.getWorldPosition(new THREE.Vector3()));
  return {
    top,
    x: axis.x,
    z: axis.z,
    width: pct(xs, 0.95) - pct(xs, 0.05),
    depth: pct(zs, 0.95) - pct(zs, 0.05),
  };
}

export class HelmetView {
  /** `heightAt(x, z)`: the ground. */
  constructor(scene, heightAt) {
    this.scene = scene;
    this.heightAt = heightAt;
    this.worn = {}; // girl id -> { holder, inner, helmet }
    this.loose = {}; // girl id -> a helmet lying about
  }

  /** Puts a helmet on her head bone (hidden until she wears it), sized to her measured head; `setFit` sizes and lifts it from there. */
  dress(c) {
    const id = c.character.id;
    const rig = c.rig;
    const head = measureHead(rig);
    const bone = rig.bones.Head;
    if (!head || !bone) return false;
    const helmet = buildHelmet(id);
    const size = helmet.userData.size;
    const s = Math.max(head.width / (size.radius * 2), head.depth / (size.depth * 2));
    const holder = new THREE.Group(); // at the rim, in the root's orientation when attached, so the tilt below is about the root's axes
    const inner = new THREE.Group();
    inner.add(helmet);
    holder.add(inner);
    helmet.scale.setScalar(s);
    // The rim sits about at brow height, a hand's breadth under the crown (`lift` moves it from there).
    holder.position.set(head.x, head.top - RIM_BELOW_CROWN, head.z);
    rig.root.add(holder);
    bone.attach(holder);
    holder.visible = false;
    this.worn[id] = { holder, inner, helmet, s, size, rig, fit: 1, lift: 0 };
    return true;
  }

  /** The girl's helmet on her head or off it; `tipBack` pushes it up on the back of her head (on foot, the lazy way). `fit` (a multiple of
   * the size measured from her head, to clear her hair) and `lift` (metres up) come from the tuning panel. */
  setWorn(id, on, tipBack = false, fit = 1, lift = 0) {
    const w = this.worn[id];
    if (!w) return;
    w.holder.visible = on;
    if (!on) return;
    w.helmet.scale.setScalar(w.s * fit);
    const target = tipBack ? 1 : 0;
    w.inner.rotation.x = THREE.MathUtils.lerp(w.inner.rotation.x, -0.18 * target, 0.2);
    w.inner.position.y = lift + THREE.MathUtils.lerp(w.inner.position.y - (w.lift ?? 0), 0.01 * target, 0.2);
    w.lift = lift;
    w.inner.position.z = THREE.MathUtils.lerp(w.inner.position.z, -0.015 * target, 0.2);
  }

  /** The loose helmet for a girl: on the ground at (x, z), on a vehicle's seat (a Three.js group and a local position) or not there (null). */
  setLoose(id, where) {
    let m = this.loose[id];
    if (!where) {
      if (m) m.visible = false;
      return;
    }
    if (!m) {
      m = this.loose[id] = buildHelmet(id);
      m.userData.where = null;
    }
    const key = where.parent ? `seat:${where.parent.uuid}` : `ground:${where.x.toFixed(2)},${where.z.toFixed(2)}`;
    if (m.userData.where !== key) {
      m.userData.where = key;
      if (where.parent) {
        where.parent.add(m);
        m.position.copy(where.local);
        m.rotation.set(0, where.yaw ?? 0, 0);
      } else {
        this.scene.add(m);
        // On its side on the grass, the rim towards a random way.
        m.position.set(where.x, this.heightAt(where.x, where.z) + 0.1, where.z);
        m.rotation.set(Math.PI / 2 + 0.3, (where.x * 7.1 + where.z * 3.3) % (Math.PI * 2), 0);
      }
    }
    m.visible = true;
  }
}
