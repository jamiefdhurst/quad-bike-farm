import * as THREE from 'three';
import { TrailerMotion } from './trailer.js';
import { UtvBed, DEFAULT_UTV_BED_PARAMS } from './utvBed.js';
import { TRACTOR_GROUND_OFFSET } from './tractorModel.js';
import { GROUND_OFFSET } from './quad.js';
import { TrailerObstacle, TIP_TRAILER_FOOTPRINT } from './trailerObstacle.js';
import { buildTipTrailerModel, poseTipTrailer, TIP_TRAILER_SPEC, TIP_STAND, CARGO_SPOTS, CARGO_YAWS, CARGO_YAW } from './tipTrailerModel.js';

export const DEFAULT_TIP_TRAILER_PARAMS = {
  drawLength: TIP_TRAILER_SPEC.drawLength, // metres from the hitch ring to the axle
  hitchRange: 1, // how close the puller's hitch has to be to the ring to hook on
  wheelTrack: 1.34, // metres between the wheels, for the roll
  springRate: 170, // the tub on its springs, per second squared: stiffer than the bale trailer's, it's lighter and bounces more
  springDamping: 6,
  yawSmoothing: 6,
  quadBack: 1.25, // a quad's hitch, metres behind its origin
  quadHitchHeight: 0.48, // and above the ground
  tractorBack: 1.5, // the tractor's drawbar pin
  tipOutSeconds: 0.55, // things tipped out of the tub fly this long
};

export const TIP_TRAILER_PARAM_RANGES = {
  drawLength: [1, 3, 0.05],
  hitchRange: [0.3, 3, 0.05],
  wheelTrack: [0.8, 2.5, 0.05],
  springRate: [20, 400, 5],
  springDamping: [1, 30, 0.5],
  yawSmoothing: [1, 30, 0.5],
  quadBack: [0.8, 2, 0.05],
  quadHitchHeight: [0.2, 0.8, 0.02],
  tractorBack: [1, 2.5, 0.05],
  tipOutSeconds: [0.2, 2, 0.05],
};

// The tub is hand-tipped, so the ram is quicker than the UTV's.
export const DEFAULT_TIP_BED_PARAMS = { ...DEFAULT_UTV_BED_PARAMS, riseSeconds: 4, lowerSeconds: 3, slideAt: 0.5 };

const smooth = (t) => t * t * (3 - 2 * t);

/** Whether a quad can pull it: the tractor, or a quad with a rear rack (its mug anchor is where the rack is). */
export function canTow(quad) {
  return !!(quad.tractor || quad.mugAnchor || quad.towHitch);
}

/**
 * The little tipping trailer in the yard: its model, its motion (vehicle/trailer.js), its tub (the UTV's tipping logic in utvBed.js) and
 * what's in it. Not a physics body: it follows the hitch, so it can't flip a quad or be driven into. The same face as the bale trailer
 * and the UTV's seats (`model`, `motion`, `slots`, `standPoint`, `freeSlot`) so a girl can climb in and sit (npc/companionHayRide.js).
 */
