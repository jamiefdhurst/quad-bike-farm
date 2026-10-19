import * as THREE from 'three';

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

  /** Stands a held item in the bed. Returns whether there was room. */
  load(item) {
    const spot = this.freeSpot();
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
    const side = new THREE.Vector3(-back.z, 0, back.x);
    for (const item of this.items) {
      const from = item.model.getWorldPosition(new THREE.Vector3());
      delete item.model.userData.cargoHold;
      this.scene.attach(item.model);
      const to = from.clone().addScaledVector(back, this.p.tipOutDistance + Math.random() * 0.5).addScaledVector(side, (Math.random() - 0.5) * 0.8);
      to.y = this.ground(to.x, to.z);
      this.flying.push({ item, from, to, yaw: Math.random() * Math.PI * 2, t: 0 });
    }
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
