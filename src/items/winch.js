import * as THREE from 'three';
import { isHeavy, trunkHookPoint, cableLoad, creakGap } from './winchAnchor.js';

// The green quad's front winch, working. Take the hook off it (X, beside the
// green), walk the cable to a quad and hook it on (E), then hold X near the
// green (its remote is on a lead) or sitting on it to wind in: the cable
// shortens and pulls the hooked quad towards the green, out of a bog if it's
// stuck. E on the hooked quad unhooks it; X while carrying the hook puts it back.
// The cable only reaches so far, and pulls out of your hand beyond that.
// The hook also goes on a tree or on a heavy vehicle (the tractor, a car, a Land Rover, the UTV): those stay put and the green winds itself up to
// them instead, out of a bog or up a bank with its engine dead.

export const DEFAULT_WINCH_PARAMS = {
  length: 30, // metres of cable
  reelSpeed: 0.9, // m/s winding in
  maxPull: 6500, // newtons at most
  stiffness: 9000, // newtons per metre of stretch once it's tight
  remoteReach: 6, // metres from the green you can work the remote
  stopAt: 2.6, // metres from the fairlead it stops winding
};

export const WINCH_PARAM_RANGES = {
  length: [5, 60, 0.5],
  reelSpeed: [0.1, 3, 0.05],
  maxPull: [500, 20000, 100],
  stiffness: [500, 40000, 500],
  remoteReach: [1, 20, 0.5],
  stopAt: [1, 6, 0.1],
};

const SAG_POINTS = 18;
const ROPE_SIDES = 5;
const ROPE_RADIUS = 0.011; // metres: a 22 mm rope, thick enough to see taut