export class TipTrailer {
  constructor({ scene, world, params = { ...DEFAULT_TIP_TRAILER_PARAMS }, bedParams = { ...DEFAULT_TIP_BED_PARAMS } }) {
    this.scene = scene;
    this.world = world;
    this.p = params;
    this.model = buildTipTrailerModel();
    scene.add(this.model);
    this.body = this.model.getObjectByName('body');
    this.tub = this.model.getObjectByName('tub');
    this.motion = new TrailerMotion(params);
    this.bed = new UtvBed(bedParams);
    this.hitched = false;
    this.puller = null; // the Quad pulling it
    this.signedSpeed = 0;
    this.slots = { tub: { name: 'tub', side: 1, anchor: this.tub.getObjectByName('seat'), girl: null, lift: 0.7 } };
    this.anchors = CARGO_SPOTS.map((_, i) => this.tub.getObjectByName(`cargo${i}`));
    this.wheels = ['wheelLeft', 'wheelRight'].map((n) => this.model.getObjectByName(n).getObjectByName('spin'));
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.6, 1.8), new THREE.MeshBasicMaterial({ visible: false })); // to look at the tub
    this.proxy.position.set(0, TIP_TRAILER_SPEC.floorY + 0.25, -0.15);
    this.model.add(this.proxy);
    this.flying = []; // things tipped out: { item, from, to, yaw, t }
  }

  ground = (x, z) => this.world.heightAt(x, z);

  /** Gives it a box the girls' probes can hit (vehicle/trailerObstacle.js). */
  addObstacle(physics, RAPIER) {
    this.obstacle = new TrailerObstacle({ physics, RAPIER, footprint: TIP_TRAILER_FOOTPRINT });
    this.obstacle.sync(this.motion);
  }

  place(x, z, yaw) {
    this.motion.place(x, z, yaw, this.ground);
    this.apply();
  }

  /** The hitch of a quad (or the tractor's drawbar pin), on the ground plan, and its height above the ground reference. */
  pinOf(quad) {
    const p = this.p;
    if (quad.towHitch) {
      // A towing jaw of its own (the Land Rover's): where it is, in the world.
      const w = quad.towHitch.getWorldPosition(new THREE.Vector3());
      return { x: w.x, z: w.z, y: w.y - TIP_TRAILER_SPEC.ringHeight };
    }
    const w = quad.tractor
      ? quad.localToWorld(0, TRACTOR_GROUND_OFFSET + 0.52, -p.tractorBack)
      : quad.localToWorld(0, GROUND_OFFSET + p.quadHitchHeight, -p.quadBack);
    return { x: w.x, z: w.z, y: w.y - TIP_TRAILER_SPEC.ringHeight };
  }

  gap(quad) {
    const pin = this.pinOf(quad);
    const ring = this.motion.ring();
    return Math.hypot(pin.x - ring.x, pin.z - ring.z);
  }

  canHitch(quad) {
    return !this.hitched && canTow(quad) && this.gap(quad) <= this.p.hitchRange;
  }

  hitch(quad) {
    this.hitched = true;
    this.puller = quad;
  }

  unhitch() {
    if (this.puller) this.puller.towJam = false;
    this.hitched = false;
    this.puller = null;
    this.motion.speed = 0;
    this.motion.omega = 0;
  }

  /** Where she stands to climb in or out, as a world position and the way she faces (toward the tub). */
  standPoint() {
    const p = this.model.localToWorld(new THREE.Vector3(TIP_STAND.x, 0, TIP_STAND.z));
    p.y = this.ground(p.x, p.z);
    const c = this.model.position;
    return { position: p, facing: Math.atan2(c.x - p.x, c.z - p.z) };
  }

  freeSlot() {
    return this.slots.tub.girl || this.bed.tip > 0.02 ? null : this.slots.tub;
  }

  /** How many girls are in it or on their way. */
  get girlCount() {
    return this.slots.tub.girl ? 1 : 0;
  }

  /** The things standing in the tub (anything whose model is still parented to it). */
  get cargo() {
    return this.anchors.flatMap((a) => a.children).filter((c) => c.userData.cargo).map((c) => c.userData.cargo);
  }

  /** The next free spot in the tub, or null. */
  freeCargoSpot() {
    const used = new Set(this.cargo.map((i) => i.model.userData.spot));
    const free = CARGO_SPOTS.findIndex((_, i) => !used.has(i));
    return free >= 0 ? free : null;
  }

  /** Stands a held jerry can, the toolbox or the jump leads in the tub, turned along it. Returns whether there was room (and the tub was down). */
  load(item) {
    const spot = this.freeCargoSpot();
    if (spot === null || this.bed.tip > 0.02) return false;
    item.putDown(this.model.position, 0); // drops the held state and its camera parent
    this.anchors[spot].add(item.model);
    item.model.position.set(0, 0, 0);
    item.model.rotation.set(0, CARGO_YAWS[item.model.name] ?? CARGO_YAW, 0);
    item.model.userData.spot = spot;
    item.model.userData.cargo = item;
    return true;
  }

  /** Whether this item is standing in the tub. */
  holds(item) {
    return item.model.userData.cargo === item && this.anchors.includes(item.model.parent);
  }

  /** Takes it out of the tub's books before it's picked up (the item's own pickUp re-parents the model). */
  release(item) {
    delete item.model.userData.cargo;
    delete item.model.userData.spot;
  }

  /** The tip lever: a note for whoever pulled it when nothing happened. */
  toggleTip(cap = 1) {
    const note = this.bed.toggle(this.hitched ? this.puller.speed : 0);
    if (!note && this.bed.want) this.bed.cap = cap; // a part-way tilt holds there; the lever again lowers it
    return note;
  }

  /** The tub is high enough that what's in it slides out. */
  tipOut() {
    const yaw = this.model.rotation.y;
    const back = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    for (const item of this.cargo) {
      const from = item.model.getWorldPosition(new THREE.Vector3());
      this.release(item);
      this.scene.attach(item.model);
      const to = from.clone().addScaledVector(back, 1.5 + Math.random() * 0.5).addScaledVector(side, (Math.random() - 0.5) * 0.8);
      to.y = this.ground(to.x, to.z);
      this.flying.push({ item, from, to, yaw: Math.random() * Math.PI * 2, t: 0 });
    }
  }

  update(dt) {
    const m = this.motion;
    const before = { x: m.x, z: m.z };
    let pin;
    if (this.hitched) pin = this.pinOf(this.puller);
    else {
      const ring = m.ring();
      pin = { x: ring.x, z: ring.z, y: this.ground(ring.x, ring.z) };
    }
    m.update(dt, pin, this.ground, this.hitched ? this.puller.yaw : undefined);
    if (this.puller) this.puller.towJam = this.hitched && m.jammed; // the puller can't reverse any harder into the fold
    this.signedSpeed = dt > 0 ? ((m.x - before.x) * Math.sin(m.yaw) + (m.z - before.z) * Math.cos(m.yaw)) / dt : 0;
    for (const w of this.wheels) w.rotation.x += (this.signedSpeed * dt) / TIP_TRAILER_SPEC.wheelRadius;
    this.bed.update(dt, { speed: m.speed, gateDown: false });
    poseTipTrailer(this.model, this.bed);
    if (this.bed.sliding && this.cargo.length) this.tipOut();
    for (const f of this.flying) {
      f.t += dt / this.p.tipOutSeconds;
      const k = Math.min(1, smooth(f.t));
      const mp = f.item.model.position;
      mp.lerpVectors(f.from, f.to, k);
      mp.y += Math.sin(Math.PI * k) * 0.25;
      if (f.t >= 1) f.item.putDown(f.to, f.yaw);
    }
    this.flying = this.flying.filter((f) => f.t < 1);
    this.apply();
  }

  apply() {
    const m = this.motion;
    this.model.position.set(m.x, m.y, m.z);
    this.model.rotation.set(-m.pitch, m.yaw, m.roll, 'YXZ');
    this.body.position.y = m.heave;
    this.model.updateMatrixWorld(true);
    this.obstacle?.sync(m);
  }
}
