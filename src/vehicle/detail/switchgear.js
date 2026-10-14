import * as THREE from 'three';
import { cabMats, merge, mesh, rounded, keepGroup } from './parts.js';
import { lathe } from '../quadGeometry.js';

// Dash switchgear (TODO 340): toggles, rockers, pull and rotary knobs, warning lamp lenses, gauge bezels, air vents and a glovebox.
// Each faces +Z out of a panel whose face is at z = 0 (the dash face; turn the group to suit). Moving parts are named so a poser can
// find them: 'toggleLever', 'rockerCap', 'pullKnob', 'rotaryKnob', 'gloveboxLid'. Laying out a row of them is pure (`switchRow`).

/** `n` positions along X centred on 0, `spacing` apart: a row of switches. */
export function switchRow(n, spacing = 0.035) {
  return Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * spacing);
}

/** A toggle switch: a chrome bat on a threaded bush with a nut, `on` tipped up. */
export function buildToggle({ on = false, mats = {} } = {}) {
  const m = { ...cabMats(), ...mats };
  const g = new THREE.Group();
  mesh(merge([new THREE.CylinderGeometry(0.007, 0.007, 0.008, 12).rotateX(Math.PI / 2).translate(0, 0, 0.004), new THREE.CylinderGeometry(0.009, 0.009, 0.002, 6).rotateX(Math.PI / 2).translate(0, 0, 0.001)]), m.chrome, g, 'toggleBush');
  const lever = keepGroup('toggleLever');
  lever.position.z = 0.008;
  mesh(new THREE.CylinderGeometry(0.0025, 0.0018, 0.022, 8).rotateX(Math.PI / 2).translate(0, 0, 0.011), m.chrome, lever);
  lever.rotation.x = on ? -0.35 : 0.35;
  g.add(lever);
  return g;
}

/** A rocker switch in a bezel, `on` pressed at the top; `mats.symbol` colours the bar on its face (a lamp colour, say). */
export function buildRocker({ on = false, w = 0.02, h = 0.03, mats = {} } = {}) {
  const m = { ...cabMats(), ...mats };
  const g = new THREE.Group();
  mesh(rounded(w + 0.006, h + 0.006, 0.004, 0.002).translate(0, 0, 0.002), m.plastic, g, 'rockerBezel');
  const cap = keepGroup('rockerCap');
  cap.position.z = 0.004;
  mesh(rounded(w, h, 0.006, 0.0025), mats.cap ?? m.greyPlastic, cap);
  mesh(rounded(w * 0.5, h * 0.12, 0.002, 0.0005).translate(0, h * 0.25, 0.003), mats.symbol ?? m.lensAmber, cap);
  cap.rotation.x = on ? 0.12 : -0.12;
  g.add(cap);
  return g;
}

/** A pull knob on its shaft (a choke, the lights on an old car): `out` metres pulled. */
export function buildPullKnob({ out = 0, mats = {} } = {}) {
  const m = { ...cabMats(), ...mats };
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 12).rotateX(Math.PI / 2).translate(0, 0, 0.002), m.chrome, g, 'pullBezel');
  const knob = keepGroup('pullKnob');
  knob.position.z = out;
  mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.012, 8).rotateX(Math.PI / 2).translate(0, 0, 0.006), m.chrome, knob);
  mesh(lathe([[0.004, 0], [0.012, 0.002], [0.013, 0.012], [0.01, 0.017], [0.001, 0.018]], 14).rotateX(Math.PI / 2).translate(0, 0, 0.012), mats.knob ?? m.bakelite, knob);
  g.add(knob);
  return g;
}

/** A rotary knob (heater, wipers, a radio): a fluted cylinder with a pointer line, `turn` radians round. */
export function buildRotaryKnob({ r = 0.014, turn = 0, mats = {} } = {}) {
  const m = { ...cabMats(), ...mats };
  const knob = keepGroup('rotaryKnob');
  const parts = [new THREE.CylinderGeometry(r, r * 1.08, 0.014, 18).rotateX(Math.PI / 2).translate(0, 0, 0.007)];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    parts.push(rounded(0.002, 0.003, 0.012, 0.0008).translate(Math.cos(a) * r * 1.02, Math.sin(a) * r * 1.02, 0.007));
  }
  mesh(merge(parts), mats.knob ?? m.plastic, knob);
  mesh(rounded(0.0018, r * 0.8, 0.001, 0.0004).translate(0, r * 0.45, 0.0145), mats.pointer ?? m.lensClear, knob, 'rotaryPointer');
  knob.rotation.z = -turn;
  return knob;
}

