import * as THREE from 'three';

// A girl's lunch bag: a canvas tote with a stripe and two webbing handles, a foil parcel and the neck of a flask poking out of the top. She
// fetches it from her car and sets it by her seat. Procedural, no assets. Metres; the origin is the middle of its base, y up, x across it.

export const LUNCH_BAG = { wide: 0.28, deep: 0.13, high: 0.26, handleHigh: 0.17 };

const mat = (color, roughness = 0.9, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

function box(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

/** The tote: canvas body with a darker base and a stripe, a hem, handles, and the lunch showing. `colour` is the canvas (cream or a faded blue). */
export function buildLunchBag(colour = 0xd9cfae) {
  const { wide, deep, high, handleHigh } = LUNCH_BAG;
  const g = new THREE.Group();
  g.name = 'lunch-bag';
  const canvas = mat(colour);
  const stripe = mat(0x2f4f6e);
  const webbing = mat(0x6b5a3c);
  g.add(box(wide, high, deep, canvas, 0, high / 2, 0));
  g.add(box(wide + 0.004, 0.035, deep + 0.004, mat(0x5b4a33), 0, 0.0175, 0)); // a darker base where it sits on the ground
  for (const s of [-1, 1]) g.add(box(wide + 0.004, 0.022, 0.003, stripe, 0, high * 0.62, s * (deep / 2 + 0.0005))); // a stripe round it
  g.add(box(wide + 0.006, 0.02, deep + 0.006, canvas, 0, high - 0.01, 0)); // the hem
  // Two webbing handles, each a loop up from both sides of the face.
  for (const s of [-1, 1]) {
    const z = s * (deep / 2 + 0.002);
    for (const x of [-0.075, 0.075]) g.add(box(0.022, handleHigh, 0.004, webbing, x, high + handleHigh / 2 - 0.03, z));
    g.add(box(0.172, 0.022, 0.004, webbing, 0, high + handleHigh - 0.03, z));
    g.add(box(0.03, 0.03, 0.005, webbing, -0.075, high * 0.78, z + s * 0.0005), box(0.03, 0.03, 0.005, webbing, 0.075, high * 0.78, z + s * 0.0005)); // stitched boxes
  }
  // The lunch showing at the top: a foil parcel, a flask neck with its cup, and the corner of a banana-yellow napkin.
  const foil = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.07), mat(0xc9ccd0, 0.3, 0.8));
  foil.position.set(-0.05, high + 0.02, 0.005);
  foil.rotation.set(0.1, 0.35, 0.05);
  g.add(foil);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.13, 14), mat(0x3a6b4a, 0.5, 0.2));
  neck.position.set(0.06, high + 0.04, -0.01);
  g.add(neck);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.02, 14), mat(0x1c1c1c, 0.6));
  cap.position.set(0.06, high + 0.115, -0.01);
  g.add(cap);
  g.add(box(0.05, 0.004, 0.05, mat(0xe8d36a), 0.0, high + 0.001, 0.04));
  return g;
}
