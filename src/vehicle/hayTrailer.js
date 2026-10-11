import * as THREE from 'three';
import { TrailerMotion, DEFAULT_TRAILER_PARAMS } from './trailer.js';
import { TRACTOR_GROUND_OFFSET } from './tractorModel.js';
import { TrailerObstacle, BALE_TRAILER_FOOTPRINT } from './trailerObstacle.js';
import { buildTrailerModel, TRAILER_SPEC, trailerStandLocal, poseRamps, rampOpenAngle } from './trailerModel.js';
import { DEFAULT_LOAD_PARAMS, QuadLoad, rampGeometry, loadPose, canCapture, inWinchReach } from './quadLoad.js';

const PIN_BACK = 1.5; // the tractor's drawbar pin, metres behind its origin

/**
 * The bale trailer in the yard: its model, its motion (vehicle/trailer.js) and whether it's on the tractor's drawbar. It isn't a
 * physics body, so it can't flip the tractor or be driven into; it just follows the pin.
 *
 * It also has two ramps (`ramp` 0 stowed to 1 down) and carries one dead quad at a time (`load`, vehicle/quadLoad.js): the quad's body is
 * pinned to a pose this works out every frame (`quad.pinned`) and let go again when it comes off.
 */
export class HayTrailer {
  constructor({ scene, world, params = { ...DEFAULT_TRAILER_PARAMS }, loadParams = { ...DEFAULT_LOAD_PARAMS } }) {
    this.world = world;
    this.p = params;
    this.lp = loadParams;
    this.ramp = 0; // 0 stowed under the bed, 1 down on the ground
    this.rampWant = false;
    this.load = null; // the QuadLoad while a quad is on the ramps or aboard
    this.loaded = null; // its Quad
    this.events = []; // what the load did this step
    this.accel = 0; // the trailer's acceleration along itself, smoothed
    this.prevSigned = 0;
    this.openAngle = 0;
    this.model = buildTrailerModel();
    scene.add(this.model);
    this.body = this.model.getObjectByName('body');
    this.motion = new TrailerMotion(params);
    this.hitched = false;
    this.tractor = null; // the tractor's Quad while it's hitched
    this.signedSpeed = 0;
    this.slots = {
      1: { side: 1, anchor: this.body.getObjectByName('seatLeft'), girl: null },
      '-1': { side: -1, anchor: this.body.getObjectByName('seatRight'), girl: null },
    };
    this.straps = this.body.getObjectByName('straps');
    this.winchEye = this.body.getObjectByName('winchEye');
    const cable = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.cable = new THREE.Line(cable, new THREE.LineBasicMaterial({ color: 0x1c1c1c }));
    this.cable.frustumCulled = false;
    this.cable.visible = false;
    scene.add(this.cable);
    this.refreshRamps();
    this.wheels = ['wheelLeft', 'wheelRight'].map((n) => this.model.getObjectByName(n).getObjectByName('spin'));
  }

  ground = (x, z) => this.world.heightAt(x, z);

  /** Gives it a box the girls' probes can hit (vehicle/trailerObstacle.js). */
  addObstacle(physics, RAPIER) {
    this.obstacle = new TrailerObstacle({ physics, RAPIER, footprint: BALE_TRAILER_FOOTPRINT });
    this.obstacle.sync(this.motion);
  }

  /** Stands it with its axle at (x, z), pointing `yaw` (toward the tractor). */
  place(x, z, yaw) {
    this.motion.place(x, z, yaw, this.ground);
    this.apply();
  }

  /** The drawbar pin of a tractor Quad, on the ground plan, and its height above the ground. */
  pinOf(quad) {
    const w = quad.localToWorld(0, TRACTOR_GROUND_OFFSET + 0.52, -PIN_BACK);
    return { x: w.x, z: w.z, y: w.y - TRAILER_SPEC.ringHeight };
  }

  /** How far the tractor's pin is from the trailer's ring. */
  gap(quad) {
    const pin = this.pinOf(quad);
    const ring = this.motion.ring();
    return Math.hypot(pin.x - ring.x, pin.z - ring.z);
  }

