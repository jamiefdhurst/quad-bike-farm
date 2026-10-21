import * as THREE from 'three';

// The shed kit for the barn (farm/shed.js), built from plain boxes and cylinders (no rounded boxes: a notch where two meet is the lesson of the
// vehicles). Each is a group with its feet at y 0 and its front towards +z, placed by the layout. The names and the maker are made up.

const mat = (color, roughness = 0.6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

function box(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

function cyl(rTop, rBottom, h, material, x, y, z, axis = 'y', segments = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material);
  m.position.set(x, y, z);
  if (axis === 'x') m.rotation.z = Math.PI / 2;
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  return m;
}

function label(text, w, h, bg, fg, font = 'bold 22px sans-serif') {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = Math.round((256 * h) / w);
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = fg;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, c.width / 2, c.height / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function plate(w, h, text, bg, fg, x, y, z, rotY = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: label(text, w, h, bg, fg), roughness: 0.7 }));
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  return m;
}

/** A hose: tube along a curve through the points. */
function hose(points, r, material) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 40, r, 8), material);
}

/** The workshop compressor: a horizontal red tank on two legs and a pair of wheels, a black pump and motor on top, a gauge, a regulator and a coiled hose. */
export function buildCompressor() {
  const g = new THREE.Group();
  g.name = 'compressor';
  const red = mat(0xb02a22, 0.45, 0.2);
  const black = mat(0x1d1d1f, 0.55, 0.3);
  const steel = mat(0x9aa1a8, 0.35, 0.8);
  const rubber = mat(0x151515, 0.9);
  const brass = mat(0xb8913f, 0.4, 0.7);
  // The tank, lying along x, with domed ends (short, fat cylinders as caps).
  g.add(cyl(0.2, 0.2, 0.86, red, 0, 0.42, 0, 'x'));
  for (const sx of [-1, 1]) g.add(cyl(0.14, 0.2, 0.08, red, sx * 0.45, 0.42, 0, 'x'));
  // Legs and wheels at the back end, feet at the front.
  for (const dz of [-0.13, 0.13]) {
    g.add(box(0.05, 0.24, 0.05, black, 0.32, 0.2, dz));
    g.add(cyl(0.1, 0.1, 0.05, rubber, 0.32, 0.1, dz * 1.45, 'z'));
    g.add(box(0.05, 0.24, 0.05, black, -0.32, 0.12, dz));
    g.add(box(0.09, 0.025, 0.09, rubber, -0.32, 0.0125, dz));
  }
  // The pump head and motor on top: finned cylinder, a flywheel guard and a motor can.
  g.add(box(0.5, 0.05, 0.3, black, 0, 0.64, 0));
  g.add(cyl(0.07, 0.07, 0.2, black, -0.08, 0.76, 0));
  for (let i = 0; i < 5; i++) g.add(cyl(0.085, 0.085, 0.012, black, -0.08, 0.7 + i * 0.035, 0));
  g.add(cyl(0.11, 0.11, 0.12, black, 0.14, 0.74, 0, 'z'));
  g.add(cyl(0.09, 0.09, 0.18, black, 0.14, 0.74, -0.15, 'z'));
  // A carrying handle over the top.
  g.add(box(0.03, 0.03, 0.34, steel, 0.24, 0.9, 0));
  for (const dz of [-0.16, 0.16]) g.add(box(0.03, 0.2, 0.03, steel, 0.24, 0.8, dz));
  // The gauge and regulator on the front: a round face and a brass knob.
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.045, 24),
    new THREE.MeshStandardMaterial({ map: label('PSI', 0.09, 0.09, '#eeeae0', '#222', 'bold 56px sans-serif'), roughness: 0.4 }),
  );
  face.position.set(-0.12, 0.58, 0.2);
  g.add(cyl(0.05, 0.05, 0.03, steel, -0.12, 0.58, 0.19, 'z'));
  g.add(face);
  face.position.z = 0.206;
  g.add(cyl(0.025, 0.025, 0.04, brass, 0.0, 0.6, 0.2, 'z'));
  g.add(cyl(0.02, 0.02, 0.04, brass, 0.1, 0.6, 0.2, 'z'));
  // The drain tap under the tank and a coiled hose hung off the front.
  g.add(cyl(0.012, 0.012, 0.07, brass, 0, 0.18, 0.05));
  g.add(hose([[0.1, 0.6, 0.22], [0.16, 0.52, 0.3], [0.3, 0.44, 0.34], [0.3, 0.3, 0.38], [0.18, 0.22, 0.34], [0.06, 0.28, 0.3], [0.1, 0.4, 0.26]], 0.012, mat(0xd2a21c, 0.7)));
  g.add(plate(0.2, 0.06, 'ASHBY AIR', '#b02a22', '#f4efe2', 0.0, 0.42, 0.205));
  for (const m of g.children) m.castShadow = true;
  return { group: g, size: { x: 0.95, y: 0.95, z: 0.5 } };
}

