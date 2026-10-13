import * as THREE from 'three';

// The helmets and goggles, built in metres and facing +z, with the origin at the middle of the open rim (the plane across the head at brow
// height). One shell per rider, in her own colour; goggles are a strap round the shell and a lens in a rubber frame, either down over the
// eyes or pushed up on the front. Procedural, like everything else.

/** What each wearer's helmet looks like: the shell, the stripe, the strap and whether the goggles sit on the eyes or on the shell. */
export const HELMET_LOOKS = {
  amy: { shell: '#1f3a4a', stripe: '#d9d9d2', strap: '#161616', goggles: 'down', lens: '#bfe4f4', scuff: 0.1 },
  jess: { shell: '#e0b81c', stripe: '#8e2238', strap: '#262626', goggles: 'up', lens: '#f0c070', scuff: 0.55 },
  you: { shell: '#a8282c', stripe: '#e8e8e0', strap: '#1a1a1a', goggles: null, lens: '#9fd0e8', scuff: 0.3 },
};

/** The goggles on their own (yours, on the hooks): a lens in a frame on an elastic loop. */
export const GOGGLE_LOOK = { frame: '#202020', lens: '#9fd0e8', strap: '#2b3a4a' };

const RADIUS = 0.118; // across the rim, side to side
const DEPTH = 0.135; // front to back
const HEIGHT = 0.125; // rim to crown

const mats = new Map();
const mat = (hex, rough = 0.5, metal = 0, extra = {}) => {
  const key = `${hex}|${rough}|${metal}|${JSON.stringify(extra)}`;
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal, ...extra }));
  return mats.get(key);
};

/** A goggle outline: a rounded rectangle with a dip for the nose, drawn into `path` (a Shape, or a Path for the hole). */
function outline(path, w, h, r, nose) {
  const x = w / 2;
  const y = h / 2;
  path.moveTo(-x + r, -y);
  path.lineTo(-nose, -y);
  path.quadraticCurveTo(0, -y + nose * 0.7, nose, -y);
  path.lineTo(x - r, -y);
  path.quadraticCurveTo(x, -y, x, -y + r);
  path.lineTo(x, y - r);
  path.quadraticCurveTo(x, y, x - r, y);
  path.lineTo(-x + r, y);
  path.quadraticCurveTo(-x, y, -x, y - r);
  path.lineTo(-x, -y + r);
  path.quadraticCurveTo(-x, -y, -x + r, -y);
}

/** Bends a flat plate round a face: the middle stands out, the ends curve back. */
function wrap(geo, bend) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) - bend * pos.getX(i) * pos.getX(i));
  geo.computeVertexNormals();
  return geo;
}

/**
 * The goggles: a thin rubber rim round an open, tinted lens (you see the eyes through it), curved to wrap a face, with a dip for the nose
 * and an elastic going back round the head from each end. Faces +z, centred, about 0.15 m across.
 */
