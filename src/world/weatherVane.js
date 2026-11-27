// The weather vane on the barn's ridge (#169, #817): a black wrought-iron cockerel cut from flat iron on an arrow with a tail fin, over fixed N, S, E and W arms,
// on a spindle with a collar and a bracket strapped to the ridge. The arrow turns to point into the day's wind (`vaneHeading`), with a flutter in the gusts.

import * as THREE from 'three';
import { canvasTexture, worldBox } from './outbuildingProps.js';
import { bag, put, ironTexture } from './yardKit.js';
import { barnFrame, barnShape } from './barn.js';

const FOLLOW = 1.6; // how quickly the arrow comes round to the wind (the fraction of the gap it closes each second)
const TAU = Math.PI * 2;

/** The shortest signed turn from heading `a` to `b`, radians. */
export function turnBetween(a, b) {
  return ((((b - a) % TAU) + 3 * Math.PI) % TAU) - Math.PI;
}

/**
 * The heading (radians from +z towards +x) the arrow points on the next frame: it comes round to face into the wind (where the wind blows from, so `windHeading` + a half turn),
 * more briskly in a stronger wind, with a little flutter either side in a gust. `time` is seconds; `strength` the wind as a multiple of an ordinary day's.
 */
export function vaneHeading(current, windHeading, strength, dt, time) {
  const target = windHeading + Math.PI + Math.sin(time * 2.3) * 0.07 * Math.min(2, strength) * Math.min(1, strength);
  const k = Math.min(1, FOLLOW * dt * (0.5 + Math.min(1.5, strength)));
  return current + turnBetween(current, target) * k;
}

/** The cockerel's flat silhouette, facing +x: breast, comb, beak, back, a sweep of tail feathers, and two legs set on the bar. About 0.55 m long and 0.45 m tall. */
function cockerelShape() {
  const s = new THREE.Shape();
  s.moveTo(0.1, 0.02); // the breast's lowest point
  s.bezierCurveTo(0.2, 0.05, 0.25, 0.15, 0.22, 0.25); // up the breast to the throat
  s.lineTo(0.25, 0.36); // the neck's front
  s.lineTo(0.3, 0.37);
  s.lineTo(0.34, 0.345); // the beak
  s.lineTo(0.28, 0.325);
  s.lineTo(0.27, 0.42); // the face up to the wattle and eye
  s.lineTo(0.245, 0.45); // the comb's points
  s.lineTo(0.23, 0.42);
  s.lineTo(0.215, 0.46);
  s.lineTo(0.195, 0.415);
  s.lineTo(0.17, 0.43);
  s.bezierCurveTo(0.15, 0.34, 0.08, 0.3, -0.02, 0.27); // down the back of the neck to the back
  s.bezierCurveTo(-0.1, 0.27, -0.16, 0.3, -0.2, 0.38); // the back rising into the tail
  s.bezierCurveTo(-0.26, 0.42, -0.3, 0.38, -0.3, 0.3); // the longest feather arching over and back
  s.lineTo(-0.27, 0.3);
  s.bezierCurveTo(-0.3, 0.22, -0.28, 0.14, -0.2, 0.11);
  s.lineTo(-0.2, 0.16);
  s.bezierCurveTo(-0.17, 0.1, -0.1, 0.08, -0.06, 0.07);
  s.lineTo(-0.02, 0.0); // the near leg
  s.lineTo(0.0, 0.0);
  s.lineTo(0.03, 0.07);
  s.lineTo(0.06, 0.0); // and the far one, behind it
  s.lineTo(0.085, 0.0);
  s.closePath();
  return s;
}

/** The tail fin: a flat plate on the arrow's end with a V cut in it, facing along x (the vane's pointing is +x). */
function finShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.07);
  s.lineTo(-0.34, -0.19);
  s.lineTo(-0.28, 0);
  s.lineTo(-0.34, 0.19);
  s.lineTo(0, 0.07);
  s.closePath();
  return s;
}

/** A small flat letter as a lit cut-out: the letter in black on a transparent plane. */
function letterTexture(ch) {
  return canvasTexture(64, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#17181a';
    ctx.font = 'bold 54px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, w / 2, h / 2 + 3);
  });
}

/**
 * The weather vane on the barn's ridge, near the door gable's end. Returns the group (`userData.head` is the part that turns: set `head.rotation.y` from `vaneHeading`
 * with `headingToRotation`), or null on a farm without a barn.
 */
