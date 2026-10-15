import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { boltsMesh, boltRow } from './detail/fixings.js';
import { cableGeometry } from './detail/cables.js';
import { decalMesh, MAKER_FOR } from './detail/decals.js';
import { drumGeometry } from './detail/brakes.js';

// The red quad's finer detail (TODO 88), built from the shared kit (detail/): welded racks with tie-down hooks, the oil cooler and
// fan behind the grille, the footboards' diamond tread plates, the shift lever, cables from the bars, the rear drum brakes, a taped
// seat, the maker's badge. Each takes the quad's materials (`MAT`, as quadModel has them) and adds to the
// frame it is given. Nothing here moves a fixed point.

const strip = (g) => {
  g.deleteAttribute('uv');
  return g;
};

const mesh = (geo, mat, parent, name) => {
  const m = new THREE.Mesh(geo, mat);
  if (name) m.name = name;
  parent.add(m);
  return m;
};

/** Where a rack's welds and hooks go: pure, so a test can check them. Returns { welds: [[x, y, z]], hooks: [[x, y, z, side]] }. */
export function rackDetailPoints({ z0, z1, y, slats, W = 0.41 }) {
  const welds = [];
  const hooks = [];
  for (let i = 1; i < slats; i++) {
    const z = z0 + ((z1 - z0) * i) / slats;
    for (const x of [-W, -0.16, 0.16, W]) welds.push([x, x === W || x === -W ? y : y - 0.004, z]);
  }
  for (const s of [-1, 1]) {
    welds.push([s * W, y, z0 + Math.sign(z1 - z0) * 0.07], [s * W, y, z1 - Math.sign(z1 - z0) * 0.07]); // where the legs start
    for (const f of [0.3, 0.7]) hooks.push([s * (W + 0.02), y - 0.003, z0 + (z1 - z0) * f, s]);
  }
  return { welds, hooks };
}

/** A rack's weld beads at its joins and tie-down hooks on its outer rails, one merged mesh each, in the black of the frame. */
export function addRackDetail(root, rack, MAT) {
  const { welds, hooks } = rackDetailPoints(rack);
  const bead = strip(new THREE.SphereGeometry(0.0105, 6, 4));
  mesh(mergeGeometries(welds.map(([x, y, z]) => bead.clone().translate(x, y, z))), MAT.frame, root, 'rackWelds');
  const hook = strip(new THREE.TorusGeometry(0.02, 0.0042, 5, 10, Math.PI)).rotateZ(Math.PI); // a U hanging below, its ends on the rail
  mesh(mergeGeometries(hooks.map(([x, y, z]) => hook.clone().translate(x, y, z))), MAT.frame, root, 'rackHooks');
}

/**
 * The grille on the front face between the headlights, a housing stood out of the face: a dark back, the oil cooler's finned core
 * between its two end tanks, the fan in front of it and two body-coloured slats over all of it to let the air through. `at` is the
 * face's surface at the grille's middle.
 */
export function addGrille(root, MAT, paint, at = [0, 0.625, 0.858]) {
  const g = new THREE.Group();
  g.name = 'grille';
  g.position.set(...at);
  root.add(g);
  const box = (w, h, d, x, y, z) => strip(new THREE.BoxGeometry(w, h, d)).translate(x, y, z);
  // The housing: a dark back and a frame round it.
  mesh(mergeGeometries([box(0.29, 0.075, 0.004, 0, 0, 0.003), box(0.31, 0.008, 0.032, 0, 0.0415, 0.016), box(0.31, 0.008, 0.032, 0, -0.0415, 0.016), box(0.008, 0.075, 0.032, 0.151, 0, 0.016), box(0.008, 0.075, 0.032, -0.151, 0, 0.016)]), MAT.plastic, g, 'grilleHousing');
  // The cooler's core and end tanks.
  const fins = [];
  for (let i = 0; i < 9; i++) fins.push(box(0.22, 0.0035, 0.008, 0, -0.028 + i * 0.007, 0.008));
  const core = new THREE.Group();
  core.name = 'oilCooler';
  g.add(core);
  mesh(mergeGeometries(fins), MAT.alloy, core);
  mesh(mergeGeometries([-1, 1].map((s) => strip(new THREE.CylinderGeometry(0.009, 0.009, 0.066, 8)).translate(s * 0.118, 0, 0.008))), MAT.engineDark, core);
  // The fan in front of it: a ring, a hub and five blades.
  const fan = [strip(new THREE.TorusGeometry(0.032, 0.0035, 5, 18)), strip(new THREE.CylinderGeometry(0.009, 0.009, 0.012, 8)).rotateX(Math.PI / 2)];
  for (let i = 0; i < 5; i++) fan.push(strip(new THREE.BoxGeometry(0.026, 0.011, 0.002)).rotateX(0.5).translate(0.019, 0, 0).rotateZ((i / 5) * Math.PI * 2));
  mesh(mergeGeometries(fan), MAT.engineDark, g, 'coolerFan').position.set(0, 0, 0.016);
  // The slats.
  for (const y of [-0.019, 0.02]) mesh(strip(new THREE.BoxGeometry(0.29, 0.02, 0.014)).translate(0, y, 0.025), paint, g, 'grilleSlat');
}