  canHitch(quad) {
    return !this.hitched && this.gap(quad) <= this.p.hitchRange;
  }

  hitch(quad) {
    this.hitched = true;
    this.tractor = quad;
  }

  unhitch() {
    this.hitched = false;
    this.accel = 0;
    this.tractor = null;
    this.motion.speed = 0;
    this.motion.omega = 0;
  }

  /** Where she stands to climb on or off on `side` (+1 left, -1 right), as a world position and the way she faces (toward the bed). */
  standPoint(side) {
    const l = trailerStandLocal(side);
    const p = this.model.localToWorld(new THREE.Vector3(l.x, 0, l.z));
    p.y = this.ground(p.x, p.z);
    const c = this.model.position;
    return { position: p, facing: Math.atan2(c.x - p.x, c.z - p.z) };
  }

  /** The slot a girl would take, picking the free one nearer her. */
  freeSlot(from) {
    const free = Object.values(this.slots).filter((s) => !s.girl);
    free.sort((a, b) => this.standPoint(a.side).position.distanceTo(from) - this.standPoint(b.side).position.distanceTo(from));
    return free[0] ?? null;
  }

  /** Where the ramps reach to, from the length they have now. */
  get geometry() {
    return rampGeometry(TRAILER_SPEC.rearZ, TRAILER_SPEC.bedY, this.lp.rampLength);
  }

  get rampsOpen() {
    return this.ramp >= 0.98;
  }

  /** Re-poses the ramps (after a tuning change to their length). */
  refreshRamps() {
    this.openAngle = rampOpenAngle(this.geometry.rise);
    for (const n of ['rampLeft', 'rampRight']) {
      const r = this.body.getObjectByName(n);
      r.scale.z = this.lp.rampLength / TRAILER_SPEC.rampLength;
    }
    poseRamps(this.body, this.ramp, this.openAngle);
  }

  /** T: fold the ramps down or up. Returns a note when it can't. */
  toggleRamps() {
    if (this.rampWant && this.load?.blocksRamp) return 'Get the quad all the way up (or off) first';
    this.rampWant = !this.rampWant;
    return null;
  }

  /** A quad's place in the trailer's own frame: { x, z, heading }. */
  localOf(quad) {
    const l = this.model.worldToLocal(new THREE.Vector3(quad.position.x, this.model.position.y, quad.position.z));
    const h = quad.yaw - this.motion.yaw;
    return { x: l.x, z: l.z, heading: Math.atan2(Math.sin(h), Math.cos(h)) };
  }

  /** Whether the winch can fetch this quad from where it stands. */
  inReach(quad) {
    return this.rampsOpen && !this.load && inWinchReach(this.geometry, this.localOf(quad), this.lp);
  }

  /** Whether this quad, pushed, is lined up on the ramp: { ok, facing }. */
  lineUp(quad) {
    return this.rampsOpen && !this.load ? canCapture(this.geometry, this.localOf(quad), this.lp) : { ok: false, facing: 1 };
  }

  /** Takes a quad onto the ramps. `winch`: the winch has it (it fetches it across the ground first); otherwise it was pushed to the foot. */
  startLoad(quad, { winch, facing = 1 }) {
    const half = 0.9 * (quad.scale ?? 1);
    this.load = new QuadLoad(this.geometry, this.localOf(quad), { mode: winch ? 'approach' : 'ramp', facing, halfLen: half, held: winch }, this.lp);
    this.loaded = quad;
    quad.loadedOn = this;
    quad.pinned = { pos: new THREE.Vector3(quad.position.x, quad.position.y, quad.position.z), quat: new THREE.Quaternion() };
    this.poseLoad();
  }

  /** The quad comes off: let its body go where it stands. */
  endLoad() {
    const q = this.loaded;
    if (q) {
      q.pinned = null;
      q.loadedOn = null;
      q.towed = false;
    }
    this.load = null;
    this.loaded = null;
    this.straps.visible = false;
    this.cable.visible = false;
  }