export function buildGoggles(look = GOGGLE_LOOK, strapRadius = 0.12) {
  const g = new THREE.Group();
  g.name = 'goggles';
  const W = 0.15;
  const H = 0.062;
  const inset = 0.008;
  const outer = new THREE.Shape();
  outline(outer, W, H, 0.022, 0.014);
  const hole = new THREE.Path();
  outline(hole, W - inset * 2, H - inset * 2, 0.016, 0.012);
  outer.holes.push(hole);
  const depth = 0.02;
  const rim = new THREE.Mesh(wrap(new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -depth / 2), 3.2), mat(look.frame, 0.85, 0, { side: THREE.DoubleSide }));
  rim.castShadow = true;
  g.add(rim);
  const pane = new THREE.Shape();
  outline(pane, W - inset * 2 + 0.002, H - inset * 2 + 0.002, 0.016, 0.012);
  const lens = new THREE.Mesh(wrap(new THREE.ShapeGeometry(pane, 6).translate(0, 0, 0.002), 3.2), mat(look.lens, 0.05, 0.1, { transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
  g.add(lens);
  // The elastic: a flat loop going back round the head from each end.
  const strap = new THREE.Mesh(new THREE.TorusGeometry(strapRadius, 0.009, 4, 20, Math.PI * 1.55), mat(look.strap ?? look.frame, 0.9));
  strap.rotation.set(Math.PI / 2, 0, Math.PI * 0.725 + Math.PI);
  strap.position.set(0, 0, -strapRadius + 0.012);
  g.add(strap);
  g.userData.strap = strap;
  return g;
}

/**
 * A helmet for `who` ('amy', 'jess' or 'you'). `goggles`: 'down' (over the eyes), 'up' (pushed up on the front of the shell) or null; it
 * defaults to the look's. Returns a group whose `userData.parts` has { shell, goggles } for the caller.
 */
export function buildHelmet(who, { goggles } = {}) {
  const look = HELMET_LOOKS[who] ?? HELMET_LOOKS.you;
  const g = new THREE.Group();
  g.name = `helmet-${who}`;
  // The shell: the top of a sphere, squashed to the head's width and depth.
  const shellGeo = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  const pos = shellGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    pos.setXYZ(i, x * RADIUS, y * HEIGHT, z * DEPTH);
  }
  shellGeo.computeVertexNormals();
  const shell = new THREE.Mesh(shellGeo, new THREE.MeshStandardMaterial({ color: look.shell, roughness: 0.38 + look.scuff * 0.4, metalness: 0.05, side: THREE.DoubleSide }));
  shell.castShadow = true;
  g.add(shell);
  // A stripe over the top, front to back.
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1, 0.1, 4, 24, Math.PI), mat(look.stripe, 0.5));
  arch.scale.set(DEPTH * 1.0, HEIGHT * 1.0, 0.15); // a half ring standing in the x-y plane, turned to run front to back
  arch.rotation.y = Math.PI / 2;
  g.add(arch);
  // The peak: a short flat visor over the brow.
  const peak = new THREE.Mesh(new THREE.BoxGeometry(RADIUS * 1.5, 0.006, 0.05), mat(look.shell, 0.4));
  peak.position.set(0, 0.012, DEPTH + 0.022);
  peak.rotation.x = 0.18;
  peak.castShadow = true;
  g.add(peak);
  // A dark padded liner across the open underside, so nothing shows of the inside of the shell from below.
  const liner = new THREE.Mesh(new THREE.CircleGeometry(1, 20), mat('#2b2b2b', 0.95, 0, { side: THREE.DoubleSide }));
  liner.rotation.x = Math.PI / 2;
  liner.position.y = 0.004;
  liner.scale.set(RADIUS * 0.97, DEPTH * 0.97, 1);
  g.add(liner);
  // A rolled rim round the bottom, and the chin strap hanging from each side.
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.007, 5, 28), mat(look.strap, 0.9));
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(RADIUS, DEPTH, 1);
  g.add(rim);
  for (const side of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.1, 0.014), mat(look.strap, 0.9));
    strap.position.set(side * (RADIUS - 0.004), -0.045, 0.0);
    strap.rotation.z = side * 0.12;
    g.add(strap);
  }
  // Goggles.
  const mode = goggles === undefined ? look.goggles : goggles;
  let gg = null;
  if (mode) {
    gg = buildGoggles({ frame: '#202020', lens: look.lens, strap: look.strap }, RADIUS);
    if (mode === 'down') gg.position.set(0, -0.034, DEPTH - 0.006);
    else {
      // Pushed up: the lens turned up against the front of the shell, the elastic still round it.
      gg.position.set(0, HEIGHT * 0.42, DEPTH * 0.9);
      gg.rotation.x = -0.6;
      gg.userData.strap.visible = false; // the elastic would float off the shell: it is round the back of the helmet, out of sight
    }
    g.add(gg);
  }
  g.userData.parts = { shell, goggles: gg };
  g.userData.size = { radius: RADIUS, depth: DEPTH, height: HEIGHT };
  return g;
}
