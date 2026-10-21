import * as THREE from 'three';
import { SPLITTER } from '../vehicle/tractorModel.js';
import { STACK_SHAPE, stackSlot } from './logSplitter.js';

// The rounds, the split logs and the stack they go in (items/logSplitter.js is the logic). A round is a short length of trunk lying where the
// piles are; carry one at a time like the brushwood, put it on the splitter's beam, and the logs it makes lie on the ground to be carried to
// the stack. Drawn and held here; nothing in this file decides anything.

const bark = new THREE.MeshStandardMaterial({ color: 0x4d3a28, roughness: 0.95 });
const barkPale = new THREE.MeshStandardMaterial({ color: 0x6a5238, roughness: 0.95 });
const heart = new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 0.85 }); // the cut face, fresh wood

export const ROUND = { radius: 0.15, height: 0.3 };
export const LOG = { radius: 0.15, length: STACK_SHAPE.logLength };

/** A round: a short bit of trunk, bark all round and a pale cut face at each end with a ring or two. */
export function buildRound(random = Math.random) {
  const g = new THREE.Group();
  g.name = 'woodRound';
  const r = ROUND.radius * (0.9 + random() * 0.2);
  const side = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.03, ROUND.height, 14, 1, true), random() < 0.5 ? bark : barkPale);
  g.add(side);
  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.CircleGeometry(r * 1.01, 14), heart);
    cap.rotation.x = -s * Math.PI / 2;
    cap.position.y = s * (ROUND.height / 2 + 0.001);
    g.add(cap);
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.45, r * 0.5, 14), bark);
    ring.rotation.x = -s * Math.PI / 2;
    ring.position.y = s * (ROUND.height / 2 + 0.002);
    g.add(ring);
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  return g;
}

/** The geometry of one split log: half a round, lying with its flat face up and its length along z. Shared by the logs and the stack. */
export function logGeometry() {
  const r = LOG.radius * 0.95;
  const half = new THREE.CylinderGeometry(r, r, LOG.length, 10, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(-Math.PI / 2); // curved side down, flat face at y 0, length along z
  const face = new THREE.PlaneGeometry(r * 2, LOG.length).rotateX(-Math.PI / 2);
  return { half, face };
}

/** One split log as a mesh group: the bark side and the pale flat face. */
export function buildLog() {
  const { half, face } = logGeometry();
  const g = new THREE.Group();
  g.name = 'woodLog';
  g.add(new THREE.Mesh(half, bark), new THREE.Mesh(face, heart));
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  return g;
}

/** A round or a log you can pick up (E), carry (low across the camera, as the brushwood is), put down (G), put on the beam or add to the stack. */
export class WoodPiece {
  constructor({ scene, world, kind, x = 0, z = 0, yaw = 0, gnarled = false, random = Math.random }) {
    this.scene = scene;
    this.world = world;
    this.kind = kind;
    this.gnarled = gnarled;
    this.model = kind === 'round' ? buildRound(random) : buildLog();
    this.home = { x, z, yaw };
    this.state = 'hidden'; // 'ground' | 'held' | 'beam' | 'hidden'
    const w = kind === 'round' ? ROUND.radius * 2.4 : LOG.length * 1.4;
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(w, 0.45, w), new THREE.MeshBasicMaterial({ visible: false }));
    this.model.add(this.proxy);
    this.hide();
  }

  get held() {
    return this.state === 'held';
  }

  get onGround() {
    return this.state === 'ground';
  }

  /** Lies on the ground at `position` ({ x, z }). A round stands on its end, a log lies on its curved side. */
  putDown(position, yaw = 0) {
    this.state = 'ground';
    this.scene.add(this.model);
    const lift = this.kind === 'round' ? ROUND.height / 2 : LOG.radius * 0.95;
    this.model.position.set(position.x, this.world.heightAt(position.x, position.z) + lift, position.z);
    this.model.rotation.set(0, yaw, 0);
    this.proxy.position.y = 0.1;
  }

  /** Carried low in front of you, across the body. */
  pickUp(camera) {
    this.state = 'held';
    camera.add(this.model);
    this.model.position.set(0.12, -0.5, -0.75);
    this.model.rotation.set(this.kind === 'round' ? 0.1 : 0.05, 0.6, this.kind === 'round' ? 0.15 : 0);
  }

  /** Stands on the splitter's beam (a child of the tractor's model, which carries it about). */
  putOnBeam(tractorModel) {
    this.state = 'beam';
    tractorModel.add(this.model);
    this.model.position.set(0, SPLITTER.roundY, SPLITTER.roundZ);
    this.model.rotation.set(0, 0, 0);
  }

  /** Gone from the hand and the ground (stacked, split, or not dealt yet). */
  hide() {
    this.state = 'hidden';
    this.model.removeFromParent();
  }

  /** Back where it began (a round) or out of the way (a log). */
  reset() {
    if (this.kind === 'round') this.putDown(this.home, this.home.yaw);
    else this.hide();
  }

  worldPosition() {
    return this.model.getWorldPosition(new THREE.Vector3());
  }
}

/** The logs in the stack: one instanced mesh, `count` of its slots shown, laid out by stackSlot() from the stack's place and yaw. */
export class StackView {
  constructor({ scene, heightAt, site, capacity }) {
    this.site = site;
    this.heightAt = heightAt;
    const { half } = logGeometry();
    this.mesh = new THREE.InstancedMesh(half, bark, capacity);
    this.face = new THREE.InstancedMesh(logGeometry().face, heart, capacity);
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.face.receiveShadow = true;
    this.group = new THREE.Group();
    this.group.name = 'logStack';
    this.group.add(this.mesh, this.face);
    this.group.position.set(site.x, heightAt(site.x, site.z), site.z);
    this.group.rotation.y = site.yaw;
    // Two posts at the ends so it reads as a stack and not a heap, and the box that is looked at to add to it.
    const post = new THREE.MeshStandardMaterial({ color: 0x5a5148, roughness: 0.9 });
    const half_ = (STACK_SHAPE.perLayer * STACK_SHAPE.spacing) / 2 + 0.1;
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), post);
      p.position.set(s * half_, 0.55, 0);
      p.castShadow = true;
      this.group.add(p);
    }
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(half_ * 2 + 0.3, 1.2, 0.8), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.y = 0.6;
    this.group.add(this.proxy);
    scene.add(this.group);
    this.set(0);
  }

  /** Shows the first `count` slots. */
  set(count) {
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const s = stackSlot(i);
      m.makeTranslation(s.x, s.y + LOG.radius * 0.95, s.z); // the origin is the flat face, so the curved side hangs below it
      this.mesh.setMatrixAt(i, m);
      this.face.setMatrixAt(i, m);
    }
    this.mesh.count = count;
    this.face.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.face.instanceMatrix.needsUpdate = true;
  }

  /** The world position of slot `index` (where a carried log is placed). */
  slotWorld(index) {
    const s = stackSlot(index);
    const c = Math.cos(this.site.yaw);
    const n = Math.sin(this.site.yaw);
    return { x: this.site.x + s.x * c + s.z * n, z: this.site.z - s.x * n + s.z * c };
  }
}
