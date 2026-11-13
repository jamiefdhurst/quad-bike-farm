import * as THREE from 'three';
import { MAT, addHeadlightBeams, addTailLights } from './quadModel.js';
import { mergeStatic } from './quadGeometry.js';
import { buildDash, DASH_PLACE } from './dash.js';
import { PLOVER_WHEELS, PLOVER_BARS_AT, PLOVER_RIDER } from './ploverBody.js';
import { buildPloverSpin, buildPloverFork, buildPloverRearBrake, addPloverFrame, addPloverBody, addPloverEngine, addPloverPegs, addPloverBars, addPloverDecals } from './ploverDetail.js';

// The old bike (#38, TODO 143): the Ashby Plover 125, a rigid-frame 1949 single (ploverBody.js has the numbers, ploverDetail.js the
// parts). Same named parts as a quad's model so Quad drives it unchanged (see quadModel.js). It has two wheels in a line and leans: the chassis
// rolls under the balance in bikeLean.js (`userData.bike` tells Quad to run it). The whole front end turns about the bars' vertical axis
// (`userData.steerPivotZ`, which quad.js reads). Its own parts: `kickStart` (the pedal), `advanceLever` (the lever on the left bar, its `advanceArm`
// child swung by the engine's setting) and `tickler` (the carb's button).
//
// +Z is forward and +X is the rider's left.

export const PLOVER_GROUND_OFFSET = -0.44; // chassis origin to the ground at rest, metres
const R = PLOVER_WHEELS.radius; // wheel radius
const REST = 0.12; // suspension rest length: matches the spec's suspensionRestLength
const wheelY = R + REST + PLOVER_GROUND_OFFSET; // where each suspension mount sits in the chassis frame

/** Where the wheels, their mounts and the bodywork box are, for QuadPhysics. Two wheels in a line; bikeLean.js holds it up. */
export const PLOVER_LAYOUT = {
  wheels: [
    { name: 'wheel_fl', x: 0, z: PLOVER_WHEELS.frontZ, front: true },
    { name: 'wheel_rl', x: 0, z: PLOVER_WHEELS.rearZ, front: false },
  ],
  topY: wheelY,
  chassis: { hx: 0.18, hy: 0.25, hz: 0.75, y: 0.22 },
};

/** The invisible box you look at to get on. */
export const PLOVER_PROXY = { w: 0.9, h: 1.3, d: 1.9 };

function buildWheel(w, paint) {
  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  spin.name = 'spin';
  spin.userData.keep = true;
  wheel.add(spin);
  buildPloverSpin(spin, MAT, paint, w.front);
  if (w.front) buildPloverFork(wheel, MAT, paint);
  else buildPloverRearBrake(wheel, MAT);
  mergeStatic(wheel);
  return wheel;
}

export function buildPloverModel({ bodyColor = 0x7f9a74, dashStyle = 'plover' } = {}) {
  const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.3, side: THREE.DoubleSide });
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x2c302c, roughness: 0.08, metalness: 0.2, emissive: 0x000000 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.55 }); // black leather, its own so frost on one seat is not on them all
  const quad = new THREE.Group();
  quad.name = 'quad';
  quad.userData.lensMaterial = lensMat;
  quad.userData.seatMaterial = seatMat;
  quad.userData.bike = true;
  quad.userData.steerGain = 1; // the bars and the front wheel turn together, about the same axis
  quad.userData.steerPivotZ = PLOVER_BARS_AT[2];
  const body = new THREE.Group();
  body.name = 'body';
  quad.add(body);
  const root = new THREE.Group();
  root.name = 'bodyRoot';
  body.add(root);

  addPloverFrame(root, MAT, paint);
  addPloverBody(root, MAT, paint, seatMat);
  addPloverEngine(root, MAT, paint);
  addPloverPegs(root, MAT);
  addPloverDecals(root);

  // The bars and the upper fork, turning with the steering; the headlamp with the speedo in its top and the pod's mount are on them.
  const bars = new THREE.Group();
  bars.name = 'handlebars';
  bars.userData.keep = true;
  bars.position.set(...PLOVER_BARS_AT);
  const lamp = addPloverBars(bars, MAT, paint, lensMat);
  const dash = buildDash(dashStyle);
  const place = DASH_PLACE[dashStyle] ?? DASH_PLACE.smiths;
  dash.group.position.set(0, 0.086, lamp.lampZ - 0.045);
  dash.group.rotation.x = place.tilt;
  dash.group.userData.keep = true;
  bars.add(dash.group);
  bars.userData.dash = dash;
  const hands = new THREE.Object3D();
  hands.name = 'riderHands';
  bars.add(hands);
  const mount = new THREE.Object3D();
  mount.name = 'podMount';
  mount.position.set(0, 0.11, -0.01);
  mount.rotation.x = 0.35;
  bars.add(mount);
  bars.userData.podMount = mount;
  root.add(bars);
  quad.userData.dash = bars.userData.dash;
  quad.userData.podMount = bars.userData.podMount;

  // Anchors for people and the camera. One saddle: nobody rides on the back.
  const riderAnchor = new THREE.Object3D();
  riderAnchor.name = 'riderAnchor';
  riderAnchor.position.set(0, PLOVER_RIDER.y, PLOVER_RIDER.z);
  root.add(riderAnchor);
  const pillionCameraAnchor = new THREE.Object3D();
  pillionCameraAnchor.name = 'pillionCameraAnchor';
  pillionCameraAnchor.position.set(0, PLOVER_RIDER.camera, PLOVER_RIDER.z);
  root.add(pillionCameraAnchor);
  const cameraAnchor = new THREE.Object3D();
  cameraAnchor.name = 'cameraAnchor';
  cameraAnchor.position.set(0, PLOVER_RIDER.camera, PLOVER_RIDER.z);
  root.add(cameraAnchor);

  // Wheels sit outside the body so they don't rock with it.
  for (const w of PLOVER_LAYOUT.wheels) {
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
