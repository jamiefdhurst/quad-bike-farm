import * as THREE from 'three';

/**
 * Finds what the player is looking at. Anything can register as interactable:
 *
 *   {
 *     target: Object3D,          raycast against this (usually an invisible proxy)
 *     isAvailable(): boolean,    optional, defaults to true
 *     prompt(): string | {text}, an E action ("Ride the quad") or plain text ({ text: 'The can is full' })
 *     interact(): void,          called when E is pressed while focused
 *     hold(dt): boolean,         optional, called every frame E is held; true while something is happening
 *   }
 *
 * A direct ray hit wins. Failing that, anything whose bounds come within a
 * narrow cone of the view direction counts, so you don't have to aim exactly.
 */
export class Interaction {
  constructor({ coneDegrees = 8 } = {}) {
    this.items = [];
    this.focused = null;
    this.coneCos = Math.cos((coneDegrees * Math.PI) / 180);
    this.raycaster = new THREE.Raycaster();
    this.ray = new THREE.Ray();
    this.centre = new THREE.Vector3();
    this.box = new THREE.Box3();
  }

  add(item) {
    this.items.push(item);
    return item;
  }

  /** Updates `focused` from the player's view. */
  update(player, range) {
    player.getViewRay(this.ray);
    this.raycaster.set(this.ray.origin, this.ray.direction);
    this.raycaster.far = range;

    let best = null;
    let bestDist = Infinity;
    let coneBest = null;
    let coneBestCos = this.coneCos;
    for (const item of this.items) {
      if (item.isAvailable && !item.isAvailable()) continue;
      const hits = this.raycaster.intersectObject(item.target, true);
      if (hits.length && hits[0].distance < bestDist) {
        best = item;
        bestDist = hits[0].distance;
      }
      // Angle from the view ray to the nearest part of the object's bounds.
      this.box.setFromObject(item.target);
      const along = this.box.getCenter(this.centre).sub(this.ray.origin).dot(this.ray.direction);
      if (along <= 0) continue;
      this.ray.at(along, this.centre);
      const to = this.box.clampPoint(this.centre, this.centre).sub(this.ray.origin);
      const dist = to.length();
      if (dist > range + 0.5 || dist < 1e-3) continue;
      const cos = to.dot(this.ray.direction) / dist;
      if (cos > coneBestCos) {
        coneBest = item;
        coneBestCos = cos;
      }
    }
    this.focused = best ?? coneBest;
    return this.focused;
  }

  clear() {
    this.focused = null;
  }
}