/** The parts washer: a steel cabinet with a sink top, a hinged lid propped open, a spout over the solvent and a brush on a flexible arm. */
export function buildWasher() {
  const g = new THREE.Group();
  g.name = 'parts-washer';
  const blue = mat(0x2f5f86, 0.5, 0.3);
  const steel = mat(0x8f979e, 0.35, 0.8);
  const dark = mat(0x16191c, 0.6, 0.2);
  const black = mat(0x1a1a1a, 0.7);
  const W = 0.9;
  const D = 0.55;
  // The cabinet and the legs.
  g.add(box(W, 0.55, D, blue, 0, 0.55, 0));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.05, 0.28, 0.05, dark, (x * (W - 0.1)) / 2, 0.14, (z * (D - 0.1)) / 2));
  g.add(box(W - 0.1, 0.03, D - 0.1, dark, 0, 0.3, 0)); // the lower shelf
  // The sink: a steel rim round a dark pool of solvent.
  g.add(box(W + 0.04, 0.04, D + 0.04, steel, 0, 0.85, 0));
  g.add(box(W - 0.14, 0.01, D - 0.14, mat(0x2a2310, 0.15, 0.2), 0, 0.87, 0.02));
  // A grate over the pool with a few parts on it.
  g.add(box(W - 0.2, 0.012, D - 0.2, steel, 0, 0.88, 0.02));
  g.add(box(0.1, 0.04, 0.08, mat(0x6b6f73, 0.5, 0.7), -0.15, 0.905, 0.05));
  g.add(cyl(0.04, 0.04, 0.05, mat(0x6b6f73, 0.5, 0.7), 0.12, 0.915, 0.0));
  // The lid, hinged at the back and propped up nearly vertical.
  const lid = new THREE.Group();
  lid.position.set(0, 0.87, -D / 2 - 0.02);
  lid.rotation.x = -1.35;
  lid.add(box(W + 0.04, 0.03, D, blue, 0, 0, D / 2));
  g.add(lid);
  g.add(box(0.02, 0.4, 0.02, steel, W / 2 - 0.03, 1.05, -D / 2 + 0.06)); // the stay
  // The spout: a pipe from the back over the pool.
  g.add(cyl(0.015, 0.015, 0.3, steel, 0.25, 1.0, -D / 2 + 0.06));
  g.add(box(0.015, 0.015, 0.2, steel, 0.25, 1.15, -D / 2 + 0.16));
  g.add(cyl(0.02, 0.02, 0.04, steel, 0.25, 1.13, -D / 2 + 0.26));
  // The brush on a flexible arm.
  g.add(hose([[-0.3, 0.88, -D / 2 + 0.05], [-0.34, 1.05, -D / 2 + 0.1], [-0.25, 1.12, -0.05], [-0.2, 1.0, 0.05]], 0.012, black));
  g.add(box(0.02, 0.02, 0.1, mat(0xc9b36b, 0.9), -0.2, 0.95, 0.08));
  g.add(plate(0.3, 0.08, 'MOORLAND SOLVENT', '#f4efe2', '#2f5f86', -0.2, 0.58, D / 2 + 0.005));
  g.add(plate(0.16, 0.12, 'CAUTION', '#e2c230', '#1b1b1b', 0.3, 0.58, D / 2 + 0.005));
  for (const m of g.children) m.castShadow = true;
  return { group: g, size: { x: W + 0.06, y: 1.2, z: D + 0.1 } };
}

/**
 * The inspection pit: a dark trench set into the big bay's floor under a steel kerb frame with yellow and black edging and a ladder rail at the end.
 * The floor is flat, so the trench is drawn as a black pool with ribbed sides below the rim and a lamp hook; `halfX` by `halfZ` is its opening.
 */
