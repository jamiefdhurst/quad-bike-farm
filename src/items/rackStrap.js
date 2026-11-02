import * as THREE from 'three';

// A ratchet strap over a load on a quad's rear rack, in the rack anchor's frame (origin on the deck). One band goes over the top of the
// load and down both sides to the rack's rails, as a real 25 mm webbing strap does, with the steel ratchet on the near side of the top
// and the loose tail wound up beside it. Where the band crosses the load it sits a few millimetres proud so it doesn't flicker.

const WEBBING = 0.026;
const THICK = 0.004;

/** How each load is strapped: which way the band runs, how far out the sides it drops, how high the top is, and where along it the bands go. */
export const STRAP_FITS = {
  can: { across: 'x', half: 0.088, top: 0.487, at: [0] }, // over the can's thin way, from side to side
  toolbox: { across: 'z', half: 0.121, top: 0.264, at: [-0.14, 0.14] }, // lying across the rack, so over its depth
};

let mats = null;
const materials = () =>
  (mats ??= {
    webbing: new THREE.MeshStandardMaterial({ color: 0xe0701a, roughness: 0.85 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xb4b7ba, roughness: 0.3, metalness: 0.85 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.7, metalness: 0.4 }),
  });

const box = (w, h, d, mat, x, y, z) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
};

/** A band over the top and down the sides, `along` away from the middle of the load, running across `axis`. */
function band(fit, along, m) {
  const g = new THREE.Group();
  const { half, top } = fit;
  const out = half + THICK / 2; // beyond the load's side
  const rail = fit.across === 'z' ? 0.2 : 0.245; // where the band is hooked: the rack's rails, front and back or either side
  const reach = Math.max(rail, half + 0.04);
  const sideLen = top + 0.04;
  // Top, then each side leaning out to its hook on the rack.
  g.add(box(2 * half + 2 * THICK, THICK, WEBBING, m.webbing, 0, top + THICK / 2, 0));
  for (const s of [-1, 1]) {
    const side = box(THICK, sideLen, WEBBING, m.webbing, s * out, top / 2 - 0.02, 0);
    g.add(side);
    const hook = box(Math.max(0.01, reach - out), THICK, WEBBING, m.webbing, s * (out + Math.max(0.01, reach - out) / 2), 0.012, 0);
    g.add(hook);
    g.add(box(0.012, 0.02, WEBBING + 0.006, m.steel, s * reach, 0.012, 0)); // the S hook
  }
  // The ratchet: a steel body on the top, its handle folded flat, and the wound-up tail.
  g.add(box(0.07, 0.022, 0.05, m.steel, half * 0.35, top + 0.016, 0));
  g.add(box(0.06, 0.008, 0.014, m.dark, half * 0.35, top + 0.032, 0.012));
  g.add(box(0.03, 0.016, 0.034, m.webbing, half * 0.35 + 0.05, top + 0.012, 0));
  g.position.z = along;
  if (fit.across === 'z') {
    g.rotation.y = Math.PI / 2;
    g.position.set(along, 0, 0);
  }
  return g;
}

/** The strap for this kind of load: a Group in the rack anchor's frame. */
export function buildRackStrap(kind) {
  const fit = STRAP_FITS[kind] ?? STRAP_FITS.can;
  const g = new THREE.Group();
  g.name = 'rackStrap';
  const m = materials();
  for (const along of fit.at) g.add(band(fit, along, m));
  return g;
}
