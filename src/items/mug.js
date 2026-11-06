import * as THREE from 'three';
import { wispOffset, steamLean } from '../npc/steam.js';

// Mugs of tea (npc/tea.js): the one a girl leaves on a quad's rear rack, and the same one lying on the ground, with a
// tea stain, once it has fallen off. Just something to look at: no collider, so nothing knocks it over but the
// quad moving off.

const GRAVITY = 9.81;
const STAINS_MAX = 6;
const PUFFS = 9; // soft dots in a wisp
const WISP_HEIGHT = 0.2; // metres from the lip to the top of the wisp
const WISP_SECONDS = 2.4; // seconds for a puff to rise that far
const LIP = 0.09; // the height of a mug's lip (buildMug)

let _dot = null;
/** A soft white dot for a puff of steam. */
function dotTexture() {
  if (_dot) return _dot;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  _dot = new THREE.CanvasTexture(c);
  return _dot;
}

const _p = new THREE.Vector3();

function buildMug(colour) {
  const g = new THREE.Group();
  g.name = 'mug';
  const china = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.35 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.034, 0.09, 16), china);
  body.position.y = 0.045;
  const tea = new THREE.Mesh(new THREE.CircleGeometry(0.033, 16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6b3d1c, roughness: 0.15 }));
  tea.position.y = 0.083;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 8, 14, Math.PI), china);
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(0.04, 0.047, 0);
  for (const m of [body, tea, handle]) {
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

/** The flask's cup lid, steel, with tea in it, used as a mug. */
function buildFlaskCup() {
  const g = new THREE.Group();
  g.name = 'flaskCup';
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.3, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.044, 0.07, 16, 1, true), steel);
  body.position.y = 0.035;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.003, 6, 18).rotateX(Math.PI / 2), steel);
  rim.position.y = 0.07;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.044, 16).rotateX(-Math.PI / 2), steel);
  floor.position.y = 0.003;
  const tea = new THREE.Mesh(new THREE.CircleGeometry(0.044, 16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6b3d1c, roughness: 0.15 }));
  tea.position.y = 0.06;
  for (const m of [body, rim, floor, tea]) {
    m.castShadow = true;
    g.add(m);
  }
  g.userData.lip = 0.07;
  return g;
}