export function buildPit({ halfX = 1.9, halfZ = 0.45 } = {}) {
  const g = new THREE.Group();
  g.name = 'inspection-pit';
  const steel = mat(0x7f868c, 0.4, 0.8);
  const hazard = new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.6 });
  const black = mat(0x050505, 0.95);
  const wall = mat(0x2c2d2f, 0.9);
  // The opening and the black below it: the floor level is y 0, so everything below it is a trench seen through the opening.
  g.add(box(halfX * 2, 0.004, halfZ * 2, black, 0, 0.012, 0));
  // Ribbed side walls a little below the floor, so a low look shows some depth on the near side.
  for (const s of [-1, 1]) {
    g.add(box(halfX * 2, 0.012, 0.03, wall, 0, 0.0, s * (halfZ - 0.02)));
    for (let i = -3; i <= 3; i++) g.add(box(0.02, 0.01, 0.06, wall, (i * halfX * 2) / 7, 0.014, s * (halfZ - 0.05)));
  }
  // The kerb frame: angle iron round the opening, standing a little proud so a wheel rolls up and over it.
  const kerb = 0.09;
  g.add(box(halfX * 2 + kerb * 2, 0.035, kerb, steel, 0, 0.0175, halfZ + kerb / 2));
  g.add(box(halfX * 2 + kerb * 2, 0.035, kerb, steel, 0, 0.0175, -halfZ - kerb / 2));
  for (const s of [-1, 1]) g.add(box(kerb, 0.035, halfZ * 2, steel, s * (halfX + kerb / 2), 0.0175, 0));
  // Yellow and black edging inside the kerb on the long sides.
  for (const s of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(halfX * 2, 0.07), new THREE.MeshStandardMaterial({ map: hazard.map, roughness: 0.6 }));
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0, 0.037, s * (halfZ + kerb / 2));
    g.add(strip);
  }
  // A ladder rail at the +x end, down into it, and a lamp hook at the -x end.
  for (const dz of [-0.2, 0.2]) {
    g.add(box(0.03, 0.03, 0.03, steel, halfX - 0.12, 0.05, dz));
    g.add(box(0.03, 0.34, 0.03, steel, halfX - 0.12, 0.2, dz));
  }
  g.add(box(0.03, 0.03, 0.46, steel, halfX - 0.12, 0.37, 0));
  g.add(box(0.03, 0.12, 0.03, steel, -halfX - 0.02, 0.06, 0));
  for (const m of g.children) m.receiveShadow = true;
  return { group: g, size: { x: halfX * 2 + 0.2, y: 0.4, z: halfZ * 2 + 0.2 } };
}

function hazardTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 16;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e2c230';
  ctx.fillRect(0, 0, 64, 16);
  ctx.fillStyle = '#1b1b1b';
  for (let i = -2; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 16, 16);
    ctx.lineTo(i * 16 + 8, 16);
    ctx.lineTo(i * 16 + 16, 0);
    ctx.lineTo(i * 16 + 8, 0);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(8, 1);
  return t;
}

/** The catalogue hung on a nail: a thin booklet with a string loop, its cover printed with a made-up supplier. Faces +z. */
export function buildCatalogue() {
  const g = new THREE.Group();
  g.name = 'shed-catalogue';
  const cover = new THREE.Mesh(
    new THREE.PlaneGeometry(0.21, 0.29),
    new THREE.MeshStandardMaterial({ map: coverTexture(), roughness: 0.85 }),
  );
  cover.position.z = 0.009;
  g.add(cover);
  g.add(box(0.215, 0.295, 0.012, mat(0xe8dfc8, 0.9), 0, 0, 0.002));
  const string = mat(0xcab98a, 0.9);
  g.add(box(0.004, 0.2, 0.004, string, -0.04, 0.19, 0.0));
  g.add(box(0.004, 0.2, 0.004, string, 0.04, 0.19, 0.0));
  g.add(cyl(0.012, 0.012, 0.03, mat(0x3a3a3a, 0.5, 0.6), 0, 0.29, 0.02, 'z', 10));
  return { group: g, size: { x: 0.26, y: 0.55, z: 0.12 } };
}

function coverTexture() {
  const c = document.createElement('canvas');
  c.width = 210;
  c.height = 290;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f0e3b4';
  ctx.fillRect(0, 0, 210, 290);
  ctx.fillStyle = '#b02a22';
  ctx.fillRect(0, 0, 210, 70);
  ctx.fillStyle = '#f4efe2';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ASHBY', 105, 34);
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('WORKSHOP SUPPLIES', 105, 58);
  ctx.fillStyle = '#222';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('SHED KIT', 105, 130);
  ctx.font = '15px sans-serif';
  for (const [i, t] of ['Compressors', 'Parts washers', 'Inspection pits', 'Spanners & oil'].entries()) ctx.fillText(t, 105, 170 + i * 24);
  ctx.strokeStyle = '#b02a22';
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 90, 182, 180);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
