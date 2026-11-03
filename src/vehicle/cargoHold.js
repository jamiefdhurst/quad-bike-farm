import * as THREE from 'three';
import { CARGO_FOOTPRINTS } from './tipTrailerModel.js';

export const DEFAULT_CARGO_PARAMS = {
  tipOutSeconds: 0.6, // things tipped out of a bed fly this long
  tipOutDistance: 1.6, // metres behind where they stood (plus up to half a metre more, and a little sideways)
};

export const CARGO_PARAM_RANGES = {
  tipOutSeconds: [0.2, 2, 0.05],
  tipOutDistance: [0.5, 4, 0.1],
};

const smooth = (t) => t * t * (3 - 2 * t);

/**
 * A row of spots on a tipping bed where the pick-up items (jerry cans, the toolbox, the jump leads, the oil bottle) stand. The same
 * way the little tipping trailer holds them (vehicle/tipTrailer.js): the item's model is parented to a spot's anchor so it rides the bed
 * as it tips, and when the bed is high enough it slides out behind. An item picked up again just leaves its anchor, so nothing has to
 * be told. `anchors` are Object3Ds on the bed; `yawFor(item)` is the turn each stands at.
 */
export class CargoHold {
  constructor({ scene, ground, anchors, yawFor = () => 0, params = { ...DEFAULT_CARGO_PARAMS } }) {
    this.scene = scene;
    this.ground = ground;
    this.anchors = anchors;
    this.yawFor = yawFor;
    this.p = params;
    this.flying = []; // things tipped out: { item, from, to, yaw, t }
  }

  /** The things standing in the bed (anything whose model is still parented to a spot). */
  get items() {
    return this.anchors.flatMap((a) => a.children).filter((c) => c.userData.cargoHold === this).map((c) => c.userData.cargo);
  }

  /** The next free spot, or null. */
  freeSpot() {
    const used = new Set(this.items.map((i) => i.model.userData.spot));
    const free = this.anchors.findIndex((_, i) => !used.has(i));
    return free >= 0 ? free : null;
  }

  /** Stands a held item in the bed (at `spot` if it is free, else the next one). Returns whether there was room. */
  load(item, want = null) {
    const used = this.items.some((i) => i.model.userData.spot === want);
    const spot = want !== null && want >= 0 && want < this.anchors.length && !used ? want : this.freeSpot();
    if (spot === null) return false;
    item.putDown(this.anchors[spot].getWorldPosition(new THREE.Vector3()), 0); // drops the held state and its camera parent
    this.anchors[spot].add(item.model);
    item.model.position.set(0, 0, 0);
    item.model.rotation.set(0, this.yawFor(item), 0);
    item.model.userData.spot = spot;
    delete item.model.userData.loose; // stood up again where it was put, not where the shake left it
    item.model.userData.cargo = item;
    item.model.userData.cargoHold = this;
    return true;
  }

  holds(item) {
    return item.model.userData.cargoHold === this && this.anchors.includes(item.model.parent);
  }

  /** Slides everything out behind: `back` is the flat direction towards the tail. */
  tipOut(back) {
    for (const item of this.items) this.dropOut(item, back);
  }

  /** One thing goes out behind and lands on the ground (what tipOut does to each, and what falls off an open tailgate). */
  dropOut(item, back, distance = this.p.tipOutDistance) {
    const side = new THREE.Vector3(-back.z, 0, back.x);
    const from = item.model.getWorldPosition(new THREE.Vector3());
    delete item.model.userData.cargoHold;
    delete item.model.userData.loose;
    this.scene.attach(item.model);
    const to = from.clone().addScaledVector(back, distance + Math.random() * 0.5).addScaledVector(side, (Math.random() - 0.5) * 0.8);
    to.y = this.ground(to.x, to.z);
    this.flying.push({ item, from, to, yaw: Math.random() * Math.PI * 2, t: 0 });
  }

  /** Where each held thing stands, by spot: [{ spot, name }] in spot order, to keep in the save. */
  contents() {
    return this.items.map((i) => ({ spot: i.model.userData.spot, item: i })).sort((a, b) => a.spot - b.spot);
  }

  update(dt) {
    for (const f of this.flying) {
      f.t += dt / this.p.tipOutSeconds;
      const k = Math.min(1, smooth(f.t));
      f.item.model.position.lerpVectors(f.from, f.to, k);
      f.item.model.position.y += Math.sin(Math.PI * k) * 0.25;
      if (f.t >= 1) f.item.putDown(f.to, f.yaw);
    }
    this.flying = this.flying.filter((f) => f.t < 1);
  }
}

// What a load can do on the floor it stands on: how far it can slide from its spot. Anything without a footprint (a battery, the booster
// pack) is taken as a box this size.
const LOAD_FOOTPRINTS = CARGO_FOOTPRINTS;
const DEFAULT_FOOTPRINT = { w: 0.25, d: 0.2 };

/**
 * How far a thing can slide each way from its spot (offsets, model frame: x to the left, z forward) in a floor with `room`
 * (`x0`..`x1`, `z0` the back to `z1` the front). With the back open the rear limit is just past the edge, so it can go over.
 */
export function slideLimits(room, spot, name, yaw, backOpen) {
  const f = LOAD_FOOTPRINTS[name] ?? DEFAULT_FOOTPRINT;
  const turned = Math.abs(Math.sin(yaw)) > 0.5;
  const halfX = (turned ? f.d : f.w) / 2;
  const halfZ = (turned ? f.w : f.d) / 2;
  return {
    minX: room.x0 + halfX - spot.x,
    maxX: room.x1 - halfX - spot.x,
    minZ: (backOpen ? room.z0 - 0.1 : room.z0 + halfZ) - spot.z,
    maxZ: room.z1 - halfZ - spot.z,
  };
}
