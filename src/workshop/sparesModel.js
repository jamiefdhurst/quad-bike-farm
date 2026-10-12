import * as THREE from 'three';

// The parts rack on the barn's back wall: a plywood back board on timber uprights with two shelves and pegs, and the five parts in the
// kind of thing each comes in. Origin on the floor under the middle of the board, the board against the wall, facing +z. Every part
// is built to its maximum and `setCounts` shows as many as are on the shelf, so a part that runs out leaves an empty tray or bare pegs.

export const RACK_WIDTH = 1.7;
const SHELF_Y = [1.15, 1.6];
const BOARD_Y = [0.95, 2.15];

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });

/** A small card label with the part's name, lettered like a shelf tag. */
function tagTexture(text) {
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 48;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e9e1c6';
  ctx.fillRect(0, 0, 192, 48);
  ctx.strokeStyle = '#6b5a35';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 188, 44);
  ctx.fillStyle = '#2a241a';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 96, 25);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** An open tray: a floor and four low walls. */
function tray(w, d, h, material) {
  const g = new THREE.Group();
  const t = 0.006;
  const add = (sx, sy, sz, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  };
  add(w, t, d, 0, t / 2, 0);
  add(w, h, t, 0, h / 2, d / 2 - t / 2);
  add(w, h, t, 0, h / 2, -d / 2 + t / 2);
  add(t, h, d - 2 * t, w / 2 - t / 2, h / 2, 0);
  add(t, h, d - 2 * t, -w / 2 + t / 2, h / 2, 0);
  return g;
}

/** A spark plug standing up: ceramic, a steel hex, the thread with its electrode, and the terminal on top. */
function plug(M) {
  const g = new THREE.Group();
  const part = (geo, m, y) => {
    const o = new THREE.Mesh(geo, m);
    o.position.y = y;
    o.castShadow = true;
    g.add(o);
  };
  part(new THREE.CylinderGeometry(0.0075, 0.0075, 0.022, 8), M.steel, 0.011); // the thread
  part(new THREE.BoxGeometry(0.003, 0.006, 0.001), M.steel, 0.024); // the electrode
  part(new THREE.CylinderGeometry(0.0125, 0.0125, 0.012, 6), M.steel, 0.028); // hex
  part(new THREE.CylinderGeometry(0.0085, 0.0095, 0.045, 10), M.ceramic, 0.0565); // insulator
  part(new THREE.CylinderGeometry(0.0035, 0.0035, 0.014, 6), M.brass, 0.0865); // terminal
  g.scale.setScalar(2.2);
  return g;
}

/** A main jet: a brass hex with a threaded nose and a drilled top. */
function jet(M) {
  const g = new THREE.Group();
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.012, 8), M.brass);
  nose.position.y = 0.006;
  const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.01, 6), M.brass);
  hex.position.y = 0.017;
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.002, 6), M.dark);
  hole.position.y = 0.0225;
  g.add(nose, hex, hole);
  g.scale.setScalar(2.6);
  return g;
}

/** A piston with its rings on: a silver crown, ring grooves, a skirt and the pin bore. */
function piston(M) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.034, 0.06, 16), M.alloy);
  body.position.y = 0.03;
  g.add(body);
  for (const y of [0.052, 0.046, 0.04]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0355, 0.0022, 6, 20), M.steel);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    g.add(ring);
  }
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.074, 8), M.dark);
  pin.rotation.z = Math.PI / 2;
  pin.position.y = 0.016;
  g.add(pin);
  g.scale.setScalar(1.4);
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}

/** An inner tube lying flat with its valve stem out of the side. */
function tube(M) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.032, 8, 24), M.rubber);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.032;
  ring.castShadow = true;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.03, 6), M.brass);
  stem.rotation.z = Math.PI / 2;
  stem.position.set(0.14, 0.032, 0);
  g.add(ring, stem);
  return g;
}