  /** Works out the pinned pose of the loaded quad from its place on the ramps or bed. */
  poseLoad() {
    const l = this.load;
    const q = this.loaded;
    if (!l || !q) return;
    const lift = -q.groundOffset * (q.scale ?? 1) + 0.03;
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const heading = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), l.heading);
    if (l.mode === 'approach') {
      this.model.localToWorld(pos.set(l.x, 0, l.z));
      pos.y = this.ground(pos.x, pos.z) + lift;
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.motion.yaw).multiply(heading);
    } else {
      const pose = loadPose(l.g, l.z, 0.55 * (q.scale ?? 1));
      this.body.localToWorld(pos.set(l.x, pose.y + lift, l.z));
      const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -pose.pitch);
      const bodyQ = this.body.getWorldQuaternion(new THREE.Quaternion());
      quat.copy(bodyQ).multiply(tilt).multiply(heading);
    }
    q.pinned.pos.copy(pos);
    q.pinned.quat.copy(quat);
  }

  /** The straps and the cable. */
  dressLoad() {
    const l = this.load;
    const show = !!l && l.mode === 'aboard' && l.strapped;
    this.straps.visible = show;
    if (show) {
      const sp = [-0.38, 0.38];
      this.straps.children.forEach((s, i) => s.position.set(0, TRAILER_SPEC.bedY, l.z + sp[i] * (this.loaded.scale ?? 1)));
    }
    const cable = !!l && l.held && l.mode !== 'aboard';
    this.cable.visible = cable;
    if (cable) {
      const a = this.winchEye.getWorldPosition(new THREE.Vector3());
      const nose = this.loaded.localToWorld(0, 0.4, 0.95 * (l.facing === 1 ? 1 : -1) * (this.loaded.scale ?? 1));
      const pos = this.cable.geometry.attributes.position;
      pos.setXYZ(0, a.x, a.y, a.z);
      pos.setXYZ(1, nose.x, nose.y, nose.z);
      pos.needsUpdate = true;
    }
  }

  update(dt, loadCtx = {}) {
    const m = this.motion;
    const before = { x: m.x, z: m.z };
    let pin;
    if (this.hitched) pin = this.pinOf(this.tractor);
    else {
      const ring = m.ring();
      pin = { x: ring.x, z: ring.z, y: this.ground(ring.x, ring.z) };
    }
    m.update(dt, pin, this.ground);
    this.signedSpeed = dt > 0 ? ((m.x - before.x) * Math.sin(m.yaw) + (m.z - before.z) * Math.cos(m.yaw)) / dt : 0;
    for (const w of this.wheels) w.rotation.x += (this.signedSpeed * dt) / TRAILER_SPEC.wheelRadius;
    // How hard it is speeding up or braking along itself, smoothed, for a quad that isn't strapped down.
    if (dt > 0) this.accel += (((this.signedSpeed - this.prevSigned) / dt) - this.accel) * Math.min(1, 8 * dt);
    this.prevSigned = this.signedSpeed;
    this.stepRamps(dt);
    this.apply();
    this.events = this.stepLoad(dt, loadCtx);
  }

  stepRamps(dt) {
    const step = dt / this.lp.rampSeconds;
    const was = this.ramp;
    this.ramp = this.rampWant ? Math.min(1, this.ramp + step) : Math.max(0, this.ramp - step);
    if (this.ramp !== was) poseRamps(this.body, this.ramp, this.openAngle);
  }

  /** Moves the load. `ctx`: winch (+1 in, -1 out, 0), push (+1 up the ramp). Returns the load's events. */
  stepLoad(dt, ctx) {
    const l = this.load;
    if (!l) return [];
    const events = l.step(dt, { winch: ctx.winch ?? 0, push: ctx.push ?? 0, accel: this.accel, rampOpen: this.rampsOpen });
    if (events.includes('released')) {
      this.poseLoad();
      this.endLoad();
    } else {
      this.poseLoad();
      this.dressLoad();
    }
    return events;
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
