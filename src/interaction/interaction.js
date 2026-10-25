import * as THREE from 'three';

/**
 * Finds what the player is looking at. Anything can register as interactable:
 *
 *   {
 *     target: Object3D,          raycast against this (usually an invisible proxy)
 *     isAvailable(): boolean,    optional, defaults to true
 *     prompt(): string | {text} | {action, hold, keys} | {info, keys}: an E action ("Ride the quad") or a line saying why not
 *                                ({ text: 'The can is full' }); prompt.js sets the shapes
 *     interact(): void,          called when E is pressed while focused
 *     hold(dt): boolean,         optional, called every frame E is held; true while something is happening
 *     range(): number,           optional, how far away it can be reached (defaults to the player's reach)
 *     priority: number,          optional, defaults to 0: a direct hit on a higher priority item wins over a nearer one (the toolbox on
 *                                the workbench, whose own box is in front of it)
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
    // Everything you can use says what it is (see prompt.js); one that cannot would be a thing you look at and nothing happens.
    if (typeof item.prompt !== 'function') throw new Error('An interactable needs a prompt()');
    this.items.push(item);
    return item;
  }

  /** Updates `focused` from the player's view. */
  /** `only`, when given, is a test an item must pass to be considered (looking for a person while riding). */
  update(player, range, only = null) {
    player.getViewRay(this.ray);
    this.raycaster.set(this.ray.origin, this.ray.direction);
    this.raycaster.far = range;

    let best = null;
    let bestDist = Infinity;
    let bestPriority = -Infinity;
    let bestPoint = null;
    let coneBest = null;
    let coneBestCos = this.coneCos;
    for (const item of this.items) {
      if (item.isAvailable && !item.isAvailable()) continue;
      if (only && !only(item)) continue;
      const far = item.range?.() ?? range;
      this.raycaster.far = far;
      const hits = this.raycaster.intersectObject(item.target, true);
      const priority = item.priority ?? 0;
      if (hits.length && (priority > bestPriority || (priority === bestPriority && hits[0].distance < bestDist))) {
        best = item;
        bestDist = hits[0].distance;
        bestPriority = priority;
        bestPoint = hits[0].point;
      }
      // Angle from the view ray to the nearest part of the object's bounds.
      this.box.setFromObject(item.target);
      const along = this.box.getCenter(this.centre).sub(this.ray.origin).dot(this.ray.direction);
      if (along <= 0) continue;
      this.ray.at(along, this.centre);
      const to = this.box.clampPoint(this.centre, this.centre).sub(this.ray.origin);
      const dist = to.length();
      if (dist > far + 0.5 || dist < 1e-3) continue;
      const cos = to.dot(this.ray.direction) / dist;
      if (cos > coneBestCos) {
        coneBest = item;
        coneBestCos = cos;
      }
    }
    this.focused = best ?? coneBest;
    // Where the view ray met it (world space), when it did rather than only coming near: which half of a car you're looking at.
    this.focusPoint = best ? bestPoint : null;
    return this.focused;
  }

  clear() {
    this.focused = null;
    this.focusPoint = null;
  }
}