/** A V-belt hanging in a loop: a flattened ring with a lighter ridge down the face. */
function belt(M) {
  const g = new THREE.Group();
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.011, 6, 24), M.rubber);
  loop.scale.set(0.55, 1.5, 1);
  loop.position.y = -0.12;
  const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.004, 4, 24), M.cordRubber);
  ridge.scale.set(0.55, 1.5, 1);
  ridge.position.set(0, -0.12, 0.006);
  g.add(loop, ridge);
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}

export function buildSparesModel() {
  const g = new THREE.Group();
  g.name = 'sparesRack';
  const M = {
    wood: mat(0x7a5a3a, { roughness: 0.85 }),
    timber: mat(0x4a3524, { roughness: 0.9 }),
    board: mat(0x9c8a66, { roughness: 0.9 }),
    steel: mat(0x8a8d90, { roughness: 0.4, metalness: 0.8 }),
    brass: mat(0xc2993c, { roughness: 0.35, metalness: 0.85 }),
    alloy: mat(0xb9bcc0, { roughness: 0.3, metalness: 0.85 }),
    ceramic: mat(0xf0eee6, { roughness: 0.35 }),
    dark: mat(0x1c1c1e, { roughness: 0.6 }),
    rubber: mat(0x1b1b1d, { roughness: 0.9 }),
    cordRubber: mat(0x3d3d40, { roughness: 0.9 }),
    card: mat(0xb89a68, { roughness: 0.95 }),
    plugBox: mat(0xd8b83a, { roughness: 0.9 }),
    pistonBox: mat(0x3d5f86, { roughness: 0.9 }),
    organiser: mat(0xb3201a, { roughness: 0.5 }),
    lid: mat(0xd9d4c8, { roughness: 0.2, transparent: true, opacity: 0.45, depthWrite: false }),
    peg: mat(0x55595c, { roughness: 0.5, metalness: 0.7 }),
  };
  const add = (geo, m, x, y, z, parent = g) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  const W = RACK_WIDTH;
  // Back board on two uprights, with a top rail.
  add(new THREE.BoxGeometry(W, BOARD_Y[1] - BOARD_Y[0], 0.018), M.board, 0, (BOARD_Y[0] + BOARD_Y[1]) / 2, -0.115);
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.05, BOARD_Y[1] - BOARD_Y[0] + 0.04, 0.05), M.timber, sx * (W / 2 - 0.02), (BOARD_Y[0] + BOARD_Y[1]) / 2, -0.105);
  add(new THREE.BoxGeometry(W + 0.02, 0.05, 0.06), M.timber, 0, BOARD_Y[1] + 0.03, -0.1);
  // Two plank shelves with a front lip, each on a pair of steel brackets.
  for (const y of SHELF_Y) {
    add(new THREE.BoxGeometry(W - 0.08, 0.03, 0.26), M.wood, 0, y, 0.01);
    add(new THREE.BoxGeometry(W - 0.1, 0.03, 0.02), M.timber, 0, y + 0.02, 0.125);
    for (const sx of [-0.55, 0.55]) {
      add(new THREE.BoxGeometry(0.02, 0.14, 0.02), M.peg, sx, y - 0.08, -0.095);
      const strut = add(new THREE.BoxGeometry(0.016, 0.2, 0.016), M.peg, sx, y - 0.07, -0.02);
      strut.rotation.x = -0.9;
    }
  }
  // Name tags stuck to each lip.
  const tag = (text, x, y, z = 0.148) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), new THREE.MeshStandardMaterial({ map: tagTexture(text), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.position.set(x, y, z);
    g.add(m);
  };

  const shown = {}; // part -> [objects], one per unit it can show
  const top = SHELF_Y[1] + 0.017;
  const low = SHELF_Y[0] + 0.017;

  // Plugs: a yellow box open on top, two rows of four standing in it.
  {
    const box = tray(0.4, 0.17, 0.05, M.plugBox);
    box.position.set(-0.58, top, 0.02);
    g.add(box);
    shown.plug = [];
    for (let i = 0; i < 8; i++) {
      const p = plug(M);
      p.position.set(-0.15 + (i % 4) * 0.1, 0.006, i < 4 ? -0.04 : 0.04);
      box.add(p);
      shown.plug.push(p);
    }
    tag('PLUGS', -0.58, top - 0.01);
  }
  // Jets: a red organiser case, eight compartments, its clear lid propped open behind.
  {
    const c = new THREE.Group();
    c.position.set(-0.06, top, 0.02);
    g.add(c);
    c.add(tray(0.4, 0.19, 0.04, M.organiser));
    for (let i = 1; i < 4; i++) add(new THREE.BoxGeometry(0.004, 0.036, 0.18), M.organiser, -0.2 + i * 0.1, 0.018, 0, c);
    add(new THREE.BoxGeometry(0.39, 0.036, 0.004), M.organiser, 0, 0.018, 0, c);
    const lid = add(new THREE.BoxGeometry(0.4, 0.004, 0.19), M.lid, 0, 0.14, -0.13, c);
    lid.rotation.x = -1.35;
    shown.jet = [];
    for (let i = 0; i < 8; i++) {
      const j = jet(M);
      j.position.set(-0.15 + (i % 4) * 0.1, 0.004, i < 4 ? -0.045 : 0.045);
      c.add(j);
      shown.jet.push(j);
    }
    tag('JETS', -0.06, top - 0.01);
  }
  // Pistons and rings: a blue box with the pistons stood in it, up to three.
  {
    const box = tray(0.4, 0.18, 0.035, M.pistonBox);
    box.position.set(0.42, top, 0.02);
    g.add(box);
    shown.piston = [];
    for (let i = 0; i < 3; i++) {
      const p = piston(M);
      p.position.set(-0.12 + i * 0.12, 0.006, 0);
      box.add(p);
      shown.piston.push(p);
    }
    tag('PISTONS', 0.42, top - 0.01);
  }
  // Inner tubes: a cardboard tray with the tubes laid in a stack, up to four.
  {
    const box = tray(0.3, 0.25, 0.06, M.card);
    box.position.set(-0.5, low, 0.02);
    g.add(box);
    shown.tube = [];
    for (let i = 0; i < 4; i++) {
      const t = tube(M);
      t.position.set(-0.01, 0.006 + i * 0.054, 0);
      t.rotation.y = i * 0.7;
      t.scale.set(0.8, 1, 0.8);
      box.add(t);
      shown.tube.push(t);
    }
    tag('TUBES', -0.5, low - 0.01);
  }
  // Belts: hung in loops from two steel pegs on the board above the top shelf, two to a peg.
  {
    shown.belt = [];
    for (const px of [0.3, 0.62]) {
      const peg = add(new THREE.CylinderGeometry(0.01, 0.01, 0.1, 8), M.peg, px, 1.52, -0.065);
      peg.rotation.x = Math.PI / 2;
      add(new THREE.CylinderGeometry(0.016, 0.016, 0.01, 8), M.peg, px, 1.52, -0.112).rotation.x = Math.PI / 2;
      for (let k = 0; k < 2; k++) {
        const b = belt(M);
        b.position.set(px + (k - 0.5) * 0.035, 1.53, -0.05 + k * 0.035);
        b.scale.setScalar(1.15);
        g.add(b);
        shown.belt.push(b);
      }
    }
    tag('BELTS', 0.46, low - 0.01);
  }
  // A few things for company: a tin of grease and a rag on the lower shelf.
  add(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 14), mat(0x2f6b3a, { roughness: 0.5 }), -0.18, low + 0.032, 0.04);
  add(new THREE.CylinderGeometry(0.047, 0.047, 0.012, 14), M.steel, -0.18, low + 0.068, 0.04);
  add(new THREE.BoxGeometry(0.18, 0.025, 0.12), mat(0x3a3c3e, { roughness: 1 }), 0.06, low + 0.0285, 0.04).rotation.y = 0.3;

  // Shows that many of each part.
  let last = '';
  g.userData.setCounts = (counts) => {
    const key = JSON.stringify(counts);
    if (key === last) return;
    last = key;
    for (const [id, list] of Object.entries(shown)) list.forEach((o, i) => (o.visible = i < (counts[id] ?? 0)));
  };
  return g;
}