/** A warning lamp: a domed lens of `colour` ('Red', 'Amber', 'Clear', or a material) in a chrome or black bezel. Named 'lampLens'. */
export function buildLampLens({ r = 0.006, colour = 'Red', bezel = 'chrome', mats = {} } = {}) {
  const m = { ...cabMats(), ...mats };
  const g = new THREE.Group();
  mesh(new THREE.TorusGeometry(r * 1.15, r * 0.3, 6, 16), bezel === 'chrome' ? m.chrome : m.plastic, g, 'lampBezel');
  const lens = new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1, 0.5);
  mesh(lens, typeof colour === 'string' ? m[`lens${colour}`] : colour, g, 'lampLens');
  return g;
}

/** A gauge's bezel ring and glass for a dial of radius `r` (the dial face itself is the dash's canvas). */
export function buildGaugeBezel({ r = 0.04, depth = 0.012, mats = {} } = {}) {
  const m = { ...cabMats(), ...mats };
  const g = new THREE.Group();
  mesh(lathe([[r, 0], [r * 1.12, 0], [r * 1.14, depth * 0.6], [r * 1.06, depth], [r * 0.99, depth * 0.8]], 32).rotateX(Math.PI / 2), mats.bezel ?? m.chrome, g, 'gaugeBezel');
  mesh(new THREE.CircleGeometry(r, 28).translate(0, 0, depth * 0.75), m.glass, g, 'gaugeGlass');
  return g;
}

/** A dash air vent: a frame with `slats` angled louvres, `w` by `h`. */
export function buildVent({ w = 0.1, h = 0.04, slats = 4, round = false, mats = {} } = {}) {
  const m = { ...cabMats(), ...mats };
  const g = new THREE.Group();
  if (round) {
    mesh(new THREE.TorusGeometry(h / 2, 0.004, 6, 20), mats.frame ?? m.plastic, g, 'ventFrame');
    mesh(new THREE.CircleGeometry(h / 2, 20).translate(0, 0, -0.01), m.dark, g, 'ventDark');
  } else {
    const frame = [];
    for (const s of [-1, 1]) {
      frame.push(rounded(w, 0.006, 0.012, 0.002).translate(0, (s * h) / 2, 0.006));
      frame.push(rounded(0.006, h, 0.012, 0.002).translate((s * w) / 2, 0, 0.006));
    }
    mesh(merge(frame), mats.frame ?? m.plastic, g, 'ventFrame');
    mesh(new THREE.PlaneGeometry(w, h).translate(0, 0, -0.004), m.dark, g, 'ventDark');
  }
  const louvres = [];
  for (let i = 0; i < slats; i++) {
    const y = -h / 2 + (h * (i + 0.5)) / slats;
    louvres.push(rounded(round ? h * 0.8 : w - 0.006, 0.0025, 0.012, 0.0008).rotateX(-0.4).translate(0, y, 0.004));
  }
  mesh(merge(louvres), mats.frame ?? m.plastic, g, 'ventLouvres');
  return g;
}

/** A glovebox: a lid `w` by `h` hinged at its bottom edge (group 'gloveboxLid', opened by turning it about X), with a latch button. */
export function buildGlovebox({ w = 0.3, h = 0.14, mats = {} } = {}) {
  const m = { ...cabMats(), ...mats };
  const g = new THREE.Group();
  const lid = keepGroup('gloveboxLid');
  mesh(rounded(w, h, 0.016, 0.006).translate(0, h / 2, 0.008), mats.lid ?? m.plastic, lid);
  mesh(rounded(0.04, 0.016, 0.006, 0.003).translate(0, h * 0.8, 0.018), m.chrome, lid, 'gloveboxLatch');
  g.add(lid);
  mesh(new THREE.PlaneGeometry(w - 0.01, h - 0.01).translate(0, h / 2, -0.002), m.dark, g, 'gloveboxDark');
  return g;
}