export class Winch {
  /** @param {object} opts.unit  The quad unit it's mounted on (the green). */
  constructor({ scene, unit, params = { ...DEFAULT_WINCH_PARAMS } }) {
    this.scene = scene;
    this.unit = unit;
    this.params = params;
    this.fairlead = unit.quad.model.getObjectByName('winchFairlead');
    this.hookMesh = unit.quad.model.getObjectByName('winchHook');
    this.state = 'stowed'; // 'stowed', 'carried' (in your hand) or 'hooked' (on a quad)
    this.target = null; // the quad it's hooked to
    this.cable = 0; // metres paid out, while hooked
    this.reeling = false;
    this.tight = false;

    // A hook in your left hand while you carry it.
    this.handHook = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 12, Math.PI * 1.5), new THREE.MeshStandardMaterial({ color: 0x9a9da0, metalness: 0.7, roughness: 0.4 }));
    this.handHook.position.set(-0.2, -0.22, -0.4);

    this.anchor = null; // the tree it's hooked to, if it's on a tree: { x, y, z, r }
    this.anchors = []; // every hookable trunk on the farm, from the world
    this.onCreak = null; // called with 0 to 1 when the cable groans under load
    this.creakIn = 0;
    this.load = 0;

    // The cable: a thin tube along a sagging curve, rewritten every frame while it's out.
    const verts = SAG_POINTS * ROPE_SIDES;
    const index = [];
    for (let i = 0; i < SAG_POINTS - 1; i++) {
      for (let j = 0; j < ROPE_SIDES; j++) {
        const a = i * ROPE_SIDES + j;
        const b = i * ROPE_SIDES + ((j + 1) % ROPE_SIDES);
        index.push(a, b, a + ROPE_SIDES, b, b + ROPE_SIDES, a + ROPE_SIDES);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(index);
    this.line = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x3a342c }));
    this.line.frustumCulled = false;
    this.line.visible = false;
    scene.add(this.line);

    this.from = new THREE.Vector3();
    this.to = new THREE.Vector3();
  }

  get quad() {
    return this.unit.quad;
  }

  /** Where the cable leaves the green. */
  leadPosition(out = this.from) {
    return this.fairlead.getWorldPosition(out);
  }

  /** The end of the hooked quad nearer the green, where the hook goes. */
  hookPoint(quad, out = this.to) {
    const lead = this.leadPosition(new THREE.Vector3());
    const front = quad.localToWorld(0, 0.45, 1.0);
    const back = quad.localToWorld(0, 0.45, -1.0);
    return out.copy(front.distanceTo(lead) < back.distanceTo(lead) ? front : back);
  }

  /** Where the cable ends: on the tree, or on the hooked vehicle. */
  endPoint(out = this.to) {
    if (this.anchor) {
      const p = trunkHookPoint(this.anchor, this.leadPosition(new THREE.Vector3()));
      return out.set(p.x, p.y, p.z);
    }
    return this.hookPoint(this.target, out);
  }

  /** On a tree or a heavy vehicle the green pulls itself up to the hook; on a light quad it drags that quad to the green. */
  get selfPull() {
    return !!this.anchor || (!!this.target && isHeavy(this.target.spec));
  }

  take(camera) {
    if (this.state !== 'stowed') return;
    this.state = 'carried';
    camera.add(this.handHook);
    if (this.hookMesh) this.hookMesh.visible = false;
    this.line.visible = true;
  }

  stow() {
    this.handHook.removeFromParent();
    this.release();
    this.state = 'stowed';
    if (this.hookMesh) this.hookMesh.visible = true;
    this.line.visible = false;
  }

  /** Lets go of whatever it's hooked to. */
  release() {
    if (this.target && !this.selfPull) this.target.towed = false;
    this.quad.towed = false;
    this.target = null;
    this.anchor = null;
    this.reeling = false;
    this.tight = false;
    this.load = 0;
  }

  hookOn(quad) {
    if (this.state !== 'carried' || quad === this.quad) return false;
    this.handHook.removeFromParent();
    this.state = 'hooked';
    this.target = quad;
    this.anchor = null;
    if (!isHeavy(quad.spec)) this.target.towed = true; // its brakes off while it's winched
    this.cable = Math.min(this.params.length, this.leadPosition().distanceTo(this.hookPoint(quad)) + 0.3);
    return true;
  }

  /** Hooks a tree (`{ x, y, z, r }` from the world's anchors): the green will pull itself up to it. */
  hookTree(anchor) {
    if (this.state !== 'carried') return false;
    this.handHook.removeFromParent();
    this.state = 'hooked';
    this.target = null;
    this.anchor = anchor;
    this.cable = Math.min(this.params.length, this.leadPosition().distanceTo(this.endPoint()) + 0.3);
    return true;
  }

  /** Off whatever it's on and back in your hand. */
  unhook(camera) {
    if (this.state !== 'hooked') return;
    this.release();
    this.state = 'carried';
    camera.add(this.handHook);
  }

  /** How far you are from where the cable comes out. */
  distanceFrom(position) {
    return this.leadPosition(new THREE.Vector3()).distanceTo(position);
  }

  /**
   * Each fixed step: wind in if asked, and pull along the cable once it's tight (a stiff spring, never more than maxPull, never pushing).
   * A light quad is dragged to the green; the green is pulled to a tree or a heavy vehicle, with its brakes off while the cable is tight.
   */
  fixedUpdate(dt, reel) {
    if (this.state !== 'hooked') {
      this.tight = false;
      this.load = 0;
      return;
    }
    const p = this.params;
    const lead = this.leadPosition();
    const end = this.endPoint();
    const dist = lead.distanceTo(end);
    this.reeling = reel && dist > p.stopAt;
    if (this.reeling) this.cable = Math.max(p.stopAt, this.cable - p.reelSpeed * dt);
    const stretch = dist - this.cable;
    this.tight = stretch > 0;
    this.quad.towed = this.selfPull && this.tight;
    if (!this.tight) {
      this.load = 0;
      return;
    }
    const pull = Math.min(p.maxPull, stretch * p.stiffness);
    this.load = cableLoad(pull, p.maxPull);
    const self = this.selfPull;
    const dir = (self ? end.clone().sub(lead) : lead.clone().sub(end)).normalize();
    const body = (self ? this.quad : this.target).physics.body;
    const at = self ? lead : end;
    body.applyImpulseAtPoint({ x: dir.x * pull * dt, y: dir.y * pull * dt, z: dir.z * pull * dt }, { x: at.x, y: at.y, z: at.z }, true);
    // Never let it run further out than the cable allows (e.g. rolling back down a slope).
    if (stretch > 1) this.cable = dist - 1;
  }

  /** Each frame: the cable from the green to your hand or what it's hooked to, sagging when slack and straight when taut; a groan under load. */
  update(dt = 0) {
    if (this.state === 'stowed') return;
    const a = this.leadPosition();
    const b = this.state === 'hooked' ? this.endPoint() : this.handHook.getWorldPosition(this.to);
    const span = a.distanceTo(b);
    const slack = this.state === 'hooked' ? Math.max(0, this.cable - span) : Math.max(0.3, span * 0.15);
    const sag = this.tight ? 0 : Math.min(1.2, slack * 0.5 + 0.1);
    this.writeRope(a, b, sag);

    this.creakIn -= dt;
    const gap = creakGap(this.load, this.reeling);
    if (gap === null) this.creakIn = Math.min(this.creakIn, 0.3);
    else if (this.creakIn <= 0) {
      this.creakIn = gap * (0.8 + Math.random() * 0.4);
      this.onCreak?.(this.load);
    }
  }

  /** The tube along a sagging line from a to b. */
  writeRope(a, b, sag) {
    const pos = this.line.geometry.attributes.position.array;
    // Two axes across the line, so the tube has a round section.
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    const fx = dx / len, fy = dy / len, fz = dz / len;
    let ux = 0, uy = 1, uz = 0;
    if (Math.abs(fy) > 0.95) { ux = 1; uy = 0; }
    // side = forward x up, then up' = side x forward
    let sx = fy * uz - fz * uy, sy = fz * ux - fx * uz, sz = fx * uy - fy * ux;
    const sl = Math.hypot(sx, sy, sz) || 1;
    sx /= sl; sy /= sl; sz /= sl;
    const vx = sy * fz - sz * fy, vy = sz * fx - sx * fz, vz = sx * fy - sy * fx;
    for (let i = 0; i < SAG_POINTS; i++) {
      const t = i / (SAG_POINTS - 1);
      const cx = a.x + dx * t;
      const cy = a.y + dy * t - Math.sin(Math.PI * t) * sag;
      const cz = a.z + dz * t;
      for (let j = 0; j < ROPE_SIDES; j++) {
        const ang = (j / ROPE_SIDES) * Math.PI * 2;
        const c = Math.cos(ang) * ROPE_RADIUS;
        const s = Math.sin(ang) * ROPE_RADIUS;
        pos.set([cx + sx * c + vx * s, cy + sy * c + vy * s, cz + sz * c + vz * s], (i * ROPE_SIDES + j) * 3);
      }
    }
    this.line.geometry.attributes.position.needsUpdate = true;
  }
}
