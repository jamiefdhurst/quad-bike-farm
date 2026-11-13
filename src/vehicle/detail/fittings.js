import * as THREE from 'three';
import { cabMats, merge, mesh, rounded } from './parts.js';
import { sweepGeometry } from '../quadGeometry.js';

// Body fittings (TODO 340): door handles, grab handles, bonnet catches, hinges, grilles, wipers and window seals. Each stands out
// of a panel whose face is at z = 0, facing +Z (turn the group to suit the panel). Pure: the slats and holes of a grille
// (`grilleBars`) and the corners of a seal (`sealPath`).

export const HANDLE_KINDS = ['push', 'pull', 'lever', 'flap'];

/** A door handle: 'push' (a chrome bar with a push button, a Tor's), 'pull' (a recessed pull, the Griffin's), 'lever' (a lever over a backplate), 'flap' (a flush flap, a '70s car's). */
export function buildDoorHandle(kind = 'push', { mats = {} } = {}) {
  const m = { ...cabMats(), ...mats };
  const g = new THREE.Group();
  g.name = `handle_${kind}`;
  if (kind === 'push') {
    mesh(merge([rounded(0.12, 0.022, 0.022, 0.009).translate(0, 0, 0.02), rounded(0.02, 0.02, 0.02, 0.005).translate(-0.05, 0, 0.01), rounded(0.02, 0.02, 0.02, 0.005).translate(0.05, 0, 0.01)]), mats.handle ?? m.chrome, g, 'handleBar');
    mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.012, 10).rotateX(Math.PI / 2).translate(0.03, -0.018, 0.012), m.chrome, g, 'handleButton');
  } else if (kind === 'pull') {
    mesh(rounded(0.13, 0.04, 0.012, 0.012).translate(0, 0, -0.004), m.dark, g, 'handleRecess');
    mesh(rounded(0.11, 0.018, 0.014, 0.006).translate(0, 0.006, 0.006), mats.handle ?? m.greyPlastic, g, 'handleBar');
  } else if (kind === 'lever') {
    mesh(rounded(0.05, 0.08, 0.006, 0.006).translate(0, 0, 0.003), m.steel, g, 'handlePlate');
    mesh(merge([new THREE.CylinderGeometry(0.008, 0.008, 0.02, 10).rotateX(Math.PI / 2).translate(0, 0.02, 0.014), rounded(0.09, 0.016, 0.012, 0.006).translate(-0.04, 0.02, 0.026)]), mats.handle ?? m.chrome, g, 'handleLever');
  } else if (kind === 'flap') {
    mesh(rounded(0.14, 0.035, 0.008, 0.008).translate(0, 0, -0.002), m.dark, g, 'handleRecess');
    mesh(rounded(0.12, 0.03, 0.006, 0.007).translate(0, 0, 0.003), mats.handle ?? m.chrome, g, 'handleFlap');
  } else {
    throw new Error(`Unknown handle: ${kind}`);
  }
  return g;
}

/** A grab handle `len` long: a bar standing off two feet (a cab's grab rail, a tailgate's handle). */
export function buildGrabHandle({ len = 0.2, stand = 0.04, r = 0.01, mats = {} } = {}) {
  const m = { ...cabMats(), ...mats };
  const g = new THREE.Group();
  g.name = 'grabHandle';
  const h = len / 2;
  mesh(sweepGeometry([[-h, 0, 0], [-h, 0, stand], [h, 0, stand], [h, 0, 0]], r, { radial: 8 }), mats.handle ?? m.plastic, g, 'grabBar');
  return g;
}

/** An over-centre bonnet catch: a hook on the bonnet and a lever with its spring on the wing, `open` swung up. */
export function buildBonnetCatch({ open = false, mats = {} } = {}) {
  const m = { ...cabMats(), ...mats };
  const g = new THREE.Group();
  g.name = 'bonnetCatch';
  mesh(rounded(0.04, 0.05, 0.006, 0.004).translate(0, -0.02, 0.003), m.steel, g, 'catchPlate');
  const lever = new THREE.Group();
  lever.name = 'catchLever';
  lever.userData.keep = true;
  lever.position.set(0, -0.035, 0.012);
  mesh(merge([rounded(0.016, 0.06, 0.008, 0.004).translate(0, 0.03, 0), new THREE.TorusGeometry(0.008, 0.002, 4, 10, Math.PI).translate(0, 0.062, 0)]), m.steel, lever);
  lever.rotation.x = open ? -1.1 : 0;
  g.add(lever);
  return g;
}

