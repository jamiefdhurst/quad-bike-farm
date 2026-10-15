import * as THREE from 'three';
import { MAT, add, addHeadlightBeams, addTailLights } from './quadModel.js';
import { mergeStatic } from './quadGeometry.js';
import { buildDash } from './dash.js';
import { DASH_PLACE } from './dash.js';
import { TZ_WHEELS, TZ_BARS_AT } from './tz65Body.js';
import { buildTzSpin, buildTzFork, buildTzRearBrake, addTzFrame, addTzBody, addTzPegs, addTzEngine, addTzExhaust, addTzBars, addTzDecals, silverMaterial } from './tz65Detail.js';

// The mini moto (TODO 94): the Tamura TZ 65, a small motocross bike after a Yamaha YZ65 (tz65Body.js has the numbers, tz65Detail.js the
// parts). Same named parts as a quad's model so Quad drives it unchanged (see quadModel.js). It has two wheels in a line and really leans:
// the chassis rolls under the balance in bikeLean.js (`userData.bike` tells Quad to run it). The whole front end turns about the bars'
// vertical axis (`userData.steerPivotZ`, which quad.js reads), the fork's gold tubes with the bars and its blue legs with the wheel.
//
// +Z is forward and +X is the rider's left.

export const MOTO_GROUND_OFFSET = -0.35; // chassis origin to the ground at rest, metres
const R = TZ_WHEELS.radius; // wheel radius
const REST = 0.12; // suspension rest length: matches the spec's suspensionRestLength
const wheelY = R + REST + MOTO_GROUND_OFFSET; // where each suspension mount sits in the chassis frame
const FRONT_Z = TZ_WHEELS.frontZ;
const REAR_Z = TZ_WHEELS.rearZ;

/** Where the wheels, their mounts and the bodywork box are, for QuadPhysics. Two wheels in a line; bikeLean.js holds it up. */
export const MOTO_LAYOUT = {
  wheels: [
    { name: 'wheel_fl', x: 0, z: FRONT_Z, front: true },
    { name: 'wheel_rl', x: 0, z: REAR_Z, front: false },
  ],
  topY: wheelY,
  chassis: { hx: 0.17, hy: 0.22, hz: 0.7, y: 0.2 },
};

/** The invisible box you look at to get on. */
export const MOTO_PROXY = { w: 0.9, h: 1.2, d: 1.6 };

function buildWheel(w, MAT_, paint) {
  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  spin.name = 'spin';
  spin.userData.keep = true;
  wheel.add(spin);
  buildTzSpin(spin, MAT_, w.front);
  if (w.front) buildTzFork(wheel, MAT_, paint);
  else buildTzRearBrake(wheel, MAT_);
  mergeStatic(wheel);
  return wheel;
}

export function buildMiniMotoModel({ bodyColor = 0x3f6fa8, dashStyle = 'kidsKey' } = {}) {
  const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.35, side: THREE.DoubleSide });
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x2c302c, roughness: 0.08, metalness: 0.2, emissive: 0x000000 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x2b3d63, roughness: 0.7 }); // a dark faded blue foam, its own so frost on one seat is not on them all
  const silver = silverMaterial();
  const quad = new THREE.Group();
  quad.name = 'quad';
  quad.userData.lensMaterial = lensMat;
  quad.userData.seatMaterial = seatMat;
  quad.userData.bike = true;
  quad.userData.steerGain = 1; // the bars and the front wheel turn together, about the same axis
  quad.userData.steerPivotZ = TZ_BARS_AT[2];
  const body = new THREE.Group();
  body.name = 'body';
  quad.add(body);
  const root = new THREE.Group();
  root.name = 'bodyRoot';
  body.add(root);

  addTzFrame(root, MAT, silver);
  addTzBody(root, MAT, paint, seatMat);
  addTzEngine(root, MAT, paint);
  addTzExhaust(root, MAT);
  addTzPegs(root, MAT);
  addTzDecals(root);

  // The bars and the upper fork, turning with the steering; the key switch on the clamp and the pod's mount are on them.
  const bars = new THREE.Group();
  bars.name = 'handlebars';
  bars.userData.keep = true;
  bars.position.set(...TZ_BARS_AT);
  addTzBars(bars, MAT, paint);
  const dash = buildDash(dashStyle);
  const place = DASH_PLACE[dashStyle] ?? DASH_PLACE.kidsKey;
  dash.group.position.set(0, 0.064, 0);
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
  mount.position.set(0, 0.15, 0.012);
  mount.rotation.x = 0.35;
  bars.add(mount);
  bars.userData.podMount = mount;
  root.add(bars);
  quad.userData.dash = bars.userData.dash;
  quad.userData.podMount = bars.userData.podMount;

  // Anchors for people and the camera. One seat: nobody rides on the back.
  const riderAnchor = new THREE.Object3D();
  riderAnchor.name = 'riderAnchor';
  riderAnchor.position.set(0, 0.78, -0.2);
  root.add(riderAnchor);
  const pillionCameraAnchor = new THREE.Object3D();
  pillionCameraAnchor.name = 'pillionCameraAnchor';
  pillionCameraAnchor.position.set(0, 1.57, -0.22);
  root.add(pillionCameraAnchor);
  const cameraAnchor = new THREE.Object3D();
  cameraAnchor.name = 'cameraAnchor';
  cameraAnchor.position.set(0, 1.57, -0.22); // eyes 0.79 m above the seat
  root.add(cameraAnchor);

  // Wheels sit outside the body so they don't rock with it.
  for (const w of MOTO_LAYOUT.wheels) {
    const wheel = buildWheel(w, MAT, paint);
    wheel.name = w.name;
    quad.add(wheel);
  }

  addHeadlightBeams(quad); // (no lamps: nothing is found to give a beam)
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