/** Diamond tread plates for the footboards: a steel plate with two crossed bars in each diamond, bolted down along its edges. */
export function addTreadPlates(root, MAT, { x = 0.44, y = 0.337, z = -0.01, w = 0.23, len = 0.54 } = {}) {
  for (const s of [-1, 1]) {
    const parts = [strip(new THREE.BoxGeometry(w, 0.004, len)).translate(0, 0.002, 0)];
    const nx = 6;
    const nz = 13;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const cx = -w / 2 + (w * (i + 0.5 + (j % 2) * 0.5)) / nx;
        if (Math.abs(cx) > w / 2 - 0.016) continue;
        const cz = -len / 2 + (len * (j + 0.5)) / nz;
        for (const a of [Math.PI / 4, -Math.PI / 4]) parts.push(strip(new THREE.BoxGeometry(0.03, 0.0035, 0.005)).rotateY(a).translate(cx, 0.0055, cz));
      }
    }
    const plate = mesh(mergeGeometries(parts), MAT.steel, root, s > 0 ? 'treadPlateLeft' : 'treadPlateRight');
    plate.position.set(s * x, y, z);
    const pts = [...boltRow([-w / 2 + 0.014, 0, -len / 2 + 0.02], [-w / 2 + 0.014, 0, len / 2 - 0.02], 4), ...boltRow([w / 2 - 0.014, 0, -len / 2 + 0.02], [w / 2 - 0.014, 0, len / 2 - 0.02], 4)];
    const bolts = boltsMesh(pts, [0, 1, 0], MAT.chrome, { size: 0.01, kind: 'flange', name: 'treadBolts' });
    bolts.position.set(s * x, y + 0.004, z);
    root.add(bolts);
  }
}

/** The gear shift lever: a rod from a boss on the left of the engine out to a rubber-tipped peg by the footboard. Named for the wear. */
export function addShiftLever(root, MAT, at = [0.15, 0.37, 0.04]) {
  const g = new THREE.Group();
  g.name = 'gearLever';
  g.position.set(...at);
  root.add(g);
  mesh(strip(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 10)).rotateZ(Math.PI / 2), MAT.alloy, g); // the boss on the case
  const end = new THREE.Vector3(0.15, -0.012, 0.075);
  const rod = strip(new THREE.CylinderGeometry(0.0065, 0.0065, end.length(), 8)).translate(0, end.length() / 2, 0);
  rod.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().normalize()));
  mesh(rod, MAT.steel, g);
  const peg = mesh(strip(new THREE.CylinderGeometry(0.0125, 0.0125, 0.05, 10)).rotateZ(Math.PI / 2), MAT.rubber, g);
  peg.position.copy(end);
}

/** Two cables from the bars' levers down the column to the shroud: a thicker brake cable on the left, the throttle on the right. */
export function addBarCables(bars, MAT) {
  for (const s of [-1, 1]) {
    // Ahead of the pod (+z, away from the rider) and down past its foot, never through it: the pod's body is at x 0.15 to 0.2, z -0.07 to -0.03.
    const anchors = s > 0 ? [[0.262, 0.078, -0.01], [0.23, 0.085, 0.03], [0.14, 0.06, 0.045], [0.07, 0.0, 0.03], [0.04, -0.07, -0.005]] : [[-0.25, 0.07, -0.045], [-0.15, 0.045, -0.055], [-0.07, 0.0, -0.05], [-0.04, -0.07, -0.015]];
    mesh(cableGeometry(anchors, s > 0 ? 0.0042 : 0.0032, { sag: 0.06 }), MAT.rubber, bars, s > 0 ? 'brakeCable' : 'throttleCable');
  }
}

/** The rear drum brake: the drum turns with the wheel (add to its `spin`), the backing plate stays (add to the wheel). */
export function addDrumBrake(wheel, spin, s, MAT) {
  const { drum, plate } = drumGeometry({ r: 0.1, width: 0.05, side: s });
  mesh(drum.translate(-s * 0.065, 0, 0), MAT.engineDark, spin, 'brakeDrum');
  mesh(plate.translate(-s * 0.065, 0, 0), MAT.steel, wheel, 'brakePlate');
}

/** The grey cloth tape over a split in the rider's seat, in the seat's own flat frame (the caller tilts it with the seat). */
export function seatTape(MAT, at = [0.07, 0.9, -0.3]) {
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0x80838a, roughness: 0.55 });
  const g = new THREE.Group();
  g.name = 'seatTape';
  g.position.set(...at);
  const strips = [
    strip(new THREE.BoxGeometry(0.05, 0.004, 0.17)).rotateY(0.4),
    strip(new THREE.BoxGeometry(0.04, 0.004, 0.09)).rotateY(-0.5).translate(0.015, 0.002, 0.1),
    strip(new THREE.BoxGeometry(0.04, 0.003, 0.03)).rotateY(0.4).rotateX(-0.35).translate(-0.045, 0.006, 0.07), // a corner lifting
  ];
  mesh(mergeGeometries(strips), tapeMat, g);
  mesh(strip(new THREE.BoxGeometry(0.008, 0.002, 0.13)).rotateY(0.4).translate(0.05, 0.0, -0.015), MAT.hole, g); // the split's dark edge, beside it
  return g;
}

/** The maker's badge on each side panel's outer face, a millimetre off the surface. */
export function addDecals(root) {
  for (const s of [-1, 1]) {
    const badge = decalMesh('badge', { maker: MAKER_FOR.red, model: 'Farm 300' }, { width: 0.2, name: 'badge' });
    badge.position.set(s * 0.273, 0.655, 0.02); // the panel's outer face, with its bevel
    badge.rotation.y = s * (Math.PI / 2);
    root.add(badge);
  }
}
