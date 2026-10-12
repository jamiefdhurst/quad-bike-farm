import * as THREE from 'three';

// The tow rope on the utility quads' racks. Take it off one (X, looking at it), walk the hook to a dead quad and hook it on (E), then
// pull it along. Unlike the tractor's chain it stretches a little and goes slack, so snatching off hard jerks the dead quad and a quad
// that isn't braked runs up into your back. A girl can sit on the dead quad and steer and brake it (npc/towSteer.js). E on the hooked
// quad unhooks it.

export const DEFAULT_TOW_ROPE_PARAMS = {
  reach: 3.5, // metres you can carry the hook from the hitch
  minLength: 2.5, // the shortest it's left when hooked (it's hooked with a little slack, but never shorter than this)
  maxLength: 5, // and the longest
  extra: 0.3, // metres of slack added to however far apart the two hitches are when you hook it on
  stiffness: 5000, // newtons per metre of stretch once it's tight
  damping: 900, // newton seconds per metre: the extra pull when it stretches quickly, which is what a snatch is
  maxPull: 5000, // newtons at most
  reaction: 1, // fraction of the pull that drags back on the towing quad
  snatchRate: 1.8, // m/s of stretching the moment it goes tight that counts as a snatch (the girl on the dead quad shouts)
  hitchHeight: 0.48, // metres above the quad's origin
  hitchBack: 1.25, // metres behind it
};

export const TOW_ROPE_PARAM_RANGES = {
  reach: [1.5, 8, 0.5],
  minLength: [1, 5, 0.1],
  maxLength: [2, 10, 0.5],
  extra: [0, 2, 0.1],
  stiffness: [500, 40000, 500],
  damping: [0, 5000, 50],
  maxPull: [500, 20000, 250],
  reaction: [0, 1, 0.05],
  snatchRate: [0.5, 6, 0.1],
  hitchHeight: [0.2, 0.8, 0.02],
  hitchBack: [0.8, 2, 0.05],
};

const SAG_POINTS = 12;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** How long the rope is left once hooked on, from how far apart the hitches are. */
export function ropeLengthFor(distance, p = DEFAULT_TOW_ROPE_PARAMS) {
  return clamp(distance + p.extra, p.minLength, p.maxLength);
}

/** Newtons along the rope: nothing while it's slack; stiffness times the stretch, plus damping while it is stretching, never over maxPull. */
export function ropeForce(stretch, rate, p = DEFAULT_TOW_ROPE_PARAMS) {
  if (stretch <= 0) return 0;
  return clamp(stretch * p.stiffness + Math.max(0, rate) * p.damping, 0, p.maxPull);
}

/** The rope has just gone tight at speed: a jerk, not a gentle take-up. */
export function isSnatch(stretch, rate, p = DEFAULT_TOW_ROPE_PARAMS) {
  return stretch > 0 && rate >= p.snatchRate;
}

