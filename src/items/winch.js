import * as THREE from 'three';

// The green quad's front winch, working. Take the hook off it (X, beside the
// green), walk the cable to a quad and hook it on (E), then hold X near the
// green (its remote is on a lead) or sitting on it to wind in: the cable
// shortens and pulls the hooked quad towards the green, out of a bog if it's
// stuck. E on the hooked quad unhooks it; X while carrying the hook puts it back.
// The cable only reaches so far, and pulls out of your hand beyond that.

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

    this.points = new Float32Array(SAG_POINTS * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.points, 3).setUsage(THREE.DynamicDrawUsage));
    this.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x2a2a2a }));
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

  take(camera) {
    if (this.state !== 'stowed') return;
    this.state = 'carried';
    camera.add(this.handHook);
    if (this.hookMesh) this.hookMesh.visible = false;
    this.line.visible = true;
  }

  stow() {
    this.handHook.removeFromParent();
    if (this.target) this.target.towed = false;
    this.state = 'stowed';
    this.target = null;
    this.reeling = false;
    this.tight = false;
    if (this.hookMesh) this.hookMesh.visible = true;
    this.line.visible = false;
  }

  hookOn(quad) {
    if (this.state !== 'carried' || quad === this.quad) return false;
    this.handHook.removeFromParent();
    this.state = 'hooked';
    this.target = quad;
    this.target.towed = true; // its brakes off while it's winched
    this.cable = Math.min(this.params.length, this.leadPosition().distanceTo(this.hookPoint(quad)) + 0.3);
    return true;
  }

  /** Off the quad and back in your hand. */
  unhook(camera) {
    if (this.state !== 'hooked') return;
    this.target.towed = false;
    this.target = null;
    this.reeling = false;
    this.state = 'carried';
    camera.add(this.handHook);
  }

  /** How far you are from where the cable comes out. */
  distanceFrom(position) {
    return this.leadPosition(new THREE.Vector3()).distanceTo(position);
  }

  /**
   * Each fixed step: wind in if asked, and pull the hooked quad along the cable
   * once it's tight (a stiff spring, never more than maxPull, never pushing).
   */
  fixedUpdate(dt, reel) {
    if (this.state !== 'hooked') {
      this.tight = false;
      return;
    }
    const p = this.params;
    const lead = this.leadPosition();
    const end = this.hookPoint(this.target);
    const dist = lead.distanceTo(end);
    this.reeling = reel && dist > p.stopAt;
    if (this.reeling) this.cable = Math.max(p.stopAt, this.cable - p.reelSpeed * dt);
    const stretch = dist - this.cable;
    this.tight = stretch > 0;
    if (!this.tight) return;
    const pull = Math.min(p.maxPull, stretch * p.stiffness);
    const dir = lead.clone().sub(end).normalize();
    this.target.physics.body.applyImpulseAtPoint({ x: dir.x * pull * dt, y: dir.y * pull * dt, z: dir.z * pull * dt }, { x: end.x, y: end.y, z: end.z }, true);
    // Never let it run further out than the cable allows (e.g. rolling back down a slope).
    if (stretch > 1) this.cable = dist - 1;
  }

  /** Each frame: the cable from the green to your hand or the hooked quad, sagging when slack. */
  update(hand) {
    if (this.state === 'stowed') return;
    const a = this.leadPosition();
    const b = this.state === 'hooked' ? this.hookPoint(this.target) : this.handHook.getWorldPosition(this.to);
    const span = a.distanceTo(b);
    const slack = this.state === 'hooked' ? Math.max(0, this.cable - span) : Math.max(0.3, span * 0.15);
    const sag = this.tight ? 0 : Math.min(1.2, slack * 0.5 + 0.1);
    for (let i = 0; i < SAG_POINTS; i++) {
      const t = i / (SAG_POINTS - 1);
      const y = a.y + (b.y - a.y) * t - Math.sin(Math.PI * t) * sag;
      this.points.set([a.x + (b.x - a.x) * t, y, a.z + (b.z - a.z) * t], i * 3);
    }
    this.line.geometry.attributes.position.needsUpdate = true;
  }
}