export function buildWeatherVane({ scene, layout, heights, random }) {
  if (!layout.barn) return null;
  const s = barnShape({ ...layout, ...layout.barnLocal });
  const frame = barnFrame(layout);
  const floorY = heights.heightAt(s.x, s.z);
  const p = frame.toWorld(s.x, s.outer.maxZ - 1.7); // the ridge runs along the barn's z, across its doors: near its end
  const top = floorY + s.ridge + 0.12; // the ridge cap's top
  const iron = new THREE.MeshStandardMaterial({ map: ironTexture(random), roughness: 0.6, metalness: 0.55 });
  const gilt = new THREE.MeshStandardMaterial({ color: 0xb48c34, roughness: 0.4, metalness: 0.7 }); // the collar's ball, gilded as they are
  const group = new THREE.Group();
  group.name = 'weatherVane';
  group.position.set(p.x, top, p.z);

  const fixed = bag();
  const along = frame.yaw + Math.PI / 2; // the ridge runs along the barn's z; the bracket's straps lie across it
  fixed.add(iron, put(worldBox(0.34, 0.05, 0.2, 1), 0, 0.01, 0, along)); // the bracket's plate on the ridge
  for (const dx of [-0.1, 0.1]) fixed.add(iron, put(worldBox(0.03, 0.3, 0.03, 1), dx * Math.cos(along), -0.1, -dx * Math.sin(along))); // and its straps down either side of the cap
  fixed.add(iron, put(new THREE.CylinderGeometry(0.014, 0.018, 1.2, 8), 0, 0.6, 0)); // the spindle
  fixed.add(gilt, put(new THREE.SphereGeometry(0.05, 12, 8), 0, 0.5, 0)); // the ball where the arms cross
  fixed.add(iron, put(new THREE.CylinderGeometry(0.03, 0.03, 0.035, 10), 0, 0.46, 0)); // and the collar under it
  const arm = 0.42;
  const letters = new Map();
  for (const [ch, dx, dz] of [['N', 0, -1], ['S', 0, 1], ['E', 1, 0], ['W', -1, 0]]) { // north is -z, the plan's up
    fixed.add(iron, put(new THREE.CylinderGeometry(0.009, 0.009, arm, 6), dx * arm / 2, 0.5, dz * arm / 2, 0, dz ? Math.PI / 2 : 0, dx ? Math.PI / 2 : 0));
    fixed.add(iron, put(new THREE.SphereGeometry(0.018, 8, 6), dx * arm, 0.5, dz * arm)); // a bead on each arm's end
    const m = new THREE.MeshStandardMaterial({ map: letterTexture(ch), roughness: 0.8, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
    letters.set(ch, m);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), m);
    plane.position.set(dx * (arm + 0.12), 0.5, dz * (arm + 0.12));
    plane.rotation.y = dx ? Math.PI / 2 : 0; // standing across the arm, facing outwards
    group.add(plane);
  }
  group.add(fixed.group());

  // The part that turns: an arrow on the spindle's tip, its head forward (+x), a tail fin behind and the cockerel on top of it.
  const head = new THREE.Group();
  head.position.y = 1.2;
  const mov = bag();
  mov.add(iron, put(new THREE.CylinderGeometry(0.011, 0.011, 1.0, 8), 0, 0, 0, 0, 0, Math.PI / 2)); // the shaft
  mov.add(iron, put(new THREE.ConeGeometry(0.05, 0.16, 4), 0.58, 0, 0, 0, 0, -Math.PI / 2)); // the arrowhead
  mov.add(iron, put(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 8), 0, 0, 0)); // the cap turning on the spindle
  mov.add(iron, new THREE.ExtrudeGeometry(finShape(), { depth: 0.008, bevelEnabled: false }).translate(-0.18, 0, -0.004)); // upright, in the plane of the arrow
  mov.add(iron, new THREE.ExtrudeGeometry(cockerelShape(), { depth: 0.012, bevelEnabled: false }).translate(0.1, 0.008, -0.006));
  head.add(mov.group());
  group.add(head);
  group.userData.head = head;
  group.userData.letters = [...letters.keys()];
  group.userData.set = (heading) => { head.rotation.y = heading - Math.PI / 2; }; // authored along +x: a heading h has +x turned to (sin h, cos h)
  scene.add(group);
  return group;
}
