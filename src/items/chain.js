import * as THREE from 'three';

// The tractor's tow chain. Take it off the drawbar (X, looking at the tractor), walk the hook to a quad and hook it on (E), then drive
// off: the chain is short, with no winch, so the tractor has to back up to the quad and pull. It's strong enough for a quad sunk past
// what the green's winch can shift, and for towing a dead one home (a towed quad has its brakes off). E on the hooked quad unhooks it.

export const DEFAULT_CHAIN_PARAMS = {
  length: 5, // metres you can carry the hook from the drawbar
  stiffness: 40000, // newtons per metre of stretch once it's tight
  maxPull: 28000, // newtons at most: far more than the winch's 6500
  reaction: 0.25, // fraction of the pull that drags back on the tractor, which barely notices
};

export const CHAIN_PARAM_RANGES = {
  length: [2, 12, 0.5],
  stiffness: [2000, 100000, 1000],
  maxPull: [2000, 60000, 500],
  reaction: [0, 1, 0.05],
};

const SAG_POINTS = 14;

/** Newtons along the chain for this much stretch (never pushes, never more than maxPull). */
export function chainPull(stretch, p = DEFAULT_CHAIN_PARAMS) {
  return stretch > 0 ? Math.min(p.maxPull, stretch * p.stiffness) : 0;
}

export class Chain {
  /** @param {object} opts.tractor  The tractor's Quad; `anchor()` says where its drawbar pin is. */
  constructor({ scene, tractor, anchor, params = { ...DEFAULT_CHAIN_PARAMS } }) {
    this.tractor = tractor;
    this.anchorOf = anchor;
    this.params = params;
    this.state = 'stowed'; // 'stowed' on the drawbar, 'carried' in your hand or 'hooked' on a quad
    this.target = null;
    this.slack = 0; // metres of chain between the pin and the hook while hooked
    this.tight = false;

    this.handHook = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.01, 6, 12, Math.PI * 1.5), new THREE.MeshStandardMaterial({ color: 0x55585b, metalness: 0.8, roughness: 0.5 }));
    this.handHook.position.set(-0.2, -0.22, -0.4);

    this.points = new Float32Array(SAG_POINTS * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.points, 3).setUsage(THREE.DynamicDrawUsage));
    this.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x3a3a3a }));
    this.line.frustumCulled = false;
    this.line.visible = false;
    scene.add(this.line);

    this.from = new THREE.Vector3();
    this.to = new THREE.Vector3();
  }

  pin(out = this.from) {
    const a = this.anchorOf(this.tractor);
    return out.set(a.x, a.y, a.z);
  }

  /** The end of the hooked quad nearer the drawbar, where the hook goes. */
  hookPoint(quad, out = this.to) {
    const pin = this.pin(new THREE.Vector3());
    const front = quad.localToWorld(0, 0.45, 1.0);
    const back = quad.localToWorld(0, 0.45, -1.0);
    return out.copy(front.distanceTo(pin) < back.distanceTo(pin) ? front : back);
  }

  take(camera) {
    if (this.state !== 'stowed') return;
    this.state = 'carried';
    camera.add(this.handHook);
    this.line.visible = true;
  }

  stow() {
    this.handHook.removeFromParent();
    if (this.target) this.target.towed = false;
    this.state = 'stowed';
    this.target = null;
    this.tight = false;
    this.line.visible = false;
  }

  hookOn(quad) {
    if (this.state !== 'carried' || quad === this.tractor) return false;
    this.handHook.removeFromParent();
    this.state = 'hooked';
    this.target = quad;
    this.target.towed = true;
    this.slack = this.pin(new THREE.Vector3()).distanceTo(this.hookPoint(quad)) + 0.2;
    return true;
  }

  unhook(camera) {
    if (this.state !== 'hooked') return;
    this.target.towed = false;
    this.target = null;
    this.tight = false;
    this.state = 'carried';
    camera.add(this.handHook);
  }

  distanceFrom(position) {
    return this.pin(new THREE.Vector3()).distanceTo(position);
  }

  /** Each fixed step: once the chain is tight, drag the hooked quad towards the drawbar and the tractor back a little. */
  fixedUpdate(dt) {
    if (this.state !== 'hooked') {
      this.tight = false;
      return;
    }
    const p = this.params;
    const pin = this.pin();
    const end = this.hookPoint(this.target);
    const dist = pin.distanceTo(end);
    const stretch = dist - this.slack;
    this.tight = stretch > 0;
    if (!this.tight) return;
    const pull = chainPull(stretch, p);
    const dir = pin.clone().sub(end).normalize();
    this.target.physics.body.applyImpulseAtPoint({ x: dir.x * pull * dt, y: dir.y * pull * dt, z: dir.z * pull * dt }, { x: end.x, y: end.y, z: end.z }, true);
    const back = pull * p.reaction * dt;
    this.tractor.physics.body.applyImpulseAtPoint({ x: -dir.x * back, y: 0, z: -dir.z * back }, { x: pin.x, y: pin.y, z: pin.z }, true);
    // It can't run out further than it was hooked, however far the quad is hauled (a bad slope, say).
    if (stretch > 1) this.slack = dist - 1;
  }

  /** Each frame: the chain from the drawbar to your hand or the hooked quad, hanging in a sag when slack. */
  update() {
    if (this.state === 'stowed') return;
    const a = this.pin();
    const b = this.state === 'hooked' ? this.hookPoint(this.target) : this.handHook.getWorldPosition(this.to);
    const span = a.distanceTo(b);
    const slack = this.state === 'hooked' ? Math.max(0, this.slack - span) : Math.max(0.3, span * 0.2);
    const sag = this.tight ? 0 : Math.min(1, slack * 0.5 + 0.1);
    for (let i = 0; i < SAG_POINTS; i++) {
      const t = i / (SAG_POINTS - 1);
      const y = a.y + (b.y - a.y) * t - Math.sin(Math.PI * t) * sag;
      this.points.set([a.x + (b.x - a.x) * t, y, a.z + (b.z - a.z) * t], i * 3);
    }
    this.line.geometry.attributes.position.needsUpdate = true;
  }
}
