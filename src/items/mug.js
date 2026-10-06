import * as THREE from 'three';

// Mugs of tea (npc/tea.js): the one a girl leaves on a quad's rear rack, and the same one lying on the ground, with a
// tea stain, once it has fallen off. Just something to look at: no collider, so nothing knocks it over but the
// quad moving off.

const GRAVITY = 9.81;
const STAINS_MAX = 6;

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

export class Mugs {
  constructor(scene, heightAt, stainFor = 60) {
    this.scene = scene;
    this.heightAt = heightAt;
    this.stainFor = stainFor;
    this.falling = []; // { mug, vel, spin }
    this.stains = []; // { mesh, left, mug }
    this.stainMat = new THREE.MeshStandardMaterial({ color: 0x4a2b14, roughness: 0.2, transparent: true, opacity: 0.8, depthWrite: false });
  }

  /** A mug on this quad's rear rack, if it has a place for one. Returns the mug, or null. */
  put(quad, colour) {
    const anchor = quad.mugAnchor;
    if (!anchor) return null;
    const mug = buildMug(colour);
    anchor.add(mug);
    return mug;
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
