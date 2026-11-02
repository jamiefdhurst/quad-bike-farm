import * as THREE from 'three';
import { MAT, addHeadlightBeams, addTailLights } from './quadModel.js';
import { mergeStatic } from './quadGeometry.js';
import { buildDash, DASH_PLACE } from './dash.js';
import { AG_WHEELS, AG_BARS_AT, AG_RIDER, AG_PILLION } from './ag200Body.js';
import { buildAgSpin, buildAgFork, buildAgRearBrake, addAgFrame, addAgBody, addAgEngine, addAgPegs, addAgBars, addAgDecals, rackMaterial } from './ag200Detail.js';

// The farm bike (#75): the Ridgeback AG200, a shepherd's trail bike after a Yamaha AG200 (ag200Body.js has the numbers, ag200Detail.js the
// parts). Same named parts as a quad's model so Quad drives it unchanged (see quadModel.js). It has two wheels in a line and leans: the chassis
// rolls under the balance in bikeLean.js (`userData.bike` tells Quad to run it). The whole front end turns about the bars' vertical axis
// (`userData.steerPivotZ`, which quad.js reads). It is the first two-wheeler with room on the back: a `pillionAnchor` on the long dual seat, with
// a grab strap's two ends for her to hold (`pillionGripLeft` and `pillionGripRight`) and her own pegs.
//
// +Z is forward and +X is the rider's left.

export const AG_GROUND_OFFSET = -0.44; // chassis origin to the ground at rest, metres
const R = AG_WHEELS.radius; // wheel radius
const REST = 0.12; // suspension rest length: matches the spec's suspensionRestLength
const wheelY = R + REST + AG_GROUND_OFFSET; // where each suspension mount sits in the chassis frame

/** Where the wheels, their mounts and the bodywork box are, for QuadPhysics. Two wheels in a line; bikeLean.js holds it up. */
export const AG_LAYOUT = {
  wheels: [
    { name: 'wheel_fl', x: 0, z: AG_WHEELS.frontZ, front: true },
    { name: 'wheel_rl', x: 0, z: AG_WHEELS.rearZ, front: false },
  ],
  topY: wheelY,
  chassis: { hx: 0.18, hy: 0.25, hz: 0.8, y: 0.22 },
};

/** The invisible box you look at to get on. */
export const AG_PROXY = { w: 0.9, h: 1.35, d: 2.0 };

function buildWheel(w, MAT_, paint) {
  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  spin.name = 'spin';
  spin.userData.keep = true;
  wheel.add(spin);
  buildAgSpin(spin, MAT_, w.front);
  if (w.front) buildAgFork(wheel, MAT_, paint);
  else buildAgRearBrake(wheel, MAT_);
  mergeStatic(wheel);
  return wheel;
}

export function buildAgModel({ bodyColor = 0x2f5fa0, dashStyle = 'trail' } = {}) {
  const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.45, side: THREE.DoubleSide });
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x2c302c, roughness: 0.08, metalness: 0.2, emissive: 0x000000 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1c, roughness: 0.7 }); // black vinyl, its own so frost on one seat is not on them all
  const rack = rackMaterial();
  const quad = new THREE.Group();
  quad.name = 'quad';
  quad.userData.lensMaterial = lensMat;
  quad.userData.seatMaterial = seatMat;
  quad.userData.bike = true;
  quad.userData.steerGain = 1; // the bars and the front wheel turn together, about the same axis
  quad.userData.steerPivotZ = AG_BARS_AT[2];
  const body = new THREE.Group();
  body.name = 'body';
  quad.add(body);
  const root = new THREE.Group();
  root.name = 'bodyRoot';
  body.add(root);

  addAgFrame(root, MAT);
  addAgBody(root, MAT, paint, seatMat, rack);
  addAgEngine(root, MAT);
  addAgPegs(root, MAT);
  addAgDecals(root);

  // The bars and the upper fork, turning with the steering; the headlamp, the front rack, the speedo and the pod's mount are on them.
  const bars = new THREE.Group();
  bars.name = 'handlebars';
  bars.userData.keep = true;
  bars.position.set(...AG_BARS_AT);
  const lamp = addAgBars(bars, MAT, paint, lensMat, rack);
  const dash = buildDash(dashStyle);
  const place = DASH_PLACE[dashStyle] ?? DASH_PLACE.trail;
  dash.group.position.set(0, 0.1, 0.0);
  dash.group.rotation.x = place.tilt;
  dash.group.userData.keep = true;
  bars.add(dash.group);
  bars.userData.dash = dash;
  const hands = new THREE.Object3D();
  hands.name = 'riderHands';
  bars.add(hands);
  const mount = new THREE.Object3D();
  mount.name = 'podMount';
  mount.position.set(0, 0.13, -0.03);
  mount.rotation.x = 0.35;
  bars.add(mount);
  bars.userData.podMount = mount;
  root.add(bars);
  quad.userData.dash = bars.userData.dash;
  quad.userData.podMount = bars.userData.podMount;
  void lamp;

  // Anchors for people and the camera: the rider at the front of the long seat, and her behind.
  const riderAnchor = new THREE.Object3D();
  riderAnchor.name = 'riderAnchor';
  riderAnchor.position.set(0, AG_RIDER.y, AG_RIDER.z);
  root.add(riderAnchor);
  const cameraAnchor = new THREE.Object3D();
  cameraAnchor.name = 'cameraAnchor';
  cameraAnchor.position.set(0, AG_RIDER.camera, AG_RIDER.z);
  root.add(cameraAnchor);
  const pillionAnchor = new THREE.Object3D();
  pillionAnchor.name = 'pillionAnchor';
  pillionAnchor.position.set(0, AG_PILLION.y, AG_PILLION.z);
  root.add(pillionAnchor);
  const pillionCameraAnchor = new THREE.Object3D();
  pillionCameraAnchor.name = 'pillionCameraAnchor';
  pillionCameraAnchor.position.set(0, AG_PILLION.camera, AG_PILLION.z);
  root.add(pillionCameraAnchor);
  // The strap's two ends, where her hands go when nobody is in front of her.
  for (const s of [-1, 1]) {
    const grip = new THREE.Object3D();
    grip.name = s > 0 ? 'pillionGripLeft' : 'pillionGripRight';
    grip.position.set(s * 0.1, 0.835, -0.4);
    grip.userData.strap = true;
    root.add(grip);
  }

  // Wheels sit outside the body so they don't rock with it.
  for (const w of AG_LAYOUT.wheels) {
    const wheel = buildWheel(w, MAT, paint);
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
