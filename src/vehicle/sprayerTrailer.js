import * as THREE from 'three';
import { TrailerMotion } from './trailer.js';
import { TrailerCoat } from '../effects/trailerCoat.js';
import { TRACTOR_GROUND_OFFSET } from './tractorModel.js';
import { GROUND_OFFSET } from './quad.js';
import { TrailerObstacle } from './trailerObstacle.js';
import { canTow, DEFAULT_TIP_TRAILER_PARAMS, TIP_TRAILER_PARAM_RANGES } from './tipTrailer.js';
import { buildSprayerModel, poseSprayer, SPRAYER_SPEC, SPRAYER_FOOTPRINT } from './sprayerModel.js';

export const DEFAULT_SPRAYER_PARAMS = {
  ...DEFAULT_TIP_TRAILER_PARAMS,
  drawLength: SPRAYER_SPEC.drawLength,
  springRate: 150, // a tank of water bounces less than an empty tub
  towWeight: 2.5, // a full tank drags like this many things in it (npc/towLoad)
};

export const SPRAYER_PARAM_RANGES = { ...TIP_TRAILER_PARAM_RANGES, towWeight: [0, 8, 0.5] };

/** What makes this single-axle towed thing a sprayer: its model and measurements, how it is posed, and the name its model is looked for by. */
export const SPRAYER_KIT = { build: buildSprayerModel, spec: SPRAYER_SPEC, footprint: SPRAYER_FOOTPRINT, pose: poseSprayer, hitchProxyY: SPRAYER_SPEC.floorY + 0.4 };

/**
 * The sprayer trailer: its model (a tank and a folding boom), its motion (vehicle/trailer.js) and a hitch like the tipping trailer's. Not a
 * physics body: it follows the hitch. The spraying rules are in world/spraying.js; this only moves, poses and hitches. The chain harrows
 * (vehicle/harrowTrailer.js) are the same carrier with another `kit`.
 */
export class SprayerTrailer {
  constructor({ scene, world, params = { ...DEFAULT_SPRAYER_PARAMS }, kit = SPRAYER_KIT }) {
    this.scene = scene;
    this.world = world;
    this.p = params;
    this.kit = kit;
    this.model = kit.build();
    scene.add(this.model);
    this.body = this.model.getObjectByName('body');
    this.motion = new TrailerMotion(params);
    this.hitched = false;
    this.puller = null;
    this.signedSpeed = 0;
    this.wheels = ['wheelLeft', 'wheelRight'].map((n) => this.model.getObjectByName(n).getObjectByName('spin'));
    this.coat = new TrailerCoat(this.model, ['wheelLeft', 'wheelRight'].map((n) => this.model.getObjectByName(n)), 0.35);
    this.coatAt = new THREE.Vector3();
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.4), new THREE.MeshBasicMaterial({ visible: false })); // to look at the tank
    this.proxy.position.set(0, this.kit.hitchProxyY, 0.05);
    this.model.add(this.proxy);
    this.pose = { boom: 0, tank: 1 };
  }

  ground = (x, z) => this.world.heightAt(x, z);

  addObstacle(physics, RAPIER) {
    this.obstacle = new TrailerObstacle({ physics, RAPIER, footprint: this.kit.footprint });
    this.obstacle.sync(this.motion);
  }

  place(x, z, yaw) {
    this.motion.place(x, z, yaw, this.ground);
    this.apply();
  }

  pinOf(quad) {
    const p = this.p;
    if (quad.towHitch) {
      const w = quad.towHitch.getWorldPosition(new THREE.Vector3());
      return { x: w.x, z: w.z, y: w.y - this.kit.spec.ringHeight };
    }
    const w = quad.tractor
      ? quad.localToWorld(0, TRACTOR_GROUND_OFFSET + 0.52, -p.tractorBack)
      : quad.localToWorld(0, GROUND_OFFSET + p.quadHitchHeight, -p.quadBack);
    return { x: w.x, z: w.z, y: w.y - this.kit.spec.ringHeight };
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

  /** Follows the hitch, turns its wheels and poses the boom and the sight tube. `boom` 0..1 and `tank` 0..1 come from the spraying rules. */
  update(dt, { boom = 0, tank = 1, down = 0 } = {}) {
    const m = this.motion;
    const before = { x: m.x, z: m.z };
    let pin;
    if (this.hitched) pin = this.pinOf(this.puller);
    else {
      const ring = m.ring();
      pin = { x: ring.x, z: ring.z, y: this.ground(ring.x, ring.z) };
    }
    m.update(dt, pin, this.ground, this.hitched ? this.puller.yaw : undefined);
    if (this.puller) this.puller.towJam = this.hitched && m.jammed;
    this.signedSpeed = dt > 0 ? ((m.x - before.x) * Math.sin(m.yaw) + (m.z - before.z) * Math.cos(m.yaw)) / dt : 0;
    for (const w of this.wheels) w.rotation.x += (this.signedSpeed * dt) / this.kit.spec.wheelRadius;
    this.coat.update(dt, this.signedSpeed, this.world, this.coatAt);
    this.pose.boom = boom;
    this.pose.tank = tank;
    this.pose.down = down; // the harrows' tines
    this.kit.pose(this.model, this.pose);
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