export class TowRope {
  constructor({ scene, params = { ...DEFAULT_TOW_ROPE_PARAMS } }) {
    this.params = params;
    this.state = 'stowed'; // 'stowed' on the racks, 'carried' in your hand or 'hooked' on a dead quad
    this.puller = null; // the quad it was taken from, whose hitch it runs from
    this.target = null;
    this.length = 0;
    this.tight = false;
    this.rate = 0; // m/s the rope is lengthening (negative: the two closing)
    this.force = 0; // newtons along it this step
    this.events = []; // 'snatch', for the game to have the girl on the dead quad say something
    this.lastDist = 0;

    this.handHook = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.01, 6, 12, Math.PI * 1.5), new THREE.MeshStandardMaterial({ color: 0x8a7a55, roughness: 0.9 }));
    this.handHook.position.set(-0.2, -0.22, -0.4);

    this.points = new Float32Array(SAG_POINTS * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.points, 3).setUsage(THREE.DynamicDrawUsage));
    this.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x9a8a60 }));
    this.line.frustumCulled = false;
    this.line.visible = false;
    scene.add(this.line);

    this.from = new THREE.Vector3();
    this.to = new THREE.Vector3();
  }

  /** The towing quad's hitch, at the back of its rack. */
  pin(out = this.from) {
    const p = this.params;
    return out.copy(this.puller.localToWorld(0, p.hitchHeight, -p.hitchBack));
  }

  /** The end of the dead quad nearer the hitch, where the hook goes. */
  hookPoint(quad, out = this.to) {
    const pin = this.pin(new THREE.Vector3());
    const front = quad.localToWorld(0, 0.45, 1.0);
    const back = quad.localToWorld(0, 0.45, -1.0);
    return out.copy(front.distanceTo(pin) < back.distanceTo(pin) ? front : back);
  }

  /** The metres between the two ends: what's left of the rope is `length` minus this. */
  gap() {
    return this.state === 'hooked' ? this.pin(new THREE.Vector3()).distanceTo(this.hookPoint(this.target)) : 0;
  }

  take(camera, puller) {
    if (this.state !== 'stowed') return false;
    this.puller = puller;
    this.state = 'carried';
    camera.add(this.handHook);
    this.line.visible = true;
    return true;
  }

  stow() {
    this.handHook.removeFromParent();
    if (this.target) this.target.towed = false;
    this.state = 'stowed';
    this.puller = null;
    this.target = null;
    this.tight = false;
    this.line.visible = false;
  }

  hookOn(quad) {
    if (this.state !== 'carried' || quad === this.puller) return false;
    this.handHook.removeFromParent();
    this.state = 'hooked';
    this.target = quad;
    this.target.towed = true;
    this.lastDist = this.gap();
    this.length = ropeLengthFor(this.lastDist, this.params);
    this.rate = 0;
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

  /** Each fixed step: once the rope is tight, pull the dead quad towards the hitch and the towing quad back. */
  fixedUpdate(dt) {
    if (this.state !== 'hooked') {
      this.tight = false;
      this.force = 0;
      return;
    }
    const p = this.params;
    const pin = this.pin();
    const end = this.hookPoint(this.target);
    const dist = pin.distanceTo(end);
    this.rate = (dist - this.lastDist) / dt;
    this.lastDist = dist;
    const stretch = dist - this.length;
    const wasTight = this.tight;
    this.tight = stretch > 0;
    this.force = ropeForce(stretch, this.rate, p);
    if (!this.tight) return;
    if (!wasTight && isSnatch(stretch, this.rate, p)) this.events.push('snatch');
    const dir = pin.clone().sub(end).normalize();
    const pull = this.force * dt;
    this.target.physics.body.applyImpulseAtPoint({ x: dir.x * pull, y: dir.y * pull * 0.5, z: dir.z * pull }, { x: end.x, y: end.y, z: end.z }, true);
    const back = pull * p.reaction;
    this.puller.physics.body.applyImpulseAtPoint({ x: -dir.x * back, y: 0, z: -dir.z * back }, { x: pin.x, y: pin.y, z: pin.z }, true);
  }

  /** Each frame: the rope from the hitch to your hand or the dead quad, hanging in a sag when slack. */
  update() {
    if (this.state === 'stowed') return;
    const a = this.pin();
    const b = this.state === 'hooked' ? this.hookPoint(this.target) : this.handHook.getWorldPosition(this.to);
    const span = a.distanceTo(b);
    const slack = this.state === 'hooked' ? Math.max(0, this.length - span) : Math.max(0.3, span * 0.2);
    const sag = this.tight ? 0 : Math.min(0.8, slack * 0.6 + 0.05);
    for (let i = 0; i < SAG_POINTS; i++) {
      const t = i / (SAG_POINTS - 1);
      const y = a.y + (b.y - a.y) * t - Math.sin(Math.PI * t) * sag;
      this.points.set([a.x + (b.x - a.x) * t, y, a.z + (b.z - a.z) * t], i * 3);
    }
    this.line.geometry.attributes.position.needsUpdate = true;
  }
}
