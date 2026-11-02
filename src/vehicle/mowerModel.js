import * as THREE from 'three';
import { MAT, addHeadlightBeams, addTailLights } from './quadModel.js';
import { mergeStatic } from './quadGeometry.js';
import { buildDash, DASH_PLACE } from './dash.js';
import { MOWER_WHEELS, MOWER_RIDER, MOWER_DASH, MOWER_STEER } from './mowerBody.js';
import {
  buildMowerSpin, buildMowerHub, addMowerFrame, addMowerBody, addMowerDeck, addMowerBox, addMowerSteering, addMowerLevers, addMowerEngine, addMowerDecals,
} from './mowerDetail.js';

// The ride-on mower (#76): the Ridgeback Clipper 12, after an old British garden tractor (mowerBody.js has the numbers, mowerDetail.js the
// parts). Same named parts as a quad's model so Quad drives it unchanged (see quadModel.js). Four wheels, small ones at the front that steer
// and fat turf-tread ones behind, a steering wheel on a raked column (`handlebars` turns about the column's own axis), a seat with a back and
// a cutting deck underneath. The blade lever (`bladeLever`) is posed from whether the blade is engaged.
//
// +Z is forward and +X is the rider's left.

export const MOWER_GROUND_OFFSET = -0.3; // chassis origin to the ground at rest, metres
const REST = 0.1; // suspension rest length: matches the spec's suspensionRestLength
const wheelY = (r) => r + REST + MOWER_GROUND_OFFSET; // where each suspension mount sits in the chassis frame

/** Where the wheels, their mounts and the bodywork box are, for QuadPhysics. Small fronts and big rears, each with its own radius. */
export const MOWER_LAYOUT = {
  wheels: [
    { name: 'wheel_fl', x: MOWER_WHEELS.frontX, z: MOWER_WHEELS.frontZ, front: true, radius: MOWER_WHEELS.frontR, y: wheelY(MOWER_WHEELS.frontR) },
    { name: 'wheel_fr', x: -MOWER_WHEELS.frontX, z: MOWER_WHEELS.frontZ, front: true, radius: MOWER_WHEELS.frontR, y: wheelY(MOWER_WHEELS.frontR) },
    { name: 'wheel_rl', x: MOWER_WHEELS.rearX, z: MOWER_WHEELS.rearZ, front: false, radius: MOWER_WHEELS.rearR, y: wheelY(MOWER_WHEELS.rearR) },
    { name: 'wheel_rr', x: -MOWER_WHEELS.rearX, z: MOWER_WHEELS.rearZ, front: false, radius: MOWER_WHEELS.rearR, y: wheelY(MOWER_WHEELS.rearR) },
  ],
  topY: wheelY(MOWER_WHEELS.rearR),
  chassis: { hx: 0.3, hy: 0.2, hz: 0.9, y: 0.3 + MOWER_GROUND_OFFSET },
};

/** The invisible box you look at to get on. */
export const MOWER_PROXY = { w: 1.3, h: 1.2, d: 2.1 };

function buildWheel(w, rimMat) {
  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  spin.name = 'spin';
  spin.userData.keep = true;
  wheel.add(spin);
  buildMowerSpin(spin, MAT, w.front, rimMat);
  buildMowerHub(wheel, MAT, w.front, Math.sign(w.x));
  mergeStatic(wheel);
  return wheel;
}

export function buildMowerModel({ bodyColor = 0x2f5f35, dashStyle = 'mower' } = {}) {
  const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.62, side: THREE.DoubleSide }); // chalky from years in the shed doorway
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x2c302c, roughness: 0.08, metalness: 0.2, emissive: 0x000000 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xc9c6b8, roughness: 0.55, metalness: 0.5 }); // cream-painted pressed steel
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x4c514c, roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide });
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x2c302d, roughness: 0.75 }); // grey-black moulded plastic
  const lidMat = new THREE.MeshStandardMaterial({ color: 0x3b403b, roughness: 0.7 });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x4d6a2a, roughness: 0.95 }); // wet cut grass, caked on
  const quad = new THREE.Group();
  quad.name = 'quad';
  quad.userData.lensMaterial = lensMat;
  quad.userData.seatMaterial = seatMat;
  quad.userData.steerGain = 1.1;
  const body = new THREE.Group();
  body.name = 'body';
  quad.add(body);
  const root = new THREE.Group();
  root.name = 'bodyRoot';
  body.add(root);

  addMowerFrame(root, MAT);
  addMowerBody(root, MAT, paint, lensMat, seatMat);
  addMowerDeck(root, MAT, deckMat, grassMat);
  addMowerBox(root, MAT, grassMat, boxMat, lidMat);
  addMowerLevers(root, MAT);
  addMowerEngine(root, MAT);
  addMowerDecals(root);

  // The steering wheel on its raked column, then the dash on the panel (it doesn't turn with the wheel).
  const bars = addMowerSteering(root, MAT, paint);
  const dash = buildDash(dashStyle);
  const place = DASH_PLACE[dashStyle] ?? DASH_PLACE.mower;
  dash.group.position.set(0.1, MOWER_DASH.y + MOWER_DASH.h / 2 + 0.012, MOWER_DASH.z - 0.015);
  dash.group.rotation.x = place.tilt;
  dash.group.scale.setScalar(1.7);
  dash.group.userData.keep = true;
  root.add(dash.group);
  const mount = new THREE.Object3D();
  mount.name = 'podMount';
  mount.position.set(0.1, MOWER_DASH.y + MOWER_DASH.h / 2 + 0.01, MOWER_DASH.z - 0.02);
  mount.rotation.x = 0.35;
  root.add(mount);
  quad.userData.dash = dash;
  quad.userData.podMount = mount;
  void bars;
  void MOWER_STEER;

  // Anchors for people and the camera: one seat, nobody rides on the back.
  const riderAnchor = new THREE.Object3D();
  riderAnchor.name = 'riderAnchor';
  riderAnchor.position.set(0, MOWER_RIDER.y, MOWER_RIDER.z);
  root.add(riderAnchor);
  const cameraAnchor = new THREE.Object3D();
  cameraAnchor.name = 'cameraAnchor';
  cameraAnchor.position.set(0, MOWER_RIDER.camera, MOWER_RIDER.z);
  root.add(cameraAnchor);
  const pillionCameraAnchor = new THREE.Object3D();
  pillionCameraAnchor.name = 'pillionCameraAnchor';
  pillionCameraAnchor.position.copy(cameraAnchor.position);
  root.add(pillionCameraAnchor);

  // Wheels sit outside the body so they don't rock with it.
  for (const w of MOWER_LAYOUT.wheels) {
    const wheel = buildWheel(w, rimMat);
    wheel.name = w.name;
    quad.add(wheel);
  }

  addHeadlightBeams(quad);
  addTailLights(quad);
  // Names on the parts are for building and looking at them; only the lamps' lenses and the textured decals matter by name, and a named
  // mesh is never merged, so unname the rest and let each material's meshes become one draw call.
  quad.traverse((o) => {
    if (o.isMesh && !o.material.map) o.name = '';
  });
  mergeStatic(root);
  mergeStatic(bars);
  quad.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return quad;
}
