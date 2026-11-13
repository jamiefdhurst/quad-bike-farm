import * as THREE from 'three';
import { cabMats, merge, mesh, rounded } from './parts.js';
import { sweepGeometry } from '../quadGeometry.js';

// Steering wheels (TODO 340). A wheel lies in its group's XZ plane with the column along +Y (as the cars' and Land Rovers' wheels
// sit on their columns): +Z is twelve o'clock, +X the driver's left (nine o'clock as they see it). The layout is pure: which way
// each spoke goes and where the hands hold it. The grips' own names (gripLeft, gripRight) stay with the vehicle, which places
// them at `userData.grips`.

/**
 * Each style: `spokes` (2, 3 or 4), `rim` the rim's thickness, `boss` ('cap' round with a horn push, 'pad' a padded oblong, 'small'
 * a sport wheel's), `wire` sprung wire spokes (three wires to each), `fingers` finger grips under the rim, `mark` a stripe at twelve.
 */
export const WHEEL_STYLES = {
  bakelite: { spokes: 3, rim: 0.015, boss: 'cap', fingers: 16 }, // an old tractor's or Tor's: a thin hard rim with grips for the fingers
  banjo: { spokes: 4, rim: 0.012, boss: 'cap', wire: true }, // sprung wire spokes, as on old cars and some tractors
  flat: { spokes: 2, rim: 0.016, boss: 'pad' }, // a late-'70s car's: two spokes across and a padded centre
  utility: { spokes: 3, rim: 0.02, boss: 'pad' }, // a Crag's or a UTV's: thick rim, a big pad
  sport: { spokes: 3, rim: 0.022, boss: 'small', mark: true }, // a small leather sports wheel with a mark at the top
};

/**
 * Which way each spoke points, as angles from twelve o'clock towards +X: two straight across (nine and three), three as a T (nine,
 * three and six), four as an X a little below the middle, as most four-spoke wheels have.
 */
export function spokeAngles(n) {
  if (n === 2) return [Math.PI / 2, -Math.PI / 2];
  if (n === 3) return [Math.PI / 2, -Math.PI / 2, Math.PI];
  if (n === 4) return [Math.PI / 2 - 0.35, -Math.PI / 2 + 0.35, Math.PI / 2 + 0.55, -Math.PI / 2 - 0.55];
  throw new Error(`A wheel has 2, 3 or 4 spokes, not ${n}`);
}

/** Where the hands hold a wheel of radius `r`: at quarter to three, on the rim. */
export function wheelGrips(r) {
  return { left: [r, 0, 0], right: [-r, 0, 0] };
}

/** The rim's arcs: the stretches round where the hands go are `worn` (a different material), the rest plain. Angles as spokeAngles. */
export function rimArcs(worn) {
  if (!worn) return [{ from: 0, to: Math.PI * 2, worn: false }];
  const span = 0.45; // each hand wears about a fist's width either side of where it sits
  return [
    { from: -Math.PI / 2 + span, to: Math.PI / 2 - span, worn: false },
    { from: Math.PI / 2 - span, to: Math.PI / 2 + span, worn: true },
    { from: Math.PI / 2 + span, to: (3 * Math.PI) / 2 - span, worn: false },
    { from: (3 * Math.PI) / 2 - span, to: (3 * Math.PI) / 2 + span, worn: true },
  ];
}

const onRim = (a, r, y = 0) => new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);

/**
 * A steering wheel of radius `r` in `style`. `worn` makes the rim where the hands go a shinier, paler material (`mats.wornRim`, by
 * default a polished copy of the rim's). Returns a group with `userData.grips`; add it to the column at the wheel's centre.
 */
export function buildSteeringWheel({ r = 0.19, style = 'flat', worn = false, mats = {} } = {}) {
  const s = WHEEL_STYLES[style];
  if (!s) throw new Error(`Unknown steering wheel style: ${style}`);
  const m = { ...cabMats(), ...mats };
  const rimMat = mats.rim ?? (style === 'sport' ? m.leather : style === 'bakelite' || style === 'banjo' ? m.bakelite : m.plastic);
  const wornMat = mats.wornRim ?? Object.assign(rimMat.clone(), { roughness: Math.max(0.12, rimMat.roughness * 0.45) });
  if (!mats.wornRim) wornMat.color.offsetHSL(0, -0.05, 0.06);
  const group = new THREE.Group();
  group.name = 'steeringWheel';
  const plain = [];
  const rubbed = [];
  for (const arc of rimArcs(worn)) {
    const n = Math.max(6, Math.round(((arc.to - arc.from) / (Math.PI * 2)) * 40));
    const pts = Array.from({ length: n + 1 }, (_, i) => onRim(arc.from + ((arc.to - arc.from) * i) / n, r));
    const g = sweepGeometry(pts, s.rim, { radial: 8, caps: false });
    (arc.worn ? rubbed : plain).push(g);
  }
  if (s.fingers) {
    for (let i = 0; i < s.fingers; i++) {
      const a = (i / s.fingers) * Math.PI * 2;
      const bump = new THREE.SphereGeometry(s.rim * 0.75, 6, 4);
      bump.translate(...onRim(a, r - s.rim * 0.7, -s.rim * 0.35).toArray());
      plain.push(bump);
    }
  }
  if (s.mark) {
    const mark = rounded(s.rim * 1.6, s.rim * 2.2, s.rim * 2.2, s.rim * 0.4);
    mark.translate(0, 0, r);
    mesh(mark, mats.mark ?? m.red, group, 'wheelMark');
  }
  // Spokes, from the boss out to the rim; wire spokes are three thin wires fanned to each.
  const spokeMat = s.wire ? m.chrome : mats.spoke ?? rimMat;
  const spokes = [];
  for (const a of spokeAngles(s.spokes)) {
    if (s.wire) {
      for (const k of [-1, 0, 1]) spokes.push(sweepGeometry([onRim(a, r * 0.18, 0.025), onRim(a + k * 0.09, r - s.rim * 0.6)], 0.0022, { radial: 4 }));
    } else {
      const w = style === 'flat' ? 0.034 : 0.022;
      const spoke = rounded(w, 0.01, r - 0.04, 0.004);
      spoke.translate(0, 0.012, (r - 0.04) / 2 + 0.03);
      spoke.applyMatrix4(new THREE.Matrix4().makeRotationY(a));
      spokes.push(spoke);
    }
  }
  mesh(merge(plain), rimMat, group, 'wheelRim');
  if (rubbed.length) mesh(merge(rubbed), wornMat, group, 'wheelRimWorn');
  mesh(merge(spokes), spokeMat, group, 'wheelSpokes');
  // The boss (raised towards the driver, +Y) and its horn push.
  const bossMat = mats.boss ?? m.plastic;
  if (s.boss === 'pad') {
    mesh(rounded(r * 0.62, 0.05, r * 0.42, 0.018).translate(0, 0.03, -r * 0.05), bossMat, group, 'wheelBoss');
  } else {
    const br = s.boss === 'small' ? r * 0.26 : r * 0.2;
    mesh(new THREE.CylinderGeometry(br, br * 1.1, 0.05, 20).translate(0, 0.025, 0), bossMat, group, 'wheelBoss');
    mesh(new THREE.CylinderGeometry(br * 0.62, br * 0.62, 0.012, 20).translate(0, 0.054, 0), mats.horn ?? (style === 'bakelite' ? m.chrome : m.plastic), group, 'hornPush');
  }
  group.userData.grips = wheelGrips(r);
  return group;
}
