import * as THREE from 'three';
import { TOR_WING, TOR_SCREEN } from './torBody.js';
import { DEF_WING, DEF_SCREEN } from './cragBody.js';

// The snorkel's look: a black pipe up the nearside wing, in front of the screen's side, with a bend at the roofline and a scoop facing
// forward. Hidden until fitted at the bench. The pipe's foot is sunk into the wing's flat top, so it never floats.

const PIPE = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.55, metalness: 0.2 });
const MOUTH = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.55, metalness: 0.2, side: THREE.DoubleSide });
const R = 0.045; // metres, the pipe
const EMBED = 0.03; // the foot goes this far into the wing's top
const CLAMP = 0.1; // the foot's clamp is wider than the pipe

/** Where it stands on each Land Rover (model frame; the driver's left is +x): on the wing's flat top, just ahead of the screen. */
export const SNORKEL_SPOTS = {
  tor: { x: TOR_WING.outer - 0.1, z: TOR_WING.scuttle + 0.1, base: TOR_WING.top, top: TOR_SCREEN.topY },
  crag: { x: DEF_WING.outer - 0.1, z: DEF_WING.scuttle + 0.12, base: DEF_WING.top, top: DEF_SCREEN.topY },
};

/** Adds the (hidden) snorkel to a Land Rover's model. Returns the group, or null for anything else. */
export function addSnorkel(model) {
  const spot = SNORKEL_SPOTS[model.userData.variant];
  if (!spot) return null;
  const group = new THREE.Group();
  group.name = 'snorkel';
  group.visible = false;
  const part = (geometry, material, x, y, z) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.userData.keep = true;
    group.add(m);
    return m;
  };
  const bottom = spot.base - EMBED;
  const bendY = spot.top + R; // the bend's centre
  part(new THREE.CylinderGeometry(R, R, bendY - bottom, 14), PIPE, spot.x, (bottom + bendY) / 2, spot.z);
  part(new THREE.BoxGeometry(CLAMP, 0.04, CLAMP), PIPE, spot.x, spot.base + 0.01, spot.z);
  // The bend where it turns, a short run forward and a scoop with its mouth open to the front.
  part(new THREE.SphereGeometry(R, 14, 10), PIPE, spot.x, bendY, spot.z);
  part(new THREE.CylinderGeometry(R, R, 0.12, 14).rotateX(Math.PI / 2), PIPE, spot.x, bendY, spot.z + 0.06);
  part(new THREE.CylinderGeometry(R * 1.35, R, 0.07, 14, 1, true).rotateX(Math.PI / 2), MOUTH, spot.x, bendY, spot.z + 0.155);
  model.add(group);
  model.userData.snorkelGroup = group;
  return group;
}

/** Shows or hides it. */
export function setSnorkel(model, fitted) {
  const g = model.userData.snorkelGroup;
  if (g && g.visible !== fitted) g.visible = fitted;
}
