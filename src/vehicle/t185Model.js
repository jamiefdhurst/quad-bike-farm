import * as THREE from 'three';
import { MAT, addHeadlightBeams, addTailLights } from './quadModel.js';
import { mergeStatic } from './quadGeometry.js';
import { buildDash, DASH_PLACE } from './dash.js';
import { T185_WHEELS, T185_BARS_AT } from './t185Body.js';
import { buildAtcSpin, buildAtcFork, addAtcFrame, addAtcBody, addAtcPegs, addAtcEngine, addAtcExhaust, addAtcBars, addAtcDecals } from './t185Detail.js';

// The neighbour's old three-wheeler (TODO 95): the Kestrel T185, (t185Body.js has the numbers, t185Detail.js the parts):
// one front wheel on a raked fork under two red steering columns, two fat balloon tyres at the back on a solid axle, a long flat seat on one
// wide red body, and the engine in the open. A tall, narrow stance, so it tips if you throw it round. Same named parts as a quad's model so
// Quad drives it unchanged (see quadModel.js). The front end turns about the bars' vertical axis (`userData.steerPivotZ`, read by quad.js).
//
// +Z is forward and +X is the rider's left.

export const T185_GROUND_OFFSET = -0.4; // chassis origin to the ground at rest, metres
const R = T185_WHEELS.radius; // wheel radius
const REST = 0.2; // suspension rest length: matches the spec's suspensionRestLength
const wheelY = R + REST + T185_GROUND_OFFSET; // where each suspension mount sits in the chassis frame
const FRONT_Z = T185_WHEELS.frontZ;
const REAR_Z = T185_WHEELS.rearZ;
const HALF_TRACK = T185_WHEELS.halfTrack;

/** Where the wheels, their mounts and the bodywork box are, for QuadPhysics: one wheel at the front, two at the back. */
export const T185_LAYOUT = {
  wheels: [
    { name: 'wheel_fl', x: 0, z: FRONT_Z, front: true, stiffness: 2 }, // the lone front wheel carries about twice what a rear one does
    { name: 'wheel_rl', x: HALF_TRACK, z: REAR_Z, front: false },
    { name: 'wheel_rr', x: -HALF_TRACK, z: REAR_Z, front: false },
  ],
  topY: wheelY,
  chassis: { hx: 0.3, hy: 0.2, hz: 0.9, y: 0.2 },
};

/** The invisible box you look at to get on. */
export const T185_PROXY = { w: 1.3, h: 1.2, d: 2.0 };

function buildWheel(w, paint) {
  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  spin.name = 'spin';
  spin.userData.keep = true;
  wheel.add(spin);
  buildAtcSpin(spin, MAT, w.front);
  mergeStatic(wheel);
  if (w.front) {
    buildAtcFork(wheel, MAT, paint);
    mergeStatic(wheel);
  }
  return wheel;
}

export function buildAtcModel({ bodyColor = 0xb4553f, dashStyle = 'kidsKey' } = {}) {
  const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.6, side: THREE.DoubleSide }); // chalky from years in the sun
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x2c302c, roughness: 0.08, metalness: 0.2, emissive: 0x000000 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x1c1b1a, roughness: 0.7 }); // its own, so frost on one seat is not on them all
  const quad = new THREE.Group();
  quad.name = 'quad';
  quad.userData.lensMaterial = lensMat;
  quad.userData.seatMaterial = seatMat;
  quad.userData.riderLean = true; // the rider shifts their weight into corners by themselves (riderLean.js)
  quad.userData.steerGain = 1; // the bars and the front wheel turn together, about the same axis
  quad.userData.steerPivotZ = T185_BARS_AT[2];
  const body = new THREE.Group();
  body.name = 'body';
  quad.add(body);
  const root = new THREE.Group();
  root.name = 'bodyRoot';
  body.add(root);

  addAtcFrame(root, MAT);
  addAtcBody(root, MAT, paint, seatMat);
  addAtcEngine(root, MAT);
  addAtcExhaust(root, MAT);
  addAtcPegs(root, MAT);
  addAtcDecals(root);

  // The bars and the columns, turning with the steering; the key switch on the clamp and the pod's mount are on them.
  const bars = new THREE.Group();
  bars.name = 'handlebars';
  bars.userData.keep = true;
  bars.position.set(...T185_BARS_AT);
  addAtcBars(bars, MAT, paint, lensMat);
  const dash = buildDash(dashStyle);
  const place = DASH_PLACE[dashStyle] ?? DASH_PLACE.kidsKey;
  dash.group.position.set(0, 0.075, 0.0);
  dash.group.rotation.x = place.tilt;
  dash.group.scale.setScalar(0.85);
  dash.group.userData.keep = true;
  bars.add(dash.group);
  bars.userData.dash = dash;
  const hands = new THREE.Object3D();
  hands.name = 'riderHands';
  bars.add(hands);
  const mount = new THREE.Object3D();
  mount.name = 'podMount';
  mount.position.set(0, 0.095, 0.0);
  mount.rotation.x = 0.35;
  bars.add(mount);
  bars.userData.podMount = mount;
  root.add(bars);
  quad.userData.dash = bars.userData.dash;
  quad.userData.podMount = bars.userData.podMount;

  // Anchors for people and the camera. One seat: nobody rides on the back.
  const riderAnchor = new THREE.Object3D();
  riderAnchor.name = 'riderAnchor';
  riderAnchor.position.set(0, 0.92, -0.3);
  root.add(riderAnchor);
  const pillionCameraAnchor = new THREE.Object3D();
  pillionCameraAnchor.name = 'pillionCameraAnchor';
  pillionCameraAnchor.position.set(0, 1.71, -0.32);
  root.add(pillionCameraAnchor);
  const cameraAnchor = new THREE.Object3D();
  cameraAnchor.name = 'cameraAnchor';
  cameraAnchor.position.set(0, 1.71, -0.32); // eyes 0.79 m above the seat
  root.add(cameraAnchor);

  // Wheels sit outside the body so they don't rock with it.
  for (const w of T185_LAYOUT.wheels) {
    const wheel = buildWheel(w, paint);
    wheel.name = w.name;
    quad.add(wheel);
  }

  addHeadlightBeams(quad);
  addTailLights(quad);
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