/** A strap hinge `len` long (a Tor or Crag door's, a tailgate's): a strap over the panel, a knuckle at the pin, two bolts. */
export function buildHinge({ len = 0.12, w = 0.035, mats = {} } = {}) {
  const m = { ...cabMats(), ...mats };
  const g = new THREE.Group();
  g.name = 'hinge';
  mesh(rounded(len, w, 0.005, 0.004).translate(len / 2, 0, 0.0025), mats.strap ?? m.steel, g, 'hingeStrap');
  mesh(new THREE.CylinderGeometry(0.008, 0.008, w * 1.1, 10).translate(0, 0, 0.006), mats.strap ?? m.steel, g, 'hingeKnuckle');
  const bolts = [len * 0.45, len * 0.85].map((x) => new THREE.CylinderGeometry(0.005, 0.005, 0.004, 6).rotateX(Math.PI / 2).translate(x, 0, 0.007));
  mesh(merge(bolts), m.steel, g, 'hingeBolts');
  return g;
}

/** A grille's bars: for `kind` 'slats' (horizontal) or 'bars' (vertical), the centres of `n` bars across a `w` by `h` opening. */
export function grilleBars(kind, w, h, n) {
  const span = kind === 'slats' ? h : w;
  return Array.from({ length: n }, (_, i) => -span / 2 + (span * (i + 0.5)) / n);
}

/** A grille `w` by `h`: 'slats', 'bars' or 'mesh' (a diamond mesh), in a frame, with the dark behind. */
export function buildGrille({ w = 0.5, h = 0.25, kind = 'slats', n = 7, mats = {} } = {}) {
  const m = { ...cabMats(), ...mats };
  const g = new THREE.Group();
  g.name = `grille_${kind}`;
  const frame = [];
  for (const s of [-1, 1]) {
    frame.push(rounded(w + 0.02, 0.012, 0.02, 0.004).translate(0, (s * (h + 0.01)) / 2, 0.01));
    frame.push(rounded(0.012, h, 0.02, 0.004).translate((s * (w + 0.01)) / 2, 0, 0.01));
  }
  mesh(merge(frame), mats.frame ?? m.plastic, g, 'grilleFrame');
  mesh(new THREE.PlaneGeometry(w, h).translate(0, 0, -0.01), m.dark, g, 'grilleDark');
  const bars = [];
  if (kind === 'mesh') {
    const cell = Math.min(w, h) / 8;
    for (const dir of [-1, 1]) {
      for (let x = -w - h; x < w + h; x += cell) {
        // Diagonal wires, clipped to the opening.
        const a = [x, -h / 2];
        const b = [x + dir * h, h / 2];
        const clip = (p) => [Math.max(-w / 2, Math.min(w / 2, p[0])), p[1]];
        const pa = clip(a);
        const pb = clip(b);
        if (Math.abs(pa[0] - pb[0]) < 1e-3) continue;
        bars.push(sweepGeometry([[pa[0], pa[1], 0.004], [pb[0], pb[1], 0.004]], 0.0018, { radial: 4, caps: false }));
      }
    }
  } else {
    for (const c of grilleBars(kind, w, h, n)) {
      bars.push(kind === 'slats' ? rounded(w, 0.012, 0.018, 0.004).rotateX(-0.3).translate(0, c, 0.004) : rounded(0.012, h, 0.018, 0.004).translate(c, 0, 0.004));
    }
  }
  mesh(merge(bars), mats.bars ?? mats.frame ?? m.plastic, g, 'grilleBars');
  return g;
}

/** A wiper `len` long, parked: the arm from its spindle along +X (lying on the screen, face +Z) and the blade on it. */
export function buildWiper({ len = 0.4, mats = {} } = {}) {
  const m = { ...cabMats(), ...mats };
  const g = new THREE.Group();
  g.name = 'wiper';
  g.userData.keep = true;
  mesh(merge([new THREE.CylinderGeometry(0.012, 0.014, 0.025, 10).rotateX(Math.PI / 2).translate(0, 0, 0.012), rounded(len, 0.01, 0.008, 0.003).translate(len / 2, 0, 0.022)]), mats.arm ?? m.plastic, g, 'wiperArm');
  mesh(merge([rounded(len * 0.85, 0.012, 0.012, 0.003).translate(len * 0.55, 0.012, 0.012), rounded(len * 0.85, 0.004, 0.006, 0.001).translate(len * 0.55, 0.012, 0.004)]), m.rubber, g, 'wiperBlade');
  return g;
}

/** The corners of a rounded-rectangle window seal `w` by `h` with corner radius `r`, as points round it (closed). Pure. */
export function sealPath(w, h, r, steps = 4) {
  const pts = [];
  const corners = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, Math.PI / 2], [-w / 2 + r, -h / 2 + r, Math.PI], [w / 2 - r, -h / 2 + r, (3 * Math.PI) / 2]];
  for (const [cx, cy, a0] of corners) for (let i = 0; i <= steps; i++) {
    const a = a0 + ((Math.PI / 2) * i) / steps;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0]);
  }
  return pts;
}

/** A rubber seal round a window `w` by `h` (a closed tube on the glass's edge). */
export function buildWindowSeal({ w = 0.6, h = 0.4, r = 0.04, thick = 0.008, mats = {} } = {}) {
  const m = { ...cabMats(), ...mats };
  return mesh(sweepGeometry(sealPath(w, h, r), thick, { radial: 6, closed: true }), mats.seal ?? m.rubber, null, 'windowSeal');
}
