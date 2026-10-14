import * as THREE from 'three';

// Touch wear (TODO 340): where hands and feet go, a vehicle wears differently from its edges. Knobs and grips polish, pedal rubbers
// and footboards rub smooth and pale, a seat's edge where you slide on and off goes shiny and grey, paint wears through to metal.
// Found from the parts a model already names (its levers, pedals, footrests and seat points), so every vehicle gets it; a vehicle
// may add its own in `userData.touchWear`. Pure apart from reading the model; drawn by the wear layer (effects/wearLayer.js).

/** How big a patch each kind of touch wears, and how hard. */
export const TOUCH_ROLES = {
  knob: { r: 0.05, amount: 0.9 }, // a lever's knob or grip, at the top of the lever
  pedal: { r: 0.06, amount: 0.8 }, // a pedal's pad, at its foot
  foot: { r: 0.14, amount: 0.8 }, // a footboard, footwell or peg, where the boots go
  seat: { r: 0.13, amount: 0.7 }, // a seat's edge where you slide on and off
};

/** Which named parts wear, and how. */
export const TOUCH_NAMES = {
  gearLever: 'knob', driveLever: 'knob', parkBrakeLever: 'knob', spikeLever: 'knob', handThrottle: 'knob', chokeLever: 'knob',
  clutchPedal: 'pedal', footwellLeft: 'foot', footwellRight: 'foot', pegLeft: 'foot', pegRight: 'foot', riderAnchor: 'seat',
};

export const MAX_TOUCH = 8;

/**
 * The worn patches from what was found: each { role, at: [x, y, z], box?: { min, max } } in the vehicle's body frame. A knob wears
 * at its box's top, a pedal at its box's foot, a footrest where it is, and a seat at its edge: both sides of a quad's saddle
 * (`at` on the middle line), or the door side of a cab's seat, forward of the hip. At most MAX_TOUCH, the first found first.
 */
export function touchPoints(found) {
  const out = [];
  for (const f of found) {
    const { r, amount } = TOUCH_ROLES[f.role];
    const mid = f.box ? f.box.min.map((v, i) => (v + f.box.max[i]) / 2) : f.at;
    if (f.role === 'knob') out.push({ at: [mid[0], f.box ? f.box.max[1] : mid[1], mid[2]], r, amount });
    else if (f.role === 'pedal') out.push({ at: [mid[0], f.box ? f.box.min[1] : mid[1], mid[2]], r, amount });
    else if (f.role === 'foot') out.push({ at: f.at, r, amount });
    else if (f.role === 'seat') {
      const [x, y, z] = f.at;
      const sides = Math.abs(x) < 0.05 ? [-1, 1] : [Math.sign(x)];
      for (const s of sides) out.push({ at: [x + s * 0.22, y - 0.08, z + 0.1], r, amount });
    }
  }
  return out.slice(0, MAX_TOUCH);
}

/** Packs patches for the shader: `centres` (x, y, z and radius for each) and `amounts`, padded to MAX_TOUCH, and the count. */
export function packTouch(points) {
  const centres = new Float32Array(MAX_TOUCH * 4);
  const amounts = new Float32Array(MAX_TOUCH);
  const n = Math.min(points.length, MAX_TOUCH);
  for (let i = 0; i < n; i++) {
    centres.set([...points[i].at, points[i].r], i * 4);
    amounts[i] = points[i].amount;
  }
  return { centres, amounts, count: n };
}

/** Finds a model's touch points in `frame`'s space (the body's), from the named parts and its own `userData.touchWear`. */
export function findTouchPoints(model, frame) {
  model.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(frame.matrixWorld).invert();
  const found = [];
  const seen = new Set();
  model.traverse((o) => {
    const role = TOUCH_NAMES[o.name];
    if (!role || seen.has(o.name)) return;
    seen.add(o.name);
    const at = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).applyMatrix4(inv).toArray();
    if (role === 'knob' || role === 'pedal') {
      const box = new THREE.Box3().setFromObject(o);
      if (box.isEmpty()) return;
      box.applyMatrix4(inv);
      found.push({ role, at, box: { min: box.min.toArray(), max: box.max.toArray() } });
    } else found.push({ role, at });
  });
  return [...(model.userData.touchWear ?? []), ...touchPoints(found)].slice(0, MAX_TOUCH);
}
