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

/** How deep the inspection pit goes below the barn's floor, in metres: a man stands up in it with his head just clear of the floor. */
export const PIT_DEPTH = 1.4;
const PIT_STEPS = 4; // concrete steps down at the +x end, each a fifth of the way
const PIT_KERB = 0.09; // the angle iron round the opening, standing 3.5 cm proud of the floor

/** Limewashed block walls: courses and mortar, a grimy foot, damp streaks and the odd oil smear. `w` by `h` metres is what the picture covers. */
function pitWallTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c9c5b6';
  ctx.fillRect(0, 0, 512, 256);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const v = 190 + ((row * 7 + col * 13) % 5) * 5;
      ctx.fillStyle = `rgb(${v},${v - 3},${v - 14})`;
      ctx.fillRect(col * 64 + (row % 2) * 32 + 1, row * 32 + 1, 62, 30);
    }
  }
  ctx.fillStyle = 'rgba(70,66,58,0.55)'; // the mortar joints, grey-brown
  for (let row = 0; row <= 8; row++) ctx.fillRect(0, row * 32 - 1, 512, 2);
  for (let row = 0; row < 8; row++) for (let col = 0; col <= 8; col++) ctx.fillRect(col * 64 + (row % 2) * 32 - 1, row * 32, 2, 32);
  const foot = ctx.createLinearGradient(0, 120, 0, 256); // damp and grime climb from the floor
  foot.addColorStop(0, 'rgba(45,40,32,0)');
  foot.addColorStop(1, 'rgba(45,40,32,0.6)');
  ctx.fillStyle = foot;
  ctx.fillRect(0, 120, 512, 136);
  ctx.fillStyle = 'rgba(60,56,48,0.22)';
  for (const x of [60, 190, 330, 450]) ctx.fillRect(x, 0, 6 + (x % 7), 150 + (x % 60));
  const oil = ctx.createRadialGradient(380, 190, 4, 380, 190, 40);
  oil.addColorStop(0, 'rgba(20,18,14,0.55)');
  oil.addColorStop(1, 'rgba(20,18,14,0)');
  ctx.fillStyle = oil;
  ctx.fillRect(330, 140, 100, 100);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** The pit's floor: damp concrete with a drain channel down the middle, a sump grate at one end, tyre-black and oil. */
function pitFloorTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6f6d68';
  ctx.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 700; i++) {
    const v = 80 + ((i * 37) % 60);
    ctx.fillStyle = `rgba(${v},${v},${v - 4},0.35)`;
    ctx.fillRect((i * 97) % 512, (i * 53) % 128, 2 + (i % 3), 2 + (i % 2));
  }
  ctx.fillStyle = '#2a2927'; // the channel
  ctx.fillRect(0, 58, 512, 12);
  ctx.fillStyle = '#4b4d4f'; // the sump's grate at the west end
  ctx.fillRect(20, 40, 64, 48);
  ctx.fillStyle = '#161616';
  for (let i = 0; i < 8; i++) ctx.fillRect(24 + i * 8, 44, 4, 40);
  const oil = ctx.createRadialGradient(300, 36, 4, 300, 36, 50);
  oil.addColorStop(0, 'rgba(15,12,8,0.6)');
  oil.addColorStop(1, 'rgba(15,12,8,0)');
  ctx.fillStyle = oil;
  ctx.fillRect(240, 0, 120, 100);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Steel chequer plate: raised diamonds on a worn grey, for the cover's slats. */
function chequerTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#7d8286';
  ctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const a = (x + y) % 2 ? 0.7854 : -0.7854;
      ctx.save();
      ctx.translate(x * 16 + 8, y * 16 + 8);
      ctx.rotate(a);
      ctx.fillStyle = '#a3a8ac';
      ctx.fillRect(-6, -2, 12, 4);
      ctx.restore();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** A texture shared by the faces of one surface, repeated `u` by `v` times over it. */
const tiled = (map, u, v) => {
  const t = map.clone();
  t.needsUpdate = true;
  t.repeat.set(u, v);
  return t;
};