/** A tartan-green vacuum flask, its cup off, standing on a rock (npc/flask.js). */
function buildFlask() {
  const g = new THREE.Group();
  g.name = 'flask';
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 16), new THREE.MeshStandardMaterial({ color: 0x2f6b45, roughness: 0.5 }));
  body.position.y = 0.11;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 16), new THREE.MeshStandardMaterial({ color: 0x1c1f22, roughness: 0.6 }));
  neck.position.y = 0.235;
  for (const m of [body, neck]) {
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

export class Mugs {
  constructor(scene, heightAt, stainFor = 60) {
    this.scene = scene;
    this.heightAt = heightAt;
    this.stainFor = stainFor;
    this.wisps = new Map(); // mug -> { points, amount, t, phase }, the steam off its tea
    this.falling = []; // { mug, vel, spin }
    this.stains = []; // { mesh, left, mug }
    this.stainMat = new THREE.MeshStandardMaterial({ color: 0x4a2b14, roughness: 0.2, transparent: true, opacity: 0.8, depthWrite: false });
  }

  /** A new mug in the scene, for a girl to carry. */
  make(colour) {
    const mug = buildMug(colour);
    this.scene.add(mug);
    return mug;
  }

  /** The flask's cup, as a mug on the ground. */
  makeFlaskCup() {
    const cup = buildFlaskCup();
    this.scene.add(cup);
    return cup;
  }

  /**
   * How much this mug steams, 0..1 (0 for none): a wisp rises from the lip of its tea, bent downwind. The caller says it each frame from how
   * hot the tea is (npc/steam.js); the wisp goes when the mug leaves the scene.
   */
  setSteam(mug, amount) {
    if (!mug) return;
    let w = this.wisps.get(mug);
    if (!w) {
      if (amount <= 0.01) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PUFFS * 3), 3));
      const mat = new THREE.PointsMaterial({ map: dotTexture(), size: 0.05, transparent: true, depthWrite: false, opacity: 0, sizeAttenuation: true });
      const points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      points.name = 'steam';
      this.scene.add(points);
      w = { points, amount: 0, t: Math.random() * 10, phase: Math.random() * 6 };
      this.wisps.set(mug, w);
    }
    w.amount = amount;
  }

  /** Moves every wisp: up from its mug's lip, leaning with the wind `{ x, z }`. */
  updateSteam(dt, wind) {
    const lean = steamLean(wind);
    for (const [mug, w] of this.wisps) {
      if (!this.inScene(mug)) {
        this.scene.remove(w.points);
        w.points.geometry.dispose();
        w.points.material.dispose();
        this.wisps.delete(mug);
        continue;
      }
      w.t += dt;
      w.points.material.opacity = Math.min(0.55, w.amount * 0.6);
      w.points.material.size = 0.035 + 0.03 * w.amount;
      w.points.visible = w.amount > 0.01;
      if (!w.points.visible) continue;
      mug.getWorldPosition(_p);
      const lip = mug.userData.lip ?? LIP;
      const pos = w.points.geometry.attributes.position;
      for (let i = 0; i < PUFFS; i++) {
        const rise = ((w.t / WISP_SECONDS + i / PUFFS) % 1);
        const o = wispOffset(rise, w.phase, w.t, lean, WISP_HEIGHT * (0.6 + 0.4 * w.amount));
        pos.setXYZ(i, _p.x + o.x, _p.y + lip + 0.01 + o.y, _p.z + o.z);
      }
      pos.needsUpdate = true;
    }
  }

  inScene(obj) {
    let o = obj;
    while (o.parent) o = o.parent;
    return o === this.scene;
  }

  /** A flask in the scene, for a girl to set down. */
  makeFlask() {
    const flask = buildFlask();
    this.scene.add(flask);
    return flask;
  }

  /** A mug on this quad's rear rack, if it has a place for one. Returns the mug, or null. */
  put(quad, colour) {
    const anchor = quad.mugAnchor;
    if (!anchor) return null;
    const mug = buildMug(colour);
    anchor.add(mug);
    return mug;
  }

  /** A mug she has been carrying, set down on this quad's rack. */
  putMug(quad, mug) {
    const anchor = quad.mugAnchor;
    if (!anchor) return false;
    anchor.add(mug);
    mug.position.set(0, 0, 0);
    mug.rotation.set(0, 0, 0);
    return true;
  }

  /** Takes it off the rack (someone picked it up). */
  remove(mug) {
    mug?.parent?.remove(mug);
  }

  /** It falls off the back of the quad, which is moving at `velocity` (world, m/s). */
  drop(mug, velocity) {
    if (!mug) return;
    const pos = new THREE.Vector3();
    mug.getWorldPosition(pos);
    this.setSteam(mug, 0); // the tea is spilt
    mug.parent?.remove(mug);
    mug.position.copy(pos);
    mug.rotation.set(0, Math.random() * Math.PI * 2, 0);
    this.scene.add(mug);
    this.falling.push({ mug, vel: new THREE.Vector3(velocity.x * 0.5 + (Math.random() - 0.5), 1 + Math.random(), velocity.z * 0.5 + (Math.random() - 0.5)), spin: (Math.random() - 0.5) * 8 });
  }

  update(dt) {
    for (const f of [...this.falling]) {
      const m = f.mug;
      f.vel.y -= GRAVITY * dt;
      m.position.addScaledVector(f.vel, dt);
      m.rotation.z += f.spin * dt;
      const ground = this.heightAt(m.position.x, m.position.z);
      if (m.position.y <= ground + 0.04) {
        // Down on its side, with tea spread under it.
        m.position.y = ground + 0.035;
        m.rotation.set(0, m.rotation.y, Math.PI / 2);
        this.falling = this.falling.filter((x) => x !== f);
        const stain = new THREE.Mesh(new THREE.CircleGeometry(0.28, 20).rotateX(-Math.PI / 2), this.stainMat);
        stain.position.set(m.position.x, ground + 0.015, m.position.z);
        stain.scale.set(1, 1, 0.7);
        this.scene.add(stain);
        this.stains.push({ mesh: stain, left: this.stainFor, mug: m });
        if (this.stains.length > STAINS_MAX) this.clear(this.stains[0]);
      }
    }
    for (const s of [...this.stains]) if ((s.left -= dt) <= 0) this.clear(s);
  }

  clear(s) {
    this.scene.remove(s.mesh);
    this.scene.remove(s.mug);
    this.stains = this.stains.filter((x) => x !== s);
  }
}
