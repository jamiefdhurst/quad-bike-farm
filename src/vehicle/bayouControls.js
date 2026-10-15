import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { labelMaterial, put, POD } from './foremanControls.js';

// The green quad's bar controls (TODO 90), after a photo of the left switch housing of a 1990s Kawasaki KLF300: a black housing with a
// wide black lights rocker on top, a red OFF / RUN rocker, a big red ENGINE STOP paddle standing out below, and on a foot under it a
// ridged black CHOKE slider in a slot (the same slider the red's has, posed by the quad from `chokeLever`'s `baseX`, `POD.slide` of
// travel) with the start button on the foot's front. Built face to +Z, +X to the picture's right, then turned to face the rider (the
// caller places it). The levers, drive switch and thumb throttle are the red's (foremanControls.js).

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

export function buildBayouPod(MAT) {
  const pod = new THREE.Group();
  pod.name = 'controlPod';
  pod.userData.keep = true;
  pod.scale.setScalar(0.85);
  const body = MAT.plastic;
  const black = new THREE.MeshStandardMaterial({ color: 0x111213, roughness: 0.6 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc0201a, roughness: 0.5 });
  const front = POD.d / 2;

  // The body, and the clamp it hangs from behind.
  rb(POD.w, POD.h, POD.d, 0.004, body, 0, POD.cy, 0, pod, 'podBody', 1);
  rb(0.03, 0.02, 0.02, 0.004, body, 0.012, 0.012, -0.034, pod);

  // Lettering on a plane over the face: ON / RUN and OFF round the red rocker (it is at the pod's middle), the ENGINE STOP caption below.
  const face = labelMaterial(POD.w, POD.h, 4200, (g, W, H, px) => {
    const at = (x, y, text, size, o) => put(g, W, H, px, text, x, y - POD.cy, size, o);
    at(-0.0215, 0.0125, 'OFF', 0.0055);
    at(0.0215, 0.0125, 'RUN', 0.0055);
    at(0.0, -0.0425, 'ENGINE STOP', 0.0058);
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(POD.w * 0.97, POD.h * 0.97), face);
  plane.position.set(0, POD.cy, front + 0.0001);
  plane.name = 'podLabels';
  pod.add(plane);

  // The wide black lights rocker across the top, a dotted pad on it.
  const lights = new THREE.Group();
  lights.name = 'lightsRocker';
  lights.position.set(0, 0.0305, front);
  lights.userData.sideways = true; // this one rocks left to right (about the vertical), not up and down
  pod.add(lights);
  rb(0.052, 0.027, 0.011, 0.004, black, 0, 0, 0.0035, lights, 'lightsRockerCap');
  const dots = [];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) dots.push(strip(new THREE.CylinderGeometry(0.0016, 0.0016, 0.0016, 6)).rotateX(Math.PI / 2).translate((i - 2) * 0.0085, (j - 1) * 0.0075, 0.0098));
  lights.add(new THREE.Mesh(mergeGeometries(dots), new THREE.MeshStandardMaterial({ color: 0x2a2b2d, roughness: 0.6 })));

  // The red OFF / RUN rocker, a pair of wedges, with a split between.
  const stop = new THREE.Group();
  stop.name = 'stopRocker';
  stop.position.set(0, -0.0035, front + 0.002);
  pod.add(stop);
  for (const s of [-1, 1]) rb(0.0245, 0.017, 0.011, 0.003, red, s * 0.0132, 0, 0.0035, stop, undefined, 1);

  // The big red ENGINE STOP paddle, standing out below it.
  rb(0.044, 0.024, 0.016, 0.004, red, 0, -0.0275, front + 0.004, pod, 'engineStop', 1);

  // The foot under the body, out towards the rider: the choke's slot and slider on its top, the start button on its front.
  const footY = -0.0707;
  rb(0.082, 0.014, 0.062, 0.003, body, 0.0125, footY, 0.034, pod, 'chokePlate', 1);
  rb(0.05, 0.0015, 0.009, 0.0008, MAT.hole, 0.0275, footY + 0.0073, 0.05, pod, 'chokeSlot', 1);
  const footTop = footY + 0.007;
  const plateLabel = labelMaterial(0.05, 0.012, 5200, (g, W, H, px) => {
    put(g, W, H, px, 'CHOKE', 0.006, 0, 0.0085);
    g.strokeStyle = '#e9e9e6';
    g.lineWidth = H * 0.1;
    g.beginPath();
    g.moveTo(W * 0.04, H * 0.5);
    g.lineTo(W * 0.2, H * 0.5);
    g.moveTo(W * 0.04, H * 0.5);
    g.lineTo(W * 0.1, H * 0.3);
    g.moveTo(W * 0.04, H * 0.5);
    g.lineTo(W * 0.1, H * 0.7);
    g.stroke();
  });
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.012), plateLabel);
  pl.rotation.x = -Math.PI / 2;
  pl.position.set(0.0275, footTop + 0.0004, 0.032);
  pod.add(pl);
  const choke = new THREE.Group();
  choke.name = 'chokeLever';
  choke.userData.keep = true;
  choke.position.set(0.0405, footTop + 0.001, 0.05);
  choke.userData.baseX = choke.position.x;
  pod.add(choke);
  rb(0.022, 0.013, 0.016, 0.003, black, 0, 0.0065, 0, choke, 'chokeLeverKnob', 1);
  const ribs = [];
  for (let i = 0; i < 4; i++) ribs.push(strip(new THREE.BoxGeometry(0.0024, 0.0024, 0.014)).translate(-0.0075 + i * 0.005, 0.0138, 0));
  choke.add(new THREE.Mesh(mergeGeometries(ribs), MAT.frame));
  const start = new THREE.Group();
  start.name = 'startButton';
  start.position.set(-0.0165, footY, 0.0655);
  pod.add(start);
  rb(0.016, 0.011, 0.007, 0.003, body, 0, 0, 0, start, undefined, 1);
  return pod;
}