/**
 * The inspection pit: a real trench `PIT_DEPTH` deep below the barn's floor, lined with limewashed block and a concrete floor with a drain, four
 * concrete steps down at the +x end with a grab rail, a caged lamp in each end wall and a steel kerb round the opening with yellow and black edging.
 * A chequer-plate roll-up cover lies over the -x end (rolled back over the rest, on its drum), so that is the part you can't see into. The group
 * stands at the floor's top (y 0 is the floor), and `halfX` by `halfZ` is the opening. The barn's slab has the same hole in it (barnBuild.js) and the
 * ground under it is cut away (terrain.js); you and the girls still stand at floor level, so the cover is not a floor you could fall through.
 */
export function buildPit({ halfX = 1.9, halfZ = 0.45 } = {}) {
  const g = new THREE.Group();
  g.name = 'inspection-pit';
  const steel = mat(0x7f868c, 0.4, 0.8);
  const hazard = new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.6 });
  const D = PIT_DEPTH;
  const T = 0.2; // the lining's thickness
  const top = -0.03; // the lining stops at the underside of the slab (3 cm thick), so the two meet without overlapping
  const h = D + top; // the lining's height, from the floor of the pit up to the slab
  const wallMap = pitWallTexture();
  const side = new THREE.MeshStandardMaterial({ map: tiled(wallMap, (halfX * 2 + 0.4) / 2, 1), roughness: 0.92 });
  const end = new THREE.MeshStandardMaterial({ map: tiled(wallMap, halfZ, 1), roughness: 0.92 });
  const floorMat = new THREE.MeshStandardMaterial({ map: pitFloorTexture(), roughness: 0.85 });
  const stepMat = new THREE.MeshStandardMaterial({ map: tiled(wallMap, 0.5, 0.25), roughness: 0.9, color: 0xb8b4a8 });
  const cy = -D + h / 2;
  // The long walls and the end walls, their inner faces on the edge of the opening.
  for (const s of [-1, 1]) {
    g.add(box(halfX * 2 + T * 2, h, T, side, 0, cy, s * (halfZ + T / 2)));
    g.add(box(T, h, halfZ * 2, end, s * (halfX + T / 2), cy, 0));
  }
  // The floor, with its drain and sump, a little under the walls' feet so the two overlap, not touch.
  g.add(box(halfX * 2 + T * 2, 0.1, halfZ * 2 + T * 2, floorMat, 0, -D - 0.05, 0));
  // The steps down from the +x end: each a block as wide as the pit and as deep as a tread, the top one a step below the floor.
  const rise = D / (PIT_STEPS + 1);
  const tread = 0.28;
  for (let i = 0; i < PIT_STEPS; i++) {
    const top2 = -rise * (i + 1);
    const x = halfX - tread * (i + 0.5);
    g.add(box(tread, top2 + D, halfZ * 2 + 0.01, stepMat, x, -D + (top2 + D) / 2, 0));
    g.add(box(tread + 0.01, 0.02, halfZ * 2 + 0.01, steel, x, top2 - 0.01 + 0.012, 0)); // a steel nosing on each tread, 12 mm proud
  }
  // The kerb frame: angle iron round the opening, standing a little proud so a wheel rolls up and over it.
  const kerb = PIT_KERB;
  g.add(box(halfX * 2 + kerb * 2, 0.035, kerb, steel, 0, 0.0175, halfZ + kerb / 2));
  g.add(box(halfX * 2 + kerb * 2, 0.035, kerb, steel, 0, 0.0175, -halfZ - kerb / 2));
  for (const s of [-1, 1]) g.add(box(kerb, 0.035, halfZ * 2, steel, s * (halfX + kerb / 2), 0.0175, 0));
  for (const s of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(halfX * 2, 0.07), new THREE.MeshStandardMaterial({ map: hazard.map, roughness: 0.6 }));
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0, 0.039, s * (halfZ + kerb / 2)); // 4 mm off the kerb it is printed on
    g.add(strip);
  }
  // The grab rail at the head of the steps: two posts up from the second tread and a bar across, 45 cm above the floor.
  for (const dz of [-0.33, 0.33]) g.add(cyl(0.015, 0.015, 0.45 + rise * 2, steel, halfX - 0.2, (0.45 - rise * 2) / 2, dz));
  g.add(cyl(0.015, 0.015, 0.66, steel, halfX - 0.2, 0.45, 0, 'z'));
  // Two caged lamps on the -z wall, 60 cm below the floor: a bracket, a frosted tube along the wall and two cage bars. The tube glows (it is the lamp).
  const lens = new THREE.MeshStandardMaterial({ color: 0xf4ecc8, emissive: 0xffe9a8, emissiveIntensity: 0.7, roughness: 0.4 });
  for (const lampX of [-0.2, 0.45]) {
    g.add(box(0.26, 0.1, 0.05, steel, lampX, -0.6, -halfZ + 0.015));
    const tube = cyl(0.035, 0.035, 0.22, lens, lampX, -0.6, -halfZ + 0.075, 'x', 14);
    tube.name = 'lens';
    g.add(tube);
    for (const dy of [-0.05, 0.05]) g.add(box(0.24, 0.012, 0.012, steel, lampX, -0.6 + dy, -halfZ + 0.075));
  }
  // The roll-up cover: chequer-plate slats on the kerb over the -x end, and the rest wound onto a drum standing beyond the end.
  const slatMap = chequerTexture();
  const slatMat = new THREE.MeshStandardMaterial({ map: tiled(slatMap, 1, 2), roughness: 0.5, metalness: 0.5 });
  const covered = 1.35; // m of the opening the cover still spans
  const slatW = 0.1;
  const slats = Math.round(covered / slatW);
  const spanZ = halfZ * 2 + kerb * 2 + 0.02;
  for (let i = 0; i < slats; i++) g.add(box(slatW - 0.006, 0.01, spanZ, slatMat, -halfX - kerb + slatW * (i + 0.5), 0.04, 0));
  const drum = cyl(0.12, 0.12, spanZ + 0.06, steel, -halfX - kerb - 0.2, 0.12, 0, 'z', 24);
  g.add(drum);
  g.add(cyl(0.125, 0.125, 0.02, steel, -halfX - kerb - 0.2, 0.12, spanZ / 2 + 0.04, 'z', 24)); // its end plates
  g.add(cyl(0.125, 0.125, 0.02, steel, -halfX - kerb - 0.2, 0.12, -spanZ / 2 - 0.04, 'z', 24));
  for (const s of [-1, 1]) g.add(box(0.06, 0.1, 0.05, steel, -halfX - kerb - 0.2, 0.05, s * (spanZ / 2 + 0.07))); // the two cradles it turns in
  for (const m of g.children) m.receiveShadow = true;
  return { group: g, size: { x: halfX * 2 + 0.6, y: D, z: halfZ * 2 + 0.4 } };
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

