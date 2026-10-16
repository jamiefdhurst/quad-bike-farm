import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { labelMaterial, put } from './foremanControls.js';
import { sweepGeometry } from './quadGeometry.js';

// The blue quad's left switch pod (TODO 89), after a photo of the real one: a black body with a wide grey LIGHTS rocker on its left and
// the HI, LO and OFF positions printed beside it, a lower step with the engine-stop symbols, a red stop switch and a grey start button
// under it, and the choke lever hanging from its underside (`chokeLever`, posed by the quad: pulled towards the rider to apply).
// Built face to +Z, +X to the picture's right, then turned to face the rider (the caller places it).

const strip = (g) => {
  g.deleteAttribute('uv');
  return g;
};

function rb(w, h, d, r, mat, x, y, z, parent, name, segments = 2) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, segments, Math.min(r, w / 2, h / 2, d / 2) * 0.999), mat);
  m.position.set(x, y, z);
  if (name) m.name = name;
  parent.add(m);
  return m;
}

export const GRIZZLY_POD = { w: 0.058, h: 0.07, d: 0.046 };

/** `choke` false leaves the lever off, for an injected engine (the Kodiak's). */
export function buildGrizzlyPod(MAT, { choke: withChoke = true } = {}) {
  const pod = new THREE.Group();
  pod.name = 'controlPod';
  pod.userData.keep = true;
  const P = GRIZZLY_POD;
  const front = P.d / 2;
  const grey = new THREE.MeshStandardMaterial({ color: 0x9a9b98, roughness: 0.55 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc0201a, roughness: 0.5 });
  rb(P.w, P.h, P.d, 0.004, MAT.plastic, 0, 0, 0, pod, 'podBody', 1);
  rb(0.026, 0.02, 0.02, 0.004, MAT.plastic, 0.01, 0.01, -0.032, pod); // the clamp behind
  // The step under the body, wider at the back, carrying the symbols on its front.
  rb(P.w * 0.96, 0.02, P.d * 1.12, 0.004, MAT.plastic, 0, -P.h / 2 - 0.006, 0.004, pod, 'podStep', 1);

  const face = labelMaterial(P.w, P.h, 4200, (g, W, H, px) => {
    put(g, W, H, px, 'HI', 0.014, 0.019, 0.0062);
    put(g, W, H, px, 'LO', 0.014, 0.003, 0.0062);
    put(g, W, H, px, 'OFF', 0.0155, -0.0125, 0.0058);
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(P.w * 0.97, P.h * 0.97), face);
  plane.position.set(0, 0, front + 0.0001);
  plane.name = 'podLabels';
  pod.add(plane);
  const stepLabel = labelMaterial(0.05, 0.014, 5200, (g, W, H, px) => {
    put(g, W, H, px, '⊗', -0.008, 0, 0.0105);
    put(g, W, H, px, '↻', 0.011, 0, 0.0105);
  });
  const sp = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.014), stepLabel);
  sp.position.set(0, -P.h / 2 - 0.006, front + P.d * 0.06 + 0.0042);
  sp.name = 'podStepLabels';
  pod.add(sp);

  // The grey LIGHTS rocker, taller than the pod's left half, with a dotted pad; the top end in for HI.
  const lights = new THREE.Group();
  lights.name = 'lightsRocker';
  lights.position.set(-0.017, 0.006, front);
  pod.add(lights);
  rb(0.024, 0.05, 0.012, 0.004, grey, 0, 0, 0.004, lights, 'lightsRockerCap');
  const dots = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 5; j++) dots.push(strip(new THREE.CylinderGeometry(0.0013, 0.0013, 0.0014, 6)).rotateX(Math.PI / 2).translate((i - 1) * 0.0065, (j - 2) * 0.0085, 0.0105));
  lights.add(new THREE.Mesh(mergeGeometries(dots), new THREE.MeshStandardMaterial({ color: 0xc9cac6, roughness: 0.5 })));
  // The choke lever, hanging from the pod's underside at its right, clear of the buttons: a tapered black stalk with a ridged paddle at its tip.
  // It pivots at the top and the quad swings it about X (pulled towards the rider, +Z here, to apply the choke).
  if (withChoke) {
    const choke = new THREE.Group();
    choke.name = 'chokeLever';
    choke.userData.keep = true;
    choke.position.set(0.0215, -P.h / 2 - 0.016, 0.012); // to the right of the stop and start buttons, so it never swings across them
    pod.add(choke);
    const path = [[0, 0, 0], [0, -0.016, 0.002], [0, -0.03, 0.006], [0, -0.042, 0.012]];
    choke.add(new THREE.Mesh(sweepGeometry(path, (t) => 0.0042 - 0.0008 * t, { radial: 8 }), MAT.frame));
    rb(0.013, 0.012, 0.008, 0.003, MAT.frame, 0, -0.047, 0.014, choke, 'chokeLeverKnob', 1).rotation.x = -0.4;
    const ribs = [];
    for (let i = 0; i < 4; i++) ribs.push(strip(new THREE.BoxGeometry(0.013, 0.0016, 0.0016)).translate(0, -0.044 - i * 0.0025, 0.0187));
    choke.add(new THREE.Mesh(mergeGeometries(ribs), MAT.rubber));
  }
  // The red engine stop on the step, a wedge, and the grey start button below it.
  const stop = new THREE.Group();
  stop.name = 'stopRocker';
  stop.position.set(0, -P.h / 2 - 0.004, front + 0.002);
  pod.add(stop);
  rb(0.03, 0.016, 0.012, 0.003, red, 0, 0, 0.004, stop, undefined, 1);
  const start = new THREE.Group();
  start.name = 'startButton';
  start.position.set(-0.006, -P.h / 2 - 0.021, front + 0.002);
  pod.add(start);
  rb(0.02, 0.009, 0.008, 0.003, grey, 0, 0, 0, start, undefined, 1);
  return pod;
}
