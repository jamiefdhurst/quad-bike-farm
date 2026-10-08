import * as THREE from 'three';

/**
 * `parent.attach(object)` keeps the world transform, so any stretch in the parent's chain (a quaternion that has drifted off unit length
 * makes the matrix scale a little) is baked into the object's own scale, and it compounds each time the girl boards and gets off.
 * A girl is always full size, so put the scale back to one.
 */
export function attachKeepingSize(parent, object) {
  parent.attach(object);
  object.scale.set(1, 1, 1);
  return object;
}