/** The catalogue: a thin booklet lying flat on the workbench, cover up and its top to -z, its cover printed with a made-up supplier. */
export function buildCatalogue() {
  const book = new THREE.Group();
  const card = mat(0xe8dfc8, 0.9);
  const paper = mat(0xf1ead6, 0.95);
  const spine = mat(0xb02a22, 0.7);
  // Every part stands at least 3 mm off the nearest parallel face of its neighbours (tests/catalogueModel.test.js), or the two flicker.
  book.add(box(0.215, 0.295, 0.002, card, 0, 0, -0.003)); // the back cover
  book.add(box(0.205, 0.285, 0.005, paper, 0.003, 0, 0.002)); // the pages, set in from the edges and shy of both covers
  book.add(box(0.215, 0.295, 0.002, card, 0, 0, 0.007)); // the front cover
  book.add(box(0.004, 0.295, 0.012, spine, -0.1095, 0, 0.002)); // the spine, bound along the left edge, beside the covers
  book.add(box(0.004, 0.06, 0.0012, spine, 0.04, 0.1755, 0.0052)); // a ribbon marker hanging out of the head between the pages and the cover
  const cover = new THREE.Mesh(
    new THREE.PlaneGeometry(0.205, 0.285),
    new THREE.MeshStandardMaterial({ map: coverTexture(), roughness: 0.85 }),
  );
  cover.position.set(0.003, 0, 0.0092); // printed over the front cover, 1.2 mm off it
  book.add(cover);
  book.rotation.x = -Math.PI / 2; // laid down inside its own group, so turning that about y turns the way it lies
  const g = new THREE.Group();
  g.name = 'shed-catalogue';
  g.add(book);
  return { group: g, size: { x: 0.26, y: 0.03, z: 0.32 } };
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
