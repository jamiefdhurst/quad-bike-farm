import * as THREE from 'three';

/**
 * Finds what the player is looking at. Anything can register as interactable:
 *
 *   {
 *     target: Object3D,          raycast against this (usually an invisible proxy)
 *     isAvailable(): boolean,    optional, defaults to true
 *     prompt(): string,          text shown under the crosshair, e.g. "Ride the quad"
 *     interact(): void,          called when E is pressed while focused
 *   }
 */
export class Interaction {
  constructor() {
    this.items = [];
    this.focused = null;
    this.raycaster = new THREE.Raycaster();
    this.ray = new THREE.Ray();
  }

  add(item) {
    this.items.push(item);
    return item;
  }

  /** Updates `focused` from a view ray. */
  update(player, range) {
    player.getViewRay(this.ray);
    this.raycaster.set(this.ray.origin, this.ray.direction);
    this.raycaster.far = range;
    let best = null;
    let bestDist = Infinity;
    for (const item of this.items) {
      if (item.isAvailable && !item.isAvailable()) continue;
      const hits = this.raycaster.intersectObject(item.target, true);
      if (hits.length && hits[0].distance < bestDist) {
        best = item;
        bestDist = hits[0].distance;
      }
    }
    this.focused = best;
    return best;
  }

  clear() {
    this.focused = null;
  }
}
