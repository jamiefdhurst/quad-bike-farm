import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { rod } from './quadGeometry.js';

// The wipers' side of the models (#103): which wipers sweep and how far, the glass the rain lands on, the wiper stalk, and posing them.
//
// A model marks each front wiper with `markWiper` (the kit's `buildWiper` group, or any group whose local z is the glass's normal and whose
// rotation.z turns the arm across it) and its windscreen with `addRainGlass`: an empty group in the glass's frame (x across, y up the glass,
// z out of it) carrying the panes as corners in metres, which effects/screenRainView.js hangs the drops on. vehicle/wipers.js moves them.

/** Marks a parked wiper to sweep `sweep` radians (signed: positive turns its arm from +x towards +y) from where it lies now. */
export function markWiper(wiper, sweep) {
  wiper.userData.keep = true;
  wiper.userData.wiperPark = wiper.rotation.z;
  wiper.userData.wiperSweep = sweep;
  return wiper;
}

/**
 * The windscreen's frame for the drops: a group at the middle of the glass, turned to lie on it, 3 mm outside it so the drops are on the
 * outside of the glass and under the blades. `panes` are each a list of [x, y] corners in that frame, going round.
 */
export function addRainGlass(parent, { position, rotationX = 0, panes }) {
  const g = new THREE.Group();
  g.name = 'rainGlass';
  g.userData.keep = true;
  g.userData.panes = panes;
  g.position.set(position[0], position[1], position[2]);
  g.rotation.x = rotationX;
  g.translateZ(0.003);
  parent.add(g);
  return g;
}

/** The rain glass for a screen given as its foot and top lines (z, y) and half widths, as the cars and the UTV build theirs, inset by `inset`. */
export function addRainGlassBetween(parent, { foot, top, halfFoot, halfTop, inset = 0.02 }) {
  const [zs, ys] = foot;
  const [zt, yt] = top;
  const L = Math.hypot(yt - ys, zt - zs);
  const h = L / 2 - inset;
  return addRainGlass(parent, {
    position: [0, (ys + yt) / 2, (zs + zt) / 2],
    rotationX: Math.atan2(zt - zs, yt - ys),
    panes: [[[-(halfFoot - inset), -h], [halfFoot - inset, -h], [halfTop - inset, h], [-(halfTop - inset), h]]],
  });
}

/**
 * The wiper stalk on the right of a steering column (-x in the column's frame), opposite the indicator stalk and like it, a plain end
 * with no symbol. It is lifted a notch for each speed (`poseWiperStalk`).
 */
export function addWiperStalk(column, y, mat, { modern = false } = {}) {
  const stalk = new THREE.Group();
  stalk.name = 'wiperStalk';
  stalk.userData.keep = true;
  stalk.userData.axis = new THREE.Vector3(0, Math.sin(column.rotation.x), Math.cos(column.rotation.x));
  stalk.position.set(0, y, 0);
  if (modern) {
    piece(new RoundedBoxGeometry(0.12, 0.014, 0.024, 2, 0.006).translate(-0.075, 0, 0), mat, stalk); // a flat moulded arm
    piece(new RoundedBoxGeometry(0.05, 0.024, 0.03, 2, 0.0099).translate(-0.155, 0, 0), mat, stalk); // and a wide end you push
  } else {
    piece(rod([0, 0, 0], [-0.13, 0, 0], 0.006, 6), mat, stalk); // a thin round old one
    piece(rod([-0.11, 0, 0], [-0.15, 0, 0], 0.011, 10), mat, stalk); // with a thicker grip on the end
  }
  column.add(stalk);
  return stalk;
}

function piece(geo, mat, parent) {
  const m = new THREE.Mesh(geo, mat);
  parent.add(m);
  return m;
}

/** Turns the marked wipers to `blade` (0 parked .. 1 at the far end of the sweep). */
export function poseWipers(model, blade) {
  const wipers = (model.userData.sweepers ??= collectWipers(model));
  for (const w of wipers) w.rotation.z = w.userData.wiperPark + w.userData.wiperSweep * blade;
}

function collectWipers(model) {
  const out = [];
  model.traverse((o) => { if (o.userData.wiperSweep !== undefined) out.push(o); });
  return out;
}

/** The wiper stalk (or the Series' toggle) at notch `notch` of `of` (0 off): the stalk's end lifts, the toggle goes from down to up. */
export function poseWiperStalk(model, notch, of) {
  const parts = (model.userData.wiperStalk ??= { stalk: model.getObjectByName('wiperStalk'), toggle: model.getObjectByName('wiperSwitch')?.getObjectByName('toggleLever') });
  if (parts.stalk) parts.stalk.quaternion.setFromAxisAngle(parts.stalk.userData.axis, -0.12 * notch); // (-: the tip is on -x, so it rises the other way)
  if (parts.toggle) parts.toggle.rotation.x = of ? 0.35 - (0.7 * notch) / of : 0.35;
}

const _v = new THREE.Vector3();

/**
 * Each marked wiper as the screen's drops see it, in the rain glass's frame: the spindle, how far along the arm its blade runs, its parked
 * angle and its sweep. Measured from the blade mesh (`wiperBlade`), with the wipers parked, so it is whatever shape the model's wiper is.
 * Returns [] for a model with no rain glass.
 */
export function wiperGeometry(model) {
  const glass = model.getObjectByName('rainGlass');
  if (!glass) return [];
  poseWipers(model, 0);
  model.updateMatrixWorld(true);
  const toGlass = new THREE.Matrix4().copy(glass.matrixWorld).invert();
  const glassNormal = new THREE.Vector3(0, 0, 1).transformDirection(glass.matrixWorld);
  return (model.userData.sweepers ?? []).map((w) => {
    const pivot = _v.setFromMatrixPosition(w.matrixWorld).applyMatrix4(toGlass).clone();
    const blade = w.getObjectByName('wiperBlade');
    const box = new THREE.Box3();
    blade.geometry.computeBoundingBox();
    const bb = blade.geometry.boundingBox;
    let rIn = Infinity;
    let rOut = 0;
    let cx = 0;
    let cy = 0;
    for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
      const p = _v.set(x, y, z).applyMatrix4(blade.matrixWorld).applyMatrix4(toGlass);
      box.expandByPoint(p);
      const r = Math.hypot(p.x - pivot.x, p.y - pivot.y);
      rIn = Math.min(rIn, r);
      rOut = Math.max(rOut, r);
      cx += p.x / 8;
      cy += p.y / 8;
    }
    // Its own z against the glass's: the same way, its rotation.z turns the blade the way the glass's angles go; facing in, the other way.
    const same = new THREE.Vector3(0, 0, 1).transformDirection(w.matrixWorld).dot(glassNormal) >= 0 ? 1 : -1;
    return { px: pivot.x, py: pivot.y, rIn: Math.max(0, rIn - 0.01), rOut: rOut + 0.01, park: Math.atan2(cy - pivot.y, cx - pivot.x), sweep: w.userData.wiperSweep * same };
  });
}
