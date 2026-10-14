import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Brakes for the vehicle models (TODO 87): a disc with its caliper, and a drum. All with the axle along X, centred on the hub, to
// sit inside a wheel: the disc and drum turn with it (put them in the wheel's spin group), the caliper and the drum's backing plate
// don't (put them in the wheel group). `side` is which way is outboard (+1 = +X), as for the rims.

const flat = (g) => {
  g.deleteAttribute('uv');
  return g;
};

/**
 * A brake disc of radius `r`: the friction ring, a hat in the middle with its bolts, and `holes` drilled through the ring (drawn as
 * dark spots on both faces, cheaper than cutting them). `wave` gives a petal edge, as on a sport quad or a pit bike. Returns
 * { disc, dark }: steel and a near-black material.
 */
export function discGeometry({ r = 0.09, thick = 0.004, holes = 12, wave = false, hat = 0.45 } = {}) {
  let ring;
  if (wave) {
    const shape = new THREE.Shape();
    const n = 64;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r * (1 - 0.06 * (0.5 + 0.5 * Math.cos(a * 10)));
      if (i === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    const hole = new THREE.Path();
    hole.absarc(0, 0, r * hat * 0.9, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    ring = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 24 }).translate(0, 0, -thick / 2).rotateY(Math.PI / 2);
  } else {
    ring = new THREE.CylinderGeometry(r, r, thick, 32).rotateZ(Math.PI / 2);
  }
  const parts = [flat(ring), flat(new THREE.CylinderGeometry(r * hat, r * hat, thick * 3, 20).rotateZ(Math.PI / 2))];
  const dark = [];
  for (let i = 0; i < holes; i++) {
    const a = (i / holes) * Math.PI * 2;
    const rr = r * (hat + (1 - hat) * (i % 2 ? 0.45 : 0.62));
    const spot = flat(new THREE.CylinderGeometry(r * 0.035, r * 0.035, thick * 1.1, 8).rotateZ(Math.PI / 2));
    spot.translate(0, Math.sin(a) * rr, Math.cos(a) * rr);
    dark.push(spot);
  }
  // The hat's bolts, standing out of its face.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const bolt = flat(new THREE.CylinderGeometry(r * 0.05, r * 0.05, thick * 4, 6).rotateZ(Math.PI / 2));
    bolt.translate(0, Math.sin(a) * r * hat * 0.65, Math.cos(a) * r * hat * 0.65);
    parts.push(bolt);
  }
  // The wave disc is extruded, which has no index: merge everything un-indexed then.
  const same = wave ? parts.map((g) => (g.index ? g.toNonIndexed() : g)) : parts;
  return { disc: mergeGeometries(same), dark: holes ? mergeGeometries(dark) : null };
}

/**
 * A caliper gripping the edge of a disc of radius `r`, at `angle` round from the top towards +Z (behind the axle is about 0.6 for
 * a front wheel), with one piston or two (`pistons`) on the inboard side and the bleed nipple on top. Its body is cast: give it an
 * alloy, painted or dark material.
 */
export function caliperGeometry({ r = 0.09, thick = 0.004, angle = 0.6, pistons = 1, side = 1 } = {}) {
  const len = r * (pistons > 1 ? 0.75 : 0.55); // along the disc's edge
  const deep = r * 0.32; // how far it reaches in from the edge
  const parts = [];
  // The bridge over the disc's edge, and a body each side of the disc.
  parts.push(flat(new THREE.BoxGeometry(thick + r * 0.22, r * 0.12, len)).translate(0, r + r * 0.04, 0));
  for (const s of [-1, 1]) {
    const w = s === -side ? r * 0.22 : r * 0.12; // the piston side is the fat one
    parts.push(flat(new THREE.BoxGeometry(w, deep, len)).translate(s * (thick / 2 + w / 2), r - deep / 2 + r * 0.06, 0));
  }
  for (let p = 0; p < pistons; p++) {
    const z = pistons > 1 ? (p - 0.5) * len * 0.48 : 0;
    parts.push(flat(new THREE.CylinderGeometry(r * 0.1, r * 0.1, r * 0.08, 12).rotateZ(Math.PI / 2)).translate(-side * (thick / 2 + r * 0.26), r - deep * 0.45, z));
  }
  parts.push(flat(new THREE.CylinderGeometry(r * 0.025, r * 0.025, r * 0.1, 6)).translate(-side * (thick / 2 + r * 0.12), r + r * 0.12, len * 0.3)); // bleed nipple
  const g = mergeGeometries(parts);
  g.rotateX(angle);
  return g;
}

/**
 * A drum brake of radius `r` and `width`: the drum (with `fins` round it for cooling, as on old quads' rears) that turns, and the
 * backing plate on its inboard side with the brake arm and its cable stop, which doesn't. Returns { drum, plate }.
 */
export function drumGeometry({ r = 0.085, width = 0.05, fins = 8, side = 1 } = {}) {
  const drum = [flat(new THREE.CylinderGeometry(r, r, width, 28).rotateZ(Math.PI / 2)), flat(new THREE.CylinderGeometry(r * 0.4, r * 0.4, width * 1.3, 16).rotateZ(Math.PI / 2))];
  for (let i = 0; i < fins; i++) drum.push(flat(new THREE.CylinderGeometry(r * 1.08, r * 1.08, width * 0.08, 28).rotateZ(Math.PI / 2)).translate(((i + 0.5) / fins - 0.5) * width * 0.8, 0, 0));
  const x = -side * (width / 2 + 0.004);
  const plate = [flat(new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.008, 28).rotateZ(Math.PI / 2)).translate(x, 0, 0)];
  plate.push(flat(new THREE.BoxGeometry(0.008, r * 0.9, r * 0.14)).translate(x - side * 0.008, r * 0.75, -r * 0.2).rotateX(0.35)); // the brake arm
  plate.push(flat(new THREE.CylinderGeometry(r * 0.06, r * 0.06, r * 0.2, 8)).translate(x - side * 0.012, r * 0.62, r * 0.55)); // cable stop
  return { drum: mergeGeometries(drum), plate: mergeGeometries(plate) };
}
